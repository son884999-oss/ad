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
  /** Poster title / first video line and the closing invitation, ≤16 chars each ("" when the AI had none). */
  mediaHeadline?: string
  mediaCta?: string
  tones: AiTone[]
  /** What the photo visibly shows (color, texture, plating, setting): 0–5 short phrases, ≤30 chars, no claims.
   *  Pass it on as PromoTextRequest.visualDetails. */
  visualDetails: string[]
  /** Where the product is, [ymin, xmin, ymax, xmax] on 0–1000; null when unknown. Used to frame the poster. */
  subjectBox: [number, number, number, number] | null
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
  /** 가게 위치 · 가격/이벤트 · 주문/문의 방법 (server limit: 60 characters each) */
  location?: string
  priceInfo?: string
  contact?: string
  channel?: string
  /** PhotoSuggestion.visualDetails (server limit: ≤5 items, ≤30 characters each; more is 400). Used only as
   *  sensory/scene material, never copied verbatim. */
  visualDetails?: string[]
}

export type PromoTextResult = {
  copy: string
  sns: string
  intro: string
  /** 1–5 tags without "#" (the server sends 3–5). */
  hashtags: string[]
  /** B_이창훈's one-line copy angles (0–3). `copy` is the chosen one. */
  copyCandidates: string[]
  /** Short caption for the video (≤16 characters); derived from `copy` on the server if needed. */
  videoHeadline: string
  /** Call to action (≤14 characters); "" when the model gave none — use a local fallback. */
  cta: string
}

type RequestOptions = { signal?: AbortSignal; timeoutMs?: number }

const DEFAULT_TIMEOUT_MS = 20_000
const MAX_IMAGE_SIZE = 1024

// Once the server says AI is off (or the API is missing, e.g. a static preview), stop asking.
let aiUnavailable = false
/** True once the server said AI is not set up (or there is no API): the app then simply works without it. */
export const isAiUnavailable = () => aiUnavailable

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
    // Stop asking only when the API is missing (static preview) or our server says the key is not set.
    // Any other 503 (e.g. a platform hiccup) fails just this request.
    if (response.status === 404 || response.status === 405) {
      aiUnavailable = true
      return null
    }
    if (response.status === 503) {
      const data = (await response.json().catch(() => null)) as { error?: unknown } | null
      if (data?.error === "AI_NOT_CONFIGURED") aiUnavailable = true
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

function box(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4 || !value.every((n) => typeof n === "number" && n >= 0 && n <= 1000)) return null
  const [ymin, xmin, ymax, xmax] = value as number[]
  return ymax > ymin && xmax > xmin ? [ymin, xmin, ymax, xmax] : null
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
    mediaHeadline: text(value.mediaHeadline, 16),
    mediaCta: text(value.mediaCta, 16),
    tones: textList(value.tones, 4, 20).filter((tone): tone is AiTone => AI_TONES.includes(tone as AiTone)),
    visualDetails: textList(value.visualDetails, 5, 30),
    subjectBox: box(value.subjectBox),
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
  // A failure (network, quota) is not remembered: the next time this photo is chosen it is analysed again.
  void promise.then((result) => {
    if (!result && sharedAnalysis?.promise === promise) sharedAnalysis = null
  })
  return promise
}

/** 홍보 글 (B_이창훈 rules on the server). Resolves to null when the AI result is not available. */
export async function generatePromoText(details: PromoTextRequest, options: RequestOptions = {}): Promise<PromoTextResult | null> {
  // Keep visualDetails within the server limits so an odd value never turns the whole request into a 400.
  const body = details.visualDetails === undefined ? details : { ...details, visualDetails: textList(details.visualDetails, 5, 30) }
  const data = await postJson("/api/promo-text", body, options)
  if (!data || typeof data !== "object") return null
  const value = data as Record<string, unknown>
  const result: PromoTextResult = {
    copy: text(value.copy, 200),
    sns: text(value.sns, 800),
    intro: text(value.intro, 500),
    hashtags: textList(value.hashtags, 5, 30).map((tag) => tag.replace(/^#+/, "")).filter(Boolean),
    // Optional extras: a missing or malformed value becomes empty, never failing the whole result.
    copyCandidates: textList(value.copyCandidates, 3, 60),
    videoHeadline: text(value.videoHeadline, 16),
    cta: text(value.cta, 14),
  }
  return result.copy && result.sns && result.intro && result.hashtags.length ? result : null
}
