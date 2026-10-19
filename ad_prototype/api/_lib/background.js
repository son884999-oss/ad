// 배경 바꾸기 (plan C, 2026-10-19): one Gemini image edit that keeps the product and replaces only its surroundings
// with an advertising set. Synchronous (about 13–25 s). The free Gemini key has no image quota, so the paid key
// (GEMINI_API_KEY_2) is used first; every picture counts against the paid key's daily ₩ cap shared with the text
// answers (api/_lib/gemini.js). Keys are server-only and never logged.
import { addToLedger, paidKeyFits } from "./gemini.js"
import { ApiError, cleanText } from "./http.js"
import { readImageInput } from "./photo.js"
import { sceneFor } from "./scene.js"

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"
export const BACKGROUND_MODEL = "gemini-3.1-flash-image"
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9-]{16,64}$/
// Official standard prices (ai.google.dev/gemini-api/docs/pricing, checked 2026-10-19): image output $60 per 1M
// tokens (a 1K picture is 1,120 tokens = $0.067), text/thinking output $3 per 1M, input $0.50 per 1M (a photo is
// 1,120 tokens). One picture ≈ $0.07 ≈ ₩100. The $30 rate is the batch tier, which we do not use. A call is made
// only while the reserve still fits under the daily cap.
const IMAGE_OUT_USD_PER_M = 60
const TEXT_OUT_USD_PER_M = 3
const INPUT_USD_PER_M = 0.5
const PICTURE_RESERVE_KRW = 110
const KRW_PER_USD = 1500

/** ₩ for one answer from its usage. Without a per-modality breakdown every output token counts as image (upper bound). */
export function pictureCostKrw(usage) {
  const output = Number(usage?.candidatesTokenCount) || 0
  const thoughts = Number(usage?.thoughtsTokenCount) || 0
  const details = Array.isArray(usage?.candidatesTokensDetails) ? usage.candidatesTokensDetails : null
  const imageTokens = details ? details.filter((d) => d?.modality === "IMAGE").reduce((sum, d) => sum + (Number(d?.tokenCount) || 0), 0) : output
  const textTokens = Math.max(0, output - imageTokens) + thoughts
  const input = Number(usage?.promptTokenCount) || 0
  if (!output && !thoughts) return PICTURE_RESERVE_KRW
  return ((imageTokens * IMAGE_OUT_USD_PER_M + textTokens * TEXT_OUT_USD_PER_M + input * INPUT_USD_PER_M) / 1_000_000) * KRW_PER_USD
}

/** GEMINI_API_KEY_2 (paid) or else GEMINI_API_KEY, and GEMINI_IMAGE_MODEL (default gemini-3.1-flash-image). */
export function getBackgroundConfig() {
  const apiKey = process.env.GEMINI_API_KEY_2?.trim() || process.env.GEMINI_API_KEY?.trim()
  const model = process.env.GEMINI_IMAGE_MODEL?.trim() || BACKGROUND_MODEL
  if (!apiKey || !/^[a-zA-Z0-9._-]+$/.test(model)) throw new ApiError(503, "AI_NOT_CONFIGURED")
  return { apiKey, model }
}

const DEFAULT_SETS = [
  "food or drinks: a white marble surface and a soft warm cream studio backdrop",
  "cosmetics: a wet dark stone with soft greenery and gentle sun rays",
  "flowers: a pale linen surface by a bright window",
  "household goods: a light oak table by a sunny window",
  "anything else: a simple round podium with a soft gradient backdrop",
].join("; ")

/**
 * The edit prompt. The product rules come first and are concrete: a real run (2026-10-18) turned white macaron
 * shells beige and a lone shell into a third whole macaron. Without a product name yet (the owner chose 바꾸기
 * right after adding the photo), the model picks the set from what it sees.
 */
