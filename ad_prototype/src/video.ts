// Browser side of the real (Higgsfield) video. Talks only to our /api/video-* functions; the
// Higgsfield key stays on the server. Starting a job costs money, so nothing here ever retries a
// start on its own: one call to startAiVideo() = at most one paid generation.
import { downscalePhoto } from "./ai"

export type AiVideoDetails = {
  productName: string
  productDescription?: string
  highlights?: string
  keyFeatures?: string[]
  targetAudience?: string
  tones?: string[]
  shopName?: string
}

export type StartResult =
  | { kind: "off" } // not configured (503) or no API (404/405, static preview)
  | { kind: "started"; requestId: string }
  | { kind: "error"; code: string }

export type StatusResult =
  | { status: "queued" | "in_progress" }
  | { status: "completed"; videoUrl: string }
  | { status: "failed"; error: string }

// Longer than the server's worst case (Gemini 6 s ∥ upload 8 + 15 s, then submit 15 s ≈ 38 s; vercel.json allows 60 s),
// so the app does not give up on a job the server is still starting — and paying for.
const START_TIMEOUT_MS = 55_000
const STATUS_TIMEOUT_MS = 15_000
/** Larger than the 1024 px used for analysis: the photo is the first frame of the clip. */
const VIDEO_IMAGE_SIZE = 1280
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let videoUnavailable = false
export const isVideoUnavailable = () => videoUnavailable

function newKey() {
  const random = globalThis.crypto?.randomUUID?.()
  return random ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}
export const newVideoJobId = newKey

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  const timer = window.setTimeout(abort, timeoutMs)
  signal?.addEventListener("abort", abort, { once: true })
  return { signal: controller.signal, done: () => { window.clearTimeout(timer); signal?.removeEventListener("abort", abort) } }
}

function isHttpsUrl(value: unknown): value is string {
  try {
    return typeof value === "string" && new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

/** Starts ONE generation. `idempotencyKey` is forwarded so an accidental double send is charged once. */
export async function startAiVideo(
  imageSource: Blob | string,
  details: AiVideoDetails,
  { idempotencyKey, signal }: { idempotencyKey: string; signal?: AbortSignal },
): Promise<StartResult> {
  if (videoUnavailable) return { kind: "off" }
  const image = await downscalePhoto(imageSource, VIDEO_IMAGE_SIZE)
  if (!image) return { kind: "error", code: "IMAGE_FAILED" }
  if (signal?.aborted) return { kind: "error", code: "ABORTED" }
  const request = withTimeout(signal, START_TIMEOUT_MS)
  try {
    const response = await fetch("/api/video-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, details, idempotencyKey }),
      signal: request.signal,
    })
    // Like src/ai.ts: 503 (our server only sends it for VIDEO_NOT_CONFIGURED; provider outages are 502)
    // or no API at all (404/405, static preview) → keep the sample video, ask no more.
    if (response.status === 404 || response.status === 405) {
      videoUnavailable = true
      return { kind: "off" }
    }
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (response.status === 503 && (data?.error === "VIDEO_NOT_CONFIGURED" || data?.error === "AI_NOT_CONFIGURED")) {
      videoUnavailable = true
      return { kind: "off" }
    }
    if (!response.ok) return { kind: "error", code: typeof data?.error === "string" ? data.error : `HTTP_${response.status}` }
    const requestId = data?.requestId
    return typeof requestId === "string" && REQUEST_ID.test(requestId)
      ? { kind: "started", requestId }
      : { kind: "error", code: "BAD_RESPONSE" }
  } catch {
    // The server may still have submitted the job; the caller must not resend automatically.
    return { kind: "error", code: signal?.aborted ? "ABORTED" : "NETWORK" }
  } finally {
    request.done()
  }
}

/** One status check. `null` means "could not tell right now" (network, 5xx): poll again later. */
export async function fetchAiVideoStatus(requestId: string, signal?: AbortSignal): Promise<StatusResult | null> {
  const request = withTimeout(signal, STATUS_TIMEOUT_MS)
  try {
    const response = await fetch(`/api/video-status?id=${encodeURIComponent(requestId)}`, { signal: request.signal })
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (response.status === 400 && data?.error === "INVALID_ID") return { status: "failed", error: "INVALID_ID" }
    if (response.status === 503 && data?.error === "VIDEO_NOT_CONFIGURED") return { status: "failed", error: "VIDEO_NOT_CONFIGURED" }
    if (!response.ok || !data) return null
    if (data.status === "queued" || data.status === "in_progress") return { status: data.status }
    if (data.status === "completed" && isHttpsUrl(data.videoUrl)) return { status: "completed", videoUrl: data.videoUrl }
    if (data.status === "completed" || data.status === "failed") {
      return { status: "failed", error: typeof data.error === "string" ? data.error : "VIDEO_FAILED" }
    }
    return null
  } catch {
    return null
  } finally {
    request.done()
  }
}

/** Best effort: a job that has not started yet is canceled and refunded by Higgsfield. */
export function cancelAiVideo(requestId: string) {
  void fetch("/api/video-cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: requestId }),
    keepalive: true,
  }).catch(() => undefined)
}

