// Image-to-video flow for /api/video-start, /api/video-status, /api/video-cancel.
// Video jobs take minutes, so the functions never wait for them: start = prompt + upload + submit,
// status = one provider poll. Cost safety: one submit per start call, never retried by the server.
import { randomUUID } from "node:crypto"
import { ApiError, cleanText, sendJson } from "./http.js"
import { getGeminiConfig } from "./gemini.js"
import { readImageInput } from "./photo.js"
import { cleanTones } from "./tones.js"
import { buildVideoPrompt, CONCEPT_NEGATIVE_PROMPT, conceptPrompt, NEGATIVE_PROMPT } from "./video-prompt.js"
import {
  REQUEST_ID_PATTERN,
  buildVideoInput,
  cancelVideo,
  getHiggsfieldConfig,
  getVideoStatus,
  submitVideo,
  uploadImage,
} from "./higgsfield.js"

const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9-]{16,64}$/

/** Validates the request body. Shape follows /api/promo-text, with the photo of /api/analyze-photo. */
export function normalizeVideoInput(body) {
  const details = body.details
  if (!details || typeof details !== "object" || Array.isArray(details)) throw new ApiError(400, "INVALID_INPUT")
  const productName = cleanText(details.productName, 50)
  if (!productName) throw new ApiError(400, "INVALID_INPUT")
  const keyFeatures = Array.isArray(details.keyFeatures)
    ? details.keyFeatures
    : typeof details.keyFeatures === "string" ? details.keyFeatures.split(",") : []
  const idempotencyKey = body.idempotencyKey === undefined ? randomUUID() : String(body.idempotencyKey)
  if (!IDEMPOTENCY_PATTERN.test(idempotencyKey)) throw new ApiError(400, "INVALID_INPUT")
  return {
    image: readImageInput(body),
    details: {
      productName,
      productDescription: cleanText(details.productDescription, 500),
      highlights: cleanText(details.highlights, 300),
      keyFeatures: keyFeatures.map((item) => cleanText(item, 20)).filter(Boolean).slice(0, 5),
      targetAudience: cleanText(details.targetAudience, 100),
      tones: cleanTones(details.tones),
      shopName: cleanText(details.shopName, 50),
      // 고급형: a bold change of world from the original photo (api/_lib/video-prompt.js conceptPrompt).
      style: details.style === "concept" ? "concept" : "portrait",
    },
    idempotencyKey,
  }
}

function optionalGemini() {
  try {
    return getGeminiConfig()
  } catch {
    return null
  }
}

/** prompt (≤ 6 s Gemini, else rules) → upload → submit. Returns without waiting for the video. */
export async function startVideo({ image, details, idempotencyKey }, config) {
  const concept = details.style === "concept"
  const [{ videoPrompt }, imageUrl] = await Promise.all([
    concept ? { videoPrompt: conceptPrompt(details, config.duration) } : buildVideoPrompt(details, image, { duration: config.duration, gemini: optionalGemini(), timeoutMs: 6_000 }),
    uploadImage(config, { mimeType: image.mimeType, bytes: Buffer.from(image.data, "base64") }),
  ])
  const input = buildVideoInput({ model: config.model, imageUrl, prompt: videoPrompt, duration: config.duration, resolution: config.resolution, negativePrompt: concept ? CONCEPT_NEGATIVE_PROMPT : NEGATIVE_PROMPT })
  const requestId = await submitVideo(config, input, idempotencyKey)
  return { requestId, videoPrompt, duration: config.duration }
}

function queryId(req) {
  const fromVercel = req.query?.id
  if (typeof fromVercel === "string") return fromVercel
  try {
    return new URL(req.url ?? "", "http://localhost").searchParams.get("id") ?? ""
  } catch {
    return ""
  }
}

/** GET /api/video-status?id=<uuid> */
export async function videoStatusHandler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET")
      throw new ApiError(405, "METHOD_NOT_ALLOWED")
    }
    const config = getHiggsfieldConfig()
    const id = queryId(req)
    if (!REQUEST_ID_PATTERN.test(id)) throw new ApiError(400, "INVALID_ID")
    sendJson(res, 200, await getVideoStatus(config, id.toLowerCase()))
  } catch (error) {
    if (error instanceof ApiError) {
      sendJson(res, error.status, { error: error.code })
      return
    }
    console.error("[api] unexpected error:", error instanceof Error ? error.name : typeof error)
    sendJson(res, 500, { error: "INTERNAL_ERROR" })
  }
}

/** POST /api/video-cancel { id } — only succeeds while the job is still queued. */
export async function cancelVideoRequest(body, config) {
  const id = typeof body.id === "string" ? body.id : ""
  if (!REQUEST_ID_PATTERN.test(id)) throw new ApiError(400, "INVALID_ID")
  return { canceled: await cancelVideo(config, id.toLowerCase()) }
}
