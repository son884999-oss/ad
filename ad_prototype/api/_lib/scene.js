// 고급형 "배경 바꾸기": one paid image edit on Higgsfield (Qwen Image 3 edit) that keeps the product exactly and
// replaces only its surroundings with an advertising scene, 9:16. The same scene picture is then used for the
// poster and as the first frame of the AI video. Tried for real on 2026-10-17 (scripts/live-scene-test.mjs):
// a café-table cake became a marble-pedestal studio shot in ~1 minute, product unchanged, no added text.
// Like the video: start = upload + one submit (never retried), status = one poll; the finished picture is
// downloaded here and returned inline so the browser can draw it without depending on the CDN's CORS.
import { randomUUID } from "node:crypto"
import { ApiError, cleanText, sendJson } from "./http.js"
import { readImageInput } from "./photo.js"
import { REQUEST_ID_PATTERN, getHiggsfieldConfig, getVideoStatus, submitVideo, uploadImage } from "./higgsfield.js"

export const SCENE_MODEL = "alibaba/qwen-image-3/edit"
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9-]{16,64}$/
const MAX_SCENE_BYTES = 6 * 1024 * 1024

// Product groups follow the video direction rules (E_이채원, api/_lib/video-prompt.js), plus flowers.
// Each scene is a calm commercial set that flatters the product and leaves room above it for the caption.
const SCENES = [
  {
    pattern: /꽃|플라워|부케|화분|\b(flower|flowers|bouquet)\b/i,
    scene: "a bright florist studio set: a pale linen surface, soft daylight from a large window, a few loose petals and fresh greenery nearby, airy pastel backdrop",
  },
  {
    pattern: /쿠키|마카롱|과자|식품|음료|커피|라떼|라테|녹차|홍차|초콜릿|빵|케이크|떡|디저트|잼|국밥|국수|라면|냉면|찌개|전골|김치|반찬|도시락|떡볶이|\b(cookie|food|snack|coffee|latte|tea|chocolate|bread|cake|dessert|soup)\b/i,
    scene: "a premium food advertisement set: the product on a white marble surface, a soft warm cream studio backdrop, warm soft key light from the left with gentle shadows, only a few crumbs or shavings of the product itself, shallow depth of field",
  },
  {
    pattern: /화장품|세럼|로션|크림|스킨케어|립스틱|향수|샴푸|비누|\b(cosmetic|serum|lotion|skincare|lipstick|perfume|shampoo|soap)\b/i,
    scene: "a natural beauty advertisement set: the product on a wet dark stone in a misty green forest, soft sun rays from above, a few water droplets and fern leaves around, calm and fresh",
  },
  {
    pattern: /머그|컵|생활용품|텀블러|수건|주방|그릇|\b(mug|cup|tumbler|towel|kitchen|bowl)\b/i,
    scene: "a clean lifestyle advertisement set: the product on a light oak table by a sunny window, soft morning light, a linen cloth and a small plant softly out of focus",
  },
]
const GENERAL_SCENE = "a clean studio advertisement set: the product on a simple round podium, a soft gradient backdrop in a colour that suits the product, soft even light with a gentle shadow"

/** The advertising set for this product group, or null when the words match none (api/_lib/background.js). */
export function sceneFor(details) {
  const text = `${details.productName ?? ""} ${details.productDescription ?? ""} ${details.highlights ?? ""}`
  return SCENES.find(({ pattern }) => pattern.test(text))?.scene ?? null
}