/** Short, stable fingerprint of the photo + details, so the same creation is not paid for twice. */
export function videoSignature(imageUrl: string, details: AiVideoDetails) {
  const text = `${imageUrl}\u0000${JSON.stringify(details)}`
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${text.length}-${(hash >>> 0).toString(36)}`
}

function videoFileName(title: string) {
  const safe = title.replace(/[\\/:*?"<>|\s]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40)
  return `${safe || "홍보잇다"}_AI영상.mp4`
}

async function fetchVideoFile(url: string, title: string) {
  const response = await fetch(url, { mode: "cors", credentials: "omit" })
  if (!response.ok) throw new Error("download-failed")
  const blob = await response.blob()
  return new File([blob], videoFileName(title), { type: blob.type || "video/mp4" })
}

/**
 * Saves the real MP4. Tries fetch → blob (needs CORS on the provider CDN); if that is blocked, opens
 * the URL in a new tab with a download attribute so the browser can save it there.
 */
export async function downloadAiVideo(url: string, title: string): Promise<"saved" | "opened"> {
  const link = document.createElement("a")
  link.rel = "noopener"
  link.download = videoFileName(title)
  let objectUrl = ""
  try {
    objectUrl = URL.createObjectURL(await fetchVideoFile(url, title))
    link.href = objectUrl
  } catch {
    link.href = url
    link.target = "_blank"
  }
  document.body.append(link)
  link.click()
  link.remove()
  if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
  return objectUrl ? "saved" : "opened"
}

/** Shares the MP4 as a file when the browser allows it, otherwise shares the link. */
export async function shareAiVideo(url: string, title: string): Promise<"shared" | "cancelled" | "unsupported" | "failed"> {
  if (!navigator.share) return "unsupported"
  let data: ShareData = { title, url }
  try {
    const file = await fetchVideoFile(url, title)
    if (navigator.canShare?.({ files: [file] })) data = { title, files: [file] }
  } catch {
    // CORS or network: fall back to sharing the URL.
  }
  try {
    await navigator.share(data)
    return "shared"
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError" ? "cancelled" : "failed"
  }
}

/** Maps the 정보 입력 fields (App's GeneratedRecord["details"]) to the video request. */
export function toVideoDetails(details: {
  name?: string
  shopName?: string
  description: string
  features: string
  audience: string
  keywords?: string
  tones?: string[]
}): AiVideoDetails {
  return {
    productName: details.name?.trim() ?? "",
    productDescription: details.description.trim(),
    highlights: details.features.trim().slice(0, 300),
    keyFeatures: (details.keywords ?? "").split(",").map((item) => item.trim()).filter(Boolean),
    targetAudience: details.audience.trim(),
    tones: details.tones ?? [],
    shopName: details.shopName?.trim(),
  }
}
