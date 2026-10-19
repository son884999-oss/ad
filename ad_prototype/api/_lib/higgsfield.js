// Higgsfield REST client (no SDK; plain fetch so the Vercel function needs no extra dependency).
// Sources (checked 2026-10-15):
//   - Auth `Authorization: Key {KEY_ID}:{KEY_SECRET}`, base https://api.higgsfield.ai, submit returns
//     { status:"queued", request_id, status_url, cancel_url }: https://docs.higgsfield.ai/docs/quickstart.md
//   - Status GET /requests/{request_id}/status (request_id = UUID), statuses queued | in_progress |
//     completed | failed | nsfw | canceled, video at `video.url`:
//     https://docs.higgsfield.ai/docs/api-reference/requests/get-request-status.md,
//     https://docs.higgsfield.ai/docs/concepts/requests.md
//   - Upload POST /files/generate-upload-url {content_type} → {upload_url, public_url, upload_headers};
//     PUT the bytes with every upload_header, never with our credentials:
//     https://docs.higgsfield.ai/docs/concepts/file-uploads.md
//   - Errors (401 credentials, 403 credits, 400 concurrency, 422 validation/idempotency, 5xx) and
//     `Idempotency-Key` on submissions: https://docs.higgsfield.ai/docs/concepts/errors.md,
//     https://docs.higgsfield.ai/docs/concepts/rate-limits.md
//   - Submit = POST {base}/{model_id} with the model input as the flat JSON body: @higgsfield/client
//     v2 source, https://github.com/higgsfield-ai/higgsfield-js/blob/main/src/v2/client.ts (subscribe()).
//   - Failed / nsfw requests are not charged; outputs kept ≥ 7 days:
//     https://docs.higgsfield.ai/docs/concepts/billing-and-retention.md
// Credentials are only ever placed in the Authorization header of api.higgsfield.ai requests.
import { ApiError } from "./http.js"

export const HF_BASE = "https://api.higgsfield.ai"
// MVP default (2026-10-15): Kling 2.5 Turbo Standard image-to-video (720p, no audio), 5 s — the cheapest
// clip at ≥720p (list ≈ $0.042/s ⇒ ≈ $0.21 per clip) and the model A_손용범 ran for real. Sound/music is
// added later with FFmpeg (see README). Wan 3.0 (alibaba/wan-3.0/image-to-video) stays selectable via HF_VIDEO_MODEL.
export const DEFAULT_VIDEO_MODEL = "kling-video/v2.5-turbo/standard/image-to-video"
export const WAN_VIDEO_MODEL = "alibaba/wan-3.0/image-to-video"
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*){1,5}$/i
export const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WAN_RESOLUTIONS = new Set(["480p", "720p", "1080p"])

/** Wan models (alibaba/wan-*) take 2–30 s, a resolution and no negative_prompt; Kling takes 5 or 10 s. */
export const isWanModel = (model) => /^alibaba\/wan-/i.test(model)

/**
 * Reads HF_CREDENTIALS (KEY_ID:KEY_SECRET), HF_VIDEO_MODEL, HF_VIDEO_DURATION, HF_VIDEO_RESOLUTION.
 * Missing or malformed → 503 VIDEO_NOT_CONFIGURED, before any network call.
 */
export function getHiggsfieldConfig() {
  // Paid jobs need an explicit switch as well as the key, so a key copied into .env.local (or a public
  // deployment) never starts paid videos by accident — e.g. from a test that forgot to stub /api/video-*.
  if (process.env.VIDEO_ENABLED?.trim() !== "1") throw new ApiError(503, "VIDEO_NOT_CONFIGURED")
  const credentials = process.env.HF_CREDENTIALS?.trim()
  const model = process.env.HF_VIDEO_MODEL?.trim() || DEFAULT_VIDEO_MODEL
  const wan = isWanModel(model)
  const duration = Number(process.env.HF_VIDEO_DURATION?.trim() || (wan ? 3 : 5))
  const resolution = process.env.HF_VIDEO_RESOLUTION?.trim() || "480p"
  const durationOk = wan ? Number.isInteger(duration) && duration >= 2 && duration <= 30 : duration === 5 || duration === 10
  if (!credentials || !/^[^:\s]+:\S+$/.test(credentials) || !MODEL_PATTERN.test(model) || !durationOk || (wan && !WAN_RESOLUTIONS.has(resolution))) {
    throw new ApiError(503, "VIDEO_NOT_CONFIGURED")
  }
  return { credentials, model, duration, resolution }
}

/**
 * Model input for one image-to-video job.
 * - Wan 3.0: schema from https://docs.higgsfield.ai/docs/models/wan-3/image-to-video (checked 2026-10-15).
 *   It has no negative_prompt, so the things to avoid are appended to the prompt. generate_audio defaults
 *   to true and resolution to 1080p there; both are set explicitly to keep the clip cheap.
 * - Kling: field names follow A_손용범/video.mjs, which ran a real Kling 2.5 Turbo job through
 *   @higgsfield/client v2. TODO(confirm) for other models: check their schema in https://console.higgsfield.ai.
 */
export function buildVideoInput({ model, imageUrl, prompt, duration, resolution, negativePrompt }) {
  if (isWanModel(model)) {
    return {
      image_url: imageUrl,
      prompt: negativePrompt ? `${prompt} Avoid: ${negativePrompt}.` : prompt,
      duration,
      resolution,
      aspect_ratio: "adaptive",
      generate_audio: false,
    }
  }
  return { image_url: imageUrl, prompt, duration, cfg_scale: 0.5, negative_prompt: negativePrompt }
}