/** The edit prompt: keep the product untouched, change only the surroundings, never add text (added later). */
export function scenePrompt(details) {
  const scene = sceneFor(details) ?? GENERAL_SCENE
  return [
    "Keep the product exactly as it is in the photo: the same shape, size, colours, surface details and any printed text or logo, unchanged.",
    `Replace only the surroundings with this advertising scene: ${scene}.`,
    "Photorealistic commercial product photography, vertical frame: the product sharp and centred about 40% from the top, filling about 40% of the frame height, its base no lower than 60% of the height; the lower third is a calm, plain, softly lit surface with no objects (text goes there later); light consistent across product and scene.",
    // Owner's goal (2026-10-18): a frame that looks like a top-tier commercial, not a catalogue shot.
    "Lit like a high-end TV commercial: a soft key light, a warm rim light tracing the product's silhouette against a slightly darker backdrop, gentle reflections on the surface, rich depth and fine texture detail.",
    "Add no fruit, food, flowers or other props that are not part of the product; never change what the product is.",
    // Two real runs (2026-10-18) put dark-red jam streaks into a cake's cream layers.
    "Keep the inside of the product exactly as in the photo: the same layers, fillings and colours; add no jam, fruit, sauce or new filling.",
    "Do not add any text, letters, words, logos, labels or watermarks anywhere.",
  ].join(" ")
}

/** Validates POST /api/scene-start: the photo (already framed 9:16 by the app) and the product name. */
export function normalizeSceneInput(body) {
  const details = body.details
  if (!details || typeof details !== "object" || Array.isArray(details)) throw new ApiError(400, "INVALID_INPUT")
  const productName = cleanText(details.productName, 50)
  if (!productName) throw new ApiError(400, "INVALID_INPUT")
  const idempotencyKey = body.idempotencyKey === undefined ? randomUUID() : String(body.idempotencyKey)
  if (!IDEMPOTENCY_PATTERN.test(idempotencyKey)) throw new ApiError(400, "INVALID_INPUT")
  return {
    image: readImageInput(body),
    details: {
      productName,
      productDescription: cleanText(details.productDescription, 500),
      highlights: cleanText(details.highlights, 300),
    },
    idempotencyKey,
  }
}

/** Upload + one submit. Returns at once; the picture takes about a minute. */
export async function startScene({ image, details, idempotencyKey }, config) {
  const imageUrl = await uploadImage(config, { mimeType: image.mimeType, bytes: Buffer.from(image.data, "base64") })
  const input = { prompt: scenePrompt(details), image_urls: [imageUrl], aspect_ratio: "9:16", resolution: "1k" }
  const requestId = await submitVideo({ ...config, model: SCENE_MODEL }, input, idempotencyKey)
  return { requestId }
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

/** GET /api/scene-status?id=… — one poll; when done, the picture itself ({ mimeType, data } base64). */
export async function sceneStatusHandler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET")
      throw new ApiError(405, "METHOD_NOT_ALLOWED")
    }
    const config = getHiggsfieldConfig()
    const id = queryId(req)
    if (!REQUEST_ID_PATTERN.test(id)) throw new ApiError(400, "INVALID_ID")
    const status = await getVideoStatus(config, id.toLowerCase())
    if (status.status !== "completed") {
      sendJson(res, 200, status)
      return
    }
    // Only our provider's HTTPS output is fetched, with a size cap.
    let picture
    try {
      const response = await fetch(status.imageUrl, { signal: AbortSignal.timeout(15_000) })
      const bytes = Buffer.from(await response.arrayBuffer())
      if (!response.ok || bytes.length > MAX_SCENE_BYTES) throw new Error("bad picture")
      const mimeType = (response.headers.get("content-type") ?? "").split(";")[0] || "image/png"
      picture = { mimeType: /^image\/(png|jpeg|webp)$/.test(mimeType) ? mimeType : "image/png", data: bytes.toString("base64") }
    } catch {
      sendJson(res, 200, { status: "failed", error: "SCENE_DOWNLOAD_FAILED" })
      return
    }
    sendJson(res, 200, { status: "completed", image: picture })
  } catch (error) {
    if (error instanceof ApiError) {
      sendJson(res, error.status, { error: error.code })
      return
    }
    console.error("[api] unexpected error:", error instanceof Error ? error.name : typeof error)
    sendJson(res, 500, { error: "INTERNAL_ERROR" })
  }
}