export function backgroundPrompt(details = {}) {
  const set = sceneFor(details)
  return [
    "Edit this product photo from a small local shop into a premium advertisement photo by changing ONLY the surroundings.",
    "The product must stay exactly as photographed: the same number of items, the same arrangement and angles, the same colours (a white item stays white, a pale item stays pale), the same shapes, fillings, toppings, textures and surface marks. Do not redraw, tidy, recolour, complete or add any item; a single shell, slice or piece stays exactly that.",
    set
      ? `Replace the table, cloth, board and everything around the product with this advertising set: ${set}.`
      : `Replace the table, cloth, board and everything around the product with a premium advertising set that suits it (${DEFAULT_SETS}).`,
    "Remove any watermark, caption or text that is not printed on the product itself.",
    "Vertical frame: the product group in the middle, about 60% of the frame width, its top about 25% from the top of the frame; the lower quarter is a calm, plain surface with no objects (text is added there later).",
    "Lit like a high-end commercial: a soft key light, a warm rim light along the product's edge, gentle reflections, photorealistic, the product sharp.",
    "Add no props, fruit, flowers, cutlery, people, text, letters, logos or watermarks.",
  ].join(" ")
}

/** Validates POST /api/background: the photo, the optional product words, the optional idempotency key. */
export function normalizeBackgroundInput(body) {
  const details = body?.details && typeof body.details === "object" && !Array.isArray(body.details) ? body.details : {}
  const idempotencyKey = body?.idempotencyKey === undefined ? "" : String(body.idempotencyKey)
  if (idempotencyKey && !IDEMPOTENCY_PATTERN.test(idempotencyKey)) throw new ApiError(400, "INVALID_INPUT")
  return {
    image: readImageInput(body),
    details: {
      productName: cleanText(details.productName, 50),
      productDescription: cleanText(details.productDescription, 500),
      highlights: cleanText(details.highlights, 300),
    },
    idempotencyKey,
  }
}

// The same request sent again (network retry, a second tap) within 15 minutes gets the same picture, unpaid.
const recent = new Map()
const RECENT_MS = 15 * 60_000
function remembered(key) {
  const hit = key ? recent.get(key) : undefined
  if (hit && Date.now() - hit.at < RECENT_MS) return hit.result
  return null
}
function remember(key, result) {
  if (!key) return
  recent.set(key, { at: Date.now(), result })
  for (const [old, value] of recent) if (recent.size > 20 || Date.now() - value.at > RECENT_MS) recent.delete(old)
}

/** One picture. 429 BACKGROUND_DAILY_LIMIT when today's cap would be passed; never retried automatically. */
export async function makeBackground({ image, details, idempotencyKey }, config, { timeoutMs = 50_000 } = {}) {
  const cached = remembered(idempotencyKey)
  if (cached) return cached
  if (!paidKeyFits(PICTURE_RESERVE_KRW)) throw new ApiError(429, "BACKGROUND_DAILY_LIMIT")
  let response
  try {
    response = await fetch(`${ENDPOINT}/${config.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inlineData: image }, { text: backgroundPrompt(details) }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } },
      }),
    })
  } catch (error) {
    const name = error && typeof error === "object" ? error.name : ""
    throw new ApiError(name === "TimeoutError" || name === "AbortError" ? 504 : 502, name === "TimeoutError" || name === "AbortError" ? "AI_TIMEOUT" : "AI_REQUEST_FAILED")
  }
  if (response.status === 429) throw new ApiError(429, "AI_RATE_LIMITED")
  if (!response.ok) throw new ApiError(502, "AI_REQUEST_FAILED")
  const data = await response.json().catch(() => null)
  const usage = data?.usageMetadata ?? {}
  // Charged when an answer came back, picture or not (the provider bills the call).
  addToLedger(pictureCostKrw(usage))
  const picture = (data?.candidates?.[0]?.content?.parts ?? []).find((part) => part?.inlineData?.data)?.inlineData
  if (!picture || !/^image\/(png|jpeg|webp)$/.test(picture.mimeType ?? "")) throw new ApiError(502, "AI_BAD_RESPONSE")
  const result = { image: { mimeType: picture.mimeType, data: picture.data } }
  remember(idempotencyKey, result)
  return result
}