function authHeaders(config, extra = {}) {
  return { Authorization: `Key ${config.credentials}`, Accept: "application/json", ...extra }
}

/** fetch with a timeout; network failures and timeouts become ApiErrors (no retry here, ever). */
async function send(url, init, timeoutMs) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    const name = error && typeof error === "object" ? error.name : ""
    if (name === "TimeoutError" || name === "AbortError") throw new ApiError(504, "VIDEO_TIMEOUT")
    throw new ApiError(502, "VIDEO_REQUEST_FAILED")
  }
}

/** Maps a non-2xx Higgsfield response to one of our safe error codes. */
export function providerError(status) {
  if (status === 401) return new ApiError(502, "VIDEO_AUTH_FAILED")
  if (status === 403) return new ApiError(402, "VIDEO_NO_CREDITS")
  if (status === 400 || status === 429) return new ApiError(429, "VIDEO_BUSY") // 400 = concurrency limit or rejected input
  if (status === 404) return new ApiError(502, "VIDEO_MODEL_NOT_FOUND")
  if (status === 422) return new ApiError(502, "VIDEO_INVALID_REQUEST")
  // 423 / 500 / 503: provider temporarily unavailable. Never 503 here: our 503 means "not configured".
  return new ApiError(502, "VIDEO_PROVIDER_UNAVAILABLE")
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    throw new ApiError(502, "VIDEO_BAD_RESPONSE")
  }
}

function isHttpsUrl(value) {
  try {
    return typeof value === "string" && new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

/** Uploads the photo (generate-upload-url, then PUT) and returns its public HTTPS URL. */
export async function uploadImage(config, { mimeType, bytes }) {
  const response = await send(`${HF_BASE}/files/generate-upload-url`, {
    method: "POST",
    headers: authHeaders(config, { "Content-Type": "application/json" }),
    body: JSON.stringify({ content_type: mimeType }),
  }, 8_000)
  if (!response.ok) throw providerError(response.status)
  const upload = await readJson(response)
  if (!isHttpsUrl(upload?.upload_url) || !isHttpsUrl(upload?.public_url)) throw new ApiError(502, "VIDEO_BAD_RESPONSE")
  const headers = new Headers()
  // Docs show an object; A's script also accepted [{name|key, value}].
  if (Array.isArray(upload.upload_headers)) {
    for (const header of upload.upload_headers) if (header?.value !== undefined) headers.set(header.name ?? header.key, String(header.value))
  } else {
    for (const [key, value] of Object.entries(upload.upload_headers ?? {})) headers.set(key, String(value))
  }
  if (!headers.has("Content-Type")) headers.set("Content-Type", mimeType)
  headers.delete("Authorization") // never send our credentials to the storage URL
  const put = await send(upload.upload_url, { method: "PUT", headers, body: bytes }, 15_000)
  if (!put.ok) throw new ApiError(502, "VIDEO_UPLOAD_FAILED")
  return upload.public_url
}

/** Submits one job without waiting for it. One call = one paid generation; never retried here. */
export async function submitVideo(config, input, idempotencyKey) {
  const response = await send(`${HF_BASE}/${config.model}`, {
    method: "POST",
    headers: authHeaders(config, { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }),
    body: JSON.stringify(input),
  }, 15_000)
  if (!response.ok) throw providerError(response.status)
  const data = await readJson(response)
  const requestId = data?.request_id
  if (typeof requestId !== "string" || !REQUEST_ID_PATTERN.test(requestId)) throw new ApiError(502, "VIDEO_BAD_RESPONSE")
  return requestId
}

/** Provider status → our contract. Safe, fixed error codes only (provider text is never passed on). */
export function mapStatus(data) {
  const status = data?.status
  if (status === "queued" || status === "in_progress") return { status }
  if (status === "completed") {
    const videoUrl = data?.video?.url
    if (isHttpsUrl(videoUrl)) return { status: "completed", videoUrl }
    // Image jobs (the 고급형 scene picture) answer with images[].url instead.
    const imageUrl = data?.images?.[0]?.url
    return isHttpsUrl(imageUrl) ? { status: "completed", imageUrl } : { status: "failed", error: "VIDEO_NO_OUTPUT" }
  }
  if (status === "nsfw") return { status: "failed", error: "VIDEO_BLOCKED" }
  if (status === "canceled") return { status: "failed", error: "VIDEO_CANCELED" }
  if (status === "failed") return { status: "failed", error: "VIDEO_FAILED" }
  return { status: "in_progress" } // unknown non-terminal value: keep polling until the client deadline
}

export async function getVideoStatus(config, requestId) {
  const response = await send(`${HF_BASE}/requests/${requestId}/status`, { method: "GET", headers: authHeaders(config) }, 8_000)
  if (response.status === 404) return { status: "failed", error: "VIDEO_NOT_FOUND" }
  if (!response.ok) throw providerError(response.status)
  return mapStatus(await readJson(response))
}

/** Cancels a job that has not started yet (refunded per the billing docs). Best effort. */
export async function cancelVideo(config, requestId) {
  const response = await send(`${HF_BASE}/requests/${requestId}/cancel`, { method: "POST", headers: authHeaders(config) }, 8_000)
  return response.ok
}
