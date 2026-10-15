// Browser side of the AI features. Talks only to our own /api functions (the Gemini key stays on
// the server). Every function resolves to `null` on any failure — missing key (503), network
// error, timeout, bad JSON — so the UI silently keeps its local template behaviour.

export type AiTone = "natural" | "premium" | "friendly" | "trendy"

const AI_TONES: readonly AiTone[] = ["natural", "premium", "friendly", "trendy"]

/** AI view of the photo itself. Lenient: anything but an explicit flag means "looks fine". */
export type PhotoCheck = { isRealPhoto: boolean; isBlurry: boolean; reason: string }

export type PhotoSuggestion = {
  productName: string
  description: string
  highlights: string
  keyFeatures: string[]
  targetAudience: string
  tones: AiTone[]
  photoCheck: PhotoCheck
}

export type PromoTextRequest = {
  productName: string
  productDescription?: string
  highlights?: string
  keyFeatures?: string[]
  targetAudience?: string
  tones?: AiTone[]
  shopName?: string
  channel?: string
}

export type PromoTextResult = {
  copy: string
  sns: string
  intro: string
  hashtags: string[]
}

type RequestOptions = { signal?: AbortSignal; timeoutMs?: number }

const DEFAULT_TIMEOUT_MS = 20_000
const MAX_IMAGE_SIZE = 1024

// Once the server says AI is off (or the API is missing, e.g. a static preview), stop asking.
let aiUnavailable = false

async function postJson(url: string, body: unknown, { signal, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions) {
  if (aiUnavailable || signal?.aborted) return null
  const controller = new AbortController()
  const abort = () => controller.abort()
  const timer = window.setTimeout(abort, timeoutMs)
  signal?.addEventListener("abort", abort, { once: true })
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (response.status === 503 || response.status === 404 || response.status === 405) {
      aiUnavailable = true
      return null
    }
    if (!response.ok) return null
    return (await response.json()) as unknown
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener("abort", abort)
  }
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? Array.from(value.trim()).slice(0, max).join("").trim() : ""
}

function textList(value: unknown, max: number, itemMax: number) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => text(item, itemMax)).filter(Boolean))].slice(0, max)
    : []
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("image-load-failed"))
    image.src = src
  })
}

/** Downscales a photo to at most 1024 px on its long side and re-encodes it as JPEG. */
export async function downscalePhoto(source: Blob | string, maxSize = MAX_IMAGE_SIZE) {
  const objectUrl = typeof source === "string" ? "" : URL.createObjectURL(source)
  try {
    const image = await loadImage(objectUrl || (source as string))
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext("2d")
    if (!context) return null
    context.fillStyle = "#ffffff" // transparent PNGs would turn black in JPEG
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const data = canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? ""
    return data ? { mimeType: "image/jpeg" as const, data } : null
  } catch {
    return null
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

/** Asks the server to suggest form fields from the photo (a File/Blob or a data/object URL). */
export async function analyzePhoto(source: Blob | string, options: RequestOptions = {}): Promise<PhotoSuggestion | null> {
  if (aiUnavailable) return null
  const image = await downscalePhoto(source)
  if (!image || options.signal?.aborted) return null
  const data = await postJson("/api/analyze-photo", { image }, options)
  if (!data || typeof data !== "object") return null
  const value = data as Record<string, unknown>
  return {
    productName: text(value.productName, 50),
    description: text(value.description, 500),
    highlights: text(value.highlights, 300),
    keyFeatures: textList(value.keyFeatures, 5, 20).map((item) => item.replace(/,/g, " ")),
    targetAudience: text(value.targetAudience, 100),
    tones: textList(value.tones, 4, 20).filter((tone): tone is AiTone => AI_TONES.includes(tone as AiTone)),
    photoCheck: photoCheck(value.photoCheck),
  }
}

function photoCheck(value: unknown): PhotoCheck {
  const check = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  return { isRealPhoto: check.isRealPhoto !== false, isBlurry: check.isBlurry === true, reason: text(check.reason, 60) }
}

// One analysis per photo: the photo step starts it as soon as a photo is chosen and the info step
// reuses the same pending answer (never a second request). Only the latest photo is kept.
let sharedAnalysis: { source: string; promise: Promise<PhotoSuggestion | null> } | null = null

/** analyzePhoto, shared per photo. Callers ignore stale answers themselves (no abort here). */
export function analyzePhotoOnce(source: string) {
  if (sharedAnalysis?.source === source) return sharedAnalysis.promise
  const promise = analyzePhoto(source)
  sharedAnalysis = { source, promise }
  return promise
}

/** 홍보 글 (B_이창훈 rules on the server). Resolves to null when the AI result is not available. */
export async function generatePromoText(details: PromoTextRequest, options: RequestOptions = {}): Promise<PromoTextResult | null> {
  const data = await postJson("/api/promo-text", details, options)
  if (!data || typeof data !== "object") return null
  const value = data as Record<string, unknown>
  const result = {
    copy: text(value.copy, 200),
    sns: text(value.sns, 800),
    intro: text(value.intro, 500),
    hashtags: textList(value.hashtags, 6, 30).map((tag) => tag.replace(/^#+/, "")).filter(Boolean),
  }
  return result.copy && result.sns && result.intro && result.hashtags.length ? result : null
}
