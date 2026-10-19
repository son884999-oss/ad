// 배경 바꾸기 (plan C, 2026-10-19): one Gemini image edit that keeps the product and replaces only its surroundings
// with an advertising set. Synchronous (about 13–25 s). The free Gemini key has no image quota, so the paid key
// (GEMINI_API_KEY_2) is used first; every picture counts against the paid key's daily ₩ cap shared with the text
// answers (api/_lib/gemini.js). Keys are server-only and never logged.
import { addToLedger, paidKeyFits } from "./gemini.js"
import { ApiError, cleanText } from "./http.js"
import { readImageInput } from "./photo.js"

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"
// Flash-Lite Image since 2026-10-19 (owner's choice after a real comparison): half the price of 3.1 Flash Image,
// about 5–6 s instead of 15–30 s, the product kept as well; with the close-up framing below it is as large.
export const BACKGROUND_MODEL = "gemini-3.1-flash-lite-image"
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9-]{16,64}$/
// Official standard prices (ai.google.dev/gemini-api/docs/pricing, checked 2026-10-19). A 1K picture is 1,120
// output tokens: Flash-Lite Image $30 per 1M (= $0.0336 ≈ ₩50), Flash Image $60 per 1M (= $0.067 ≈ ₩100). Text and
// thinking output and the input (a photo is 1,120 tokens) are counted at the higher of the two models' rates, so the
// ledger never reads low. The batch tier (half price) is not used. A call is made only while the reserve still fits
// under the daily cap.
const IMAGE_OUT_USD_PER_M = { "gemini-3.1-flash-lite-image": 30, "gemini-3.1-flash-image": 60 }
const UNKNOWN_IMAGE_OUT_USD_PER_M = 60
const TEXT_OUT_USD_PER_M = 3
const INPUT_USD_PER_M = 0.5
const PICTURE_RESERVE_KRW = { "gemini-3.1-flash-lite-image": 60 }
const UNKNOWN_PICTURE_RESERVE_KRW = 110
const KRW_PER_USD = 1500

const reserveFor = (model) => PICTURE_RESERVE_KRW[model] ?? UNKNOWN_PICTURE_RESERVE_KRW

/** ₩ for one answer from its usage. Without a per-modality breakdown every output token counts as image (upper bound). */
export function pictureCostKrw(usage, model = BACKGROUND_MODEL) {
  const output = Number(usage?.candidatesTokenCount) || 0
  const thoughts = Number(usage?.thoughtsTokenCount) || 0
  const details = Array.isArray(usage?.candidatesTokensDetails) ? usage.candidatesTokensDetails : null
  const imageTokens = details ? details.filter((d) => d?.modality === "IMAGE").reduce((sum, d) => sum + (Number(d?.tokenCount) || 0), 0) : output
  const textTokens = Math.max(0, output - imageTokens) + thoughts
  const input = Number(usage?.promptTokenCount) || 0
  if (!output && !thoughts) return reserveFor(model)
  const imageRate = IMAGE_OUT_USD_PER_M[model] ?? UNKNOWN_IMAGE_OUT_USD_PER_M
  return ((imageTokens * imageRate + textTokens * TEXT_OUT_USD_PER_M + input * INPUT_USD_PER_M) / 1_000_000) * KRW_PER_USD
}

/** GEMINI_API_KEY_2 (paid) or else GEMINI_API_KEY, and GEMINI_IMAGE_MODEL (default gemini-3.1-flash-lite-image). */
export function getBackgroundConfig() {
  const apiKey = process.env.GEMINI_API_KEY_2?.trim() || process.env.GEMINI_API_KEY?.trim()
  const model = process.env.GEMINI_IMAGE_MODEL?.trim() || BACKGROUND_MODEL
  if (!apiKey || !/^[a-zA-Z0-9._-]+$/.test(model)) throw new ApiError(503, "AI_NOT_CONFIGURED")
  return { apiKey, model }
}

/**
 * Advertising sets by kind of product (2026-10-19 review). Real runs showed two faults of the old five-line list: every
 * food got the patisserie set (white marble, cream backdrop), and a cutlet and sushi lost their plate and lay bare on
 * the marble, which made a meal look like raw ingredients. Meals now get a restaurant table and keep their dish; the
 * owner also sells shampoo, cosmetics, 떡, glasses and earphones, so those have their own sets. Order matters: the
 * first match wins (meals before desserts so "치즈돈가스" is a meal; cream foods before beauty so "생크림" is food).
 * `name` is what the prompt calls the kind; `set` is the scene; `allow` is the one small prop that fits, if any.
 */
export const BACKGROUND_SETS = [
  {
    name: "a meal",
    pattern: /돈가스|돈까스|카츠|초밥|스시|생선회|모둠회|모듬회|사시미|덮밥|국밥|국수|라멘|라면|우동|냉면|파스타|피자|버거|햄버거|스테이크|고기|삼겹|갈비|불고기|치킨|닭|족발|보쌈|찌개|전골|매운탕|갈비탕|감자탕|곰탕|설렁탕|삼계탕|볶음|비빔밥|김밥|도시락|정식|백반|한식|일식|중식|양식|짜장|짬뽕|떡볶이|순대|만두|샐러드|샌드위치|\b(cutlet|katsu|sushi|sashimi|ramen|udon|pasta|pizza|burger|steak|chicken|salad|sandwich|meal|lunch|dinner)\b/i,
    set: "a warm restaurant set: the dish on a dark walnut wood or slate table, warm soft restaurant lighting from one side, a softly blurred warm restaurant interior far behind, gentle steam only if the dish is served hot",
    allow: "one small serving item that belongs with the dish, such as chopsticks on a rest or a small sauce dish, placed to the side",
  },
  {
    name: "Korean rice cakes or traditional sweets",
    pattern: /떡|약과|한과|양갱|인절미|송편|가래떡|모찌|\b(tteok|rice cake|mochi)\b/i,
    set: "a calm Korean traditional set: a dark wooden soban tray or a warm wooden table with a sheet of hanji paper, soft natural daylight, a muted beige backdrop",
    allow: "one small ceramic tea cup placed to the side",
  },
  {
    name: "a dessert or bakery item",
    pattern: /쿠키|마카롱|과자|빵|케이크|디저트|크루아상|타르트|파이|베이글|도넛|머핀|스콘|와플|롤케이크|생크림|크림치즈|휘핑|아이스크림|초콜릿|초코|잼|\b(cookie|cookies|macaron|bread|cake|dessert|croissant|tart|pie|bagel|donut|muffin|scone|waffle|chocolate|pastry)\b/i,
    set: "a premium patisserie set: a white marble surface and a soft warm cream studio backdrop, warm soft key light from the left",
    allow: "",
  },
  {
    name: "a drink",
    pattern: /커피|라떼|라테|아메리카노|녹차|홍차|밀크티|아이스티|허브티|에이드|주스|스무디|음료|맥주|와인|칵테일|하이볼|\b(coffee|latte|tea|ade|juice|smoothie|drink|beer|wine|cocktail)\b/i,
    set: "a bright café set: a light stone counter, soft window light, a softly blurred café interior far behind",
    allow: "",
  },
  {
    name: "hair or body care",
    pattern: /샴푸|린스|컨디셔너|트리트먼트|바디워시|바디로션|핸드워시|핸드크림|비누|입욕|\b(shampoo|conditioner|body wash|soap|hand cream)\b/i,
    set: "a fresh spa bathroom set: a wet white stone surface with a few clear water droplets, soft bright daylight, eucalyptus leaves softly out of focus far behind",
    allow: "",
  },
  {
    name: "skincare or make-up",
    pattern: /화장품|세럼|에센스|앰플|토너|로션|크림|스킨케어|선크림|쿠션|파운데이션|립스틱|립밤|틴트|향수|\b(cosmetic|cosmetics|serum|essence|toner|lotion|cream|skincare|sunscreen|lipstick|perfume)\b/i,
    set: "a natural beauty set: a smooth wet dark stone, soft sun rays, fresh green leaves softly out of focus behind",
    allow: "",
  },
  {
    name: "glasses or a fashion accessory",
    pattern: /안경|선글라스|렌즈|시계|지갑|가방|모자|액세서리|목걸이|반지|귀걸이|팔찌|주얼리|\b(glasses|sunglasses|eyewear|watch|wallet|bag|hat|accessory|necklace|ring|earring|bracelet|jewelry)\b/i,
    set: "a minimal fashion studio set: a smooth matte stone podium, soft directional light casting one crisp shadow, a plain neutral backdrop",
    allow: "",
  },
  {
    name: "an electronic gadget",
    pattern: /이어폰|헤드폰|헤드셋|스피커|충전기|보조배터리|케이블|키보드|마우스|스마트워치|폰케이스|케이스|\b(earphones?|earbuds?|headphones?|headset|speaker|charger|power bank|cable|keyboard|mouse|smartwatch|case)\b/i,
    set: "a sleek tech product set: a matte light-grey surface, a clean soft gradient backdrop, a subtle cool rim light and faint reflections",
    allow: "",
  },
  {
    name: "flowers",
    pattern: /꽃|플라워|부케|화분|식물|\b(flower|flowers|bouquet|plant)\b/i,
    set: "a bright florist set: a pale linen surface by a large bright window, airy soft daylight",
    allow: "",
  },
  {
    name: "a household item",
    pattern: /머그|컵|텀블러|그릇|접시|수건|생활용품|주방|캔들|디퓨저|\b(mug|cup|tumbler|bowl|plate|towel|kitchen|candle|diffuser)\b/i,
    set: "a clean lifestyle set: a light oak table by a sunny window, soft morning light",
    allow: "",
  },
]
const OTHER_SET = { name: "a product", set: "a clean studio set: a simple round podium and a soft gradient backdrop", allow: "" }

/** The set for this product from its words, or null when there are no words yet (the model then picks from the list). */
export function backgroundSetFor(details = {}) {
  const text = `${details.productName ?? ""} ${details.productDescription ?? ""} ${details.highlights ?? ""}`.trim()
  if (!text) return null
  return BACKGROUND_SETS.find(({ pattern }) => pattern.test(text)) ?? OTHER_SET
}

/**
 * The edit prompt (reviewed 2026-10-19 for every kind of product the owner plans: food, drinks, 떡, shampoo,
 * cosmetics, glasses, earphones …). Rules, in this order:
 * 1. What the product is: the item(s) sold PLUS whatever directly holds or presents them — plate, bowl, tray, board,
 *    cup, bottle, box, case, stand. Those stay (a disposable one may become a premium one of the same kind); only the
 *    setting around them changes. Food never lies directly on the table.
 * 2. The product is not redrawn: count, arrangement, colours, shapes.
 * 3. Camera angle: food and drinks move to an appetizing three-quarter view (owner's call 2026-10-19: a cutlet and
 *    sushi shot from straight above looked far better at an angle); other products keep the photo's angle, since a
 *    new angle makes the model redraw a design (glasses, earphones, labels).
 * 4. The set by kind (the matched one, or the whole list when no name is known yet), one fitting prop at most.
 * 5. Close-up framing (Flash-Lite drew the product small without it), light, nothing written.
 */
const FOOD_KINDS = new Set(["a meal", "Korean rice cakes or traditional sweets", "a dessert or bakery item", "a drink"])
const APPETIZING_ANGLE = "a three-quarter view from about 30–45 degrees above, the angle food advertisements use, even if the photo was taken from straight above"

function angleRule(chosen) {
  if (!chosen) return `Camera angle: for food and drinks, move the camera to the most appetizing advertising angle, ${APPETIZING_ANGLE}; any other product keeps the camera angle of the photo.`
  if (FOOD_KINDS.has(chosen.name)) return `Camera angle: move the camera to the most appetizing advertising angle for this food, ${APPETIZING_ANGLE}. Seen from the new angle, the food keeps its count, arrangement and look.`
  return "Keep the camera angle of the photo, so the product's design is not redrawn."
}

export function backgroundPrompt(details = {}) {
  const chosen = backgroundSetFor(details)
  const list = [...BACKGROUND_SETS, OTHER_SET].map(({ name, set }) => `${name}: ${set}`).join("; ")
  return [
    "Edit this product photo from a small local shop into a premium advertisement photo by changing ONLY the setting around the product.",
    "What counts as the product: the item or items being sold together with whatever directly holds or presents them in the photo — the plate, bowl, tray, board, cup, glass, bottle, box, case or stand. Keep all of these. If that holder is disposable or shabby (paper, foil, plastic wrap, a takeaway box), replace it with a simple premium one of the same kind, shape and size. Food is never placed directly on the table; it stays on its plate, bowl, tray or board.",
    "Remove everything else: the table or floor surface, cloths, unrelated objects, cables that are not part of the product, bags, receipts, other dishes and drinks, hands and people. If a hand holds the product, show the product resting naturally on the surface instead.",
    "The product must stay exactly as photographed: the same number of items, the same arrangement, the same colours (a white item stays white, a pale item stays pale), the same shapes, fillings, toppings, textures, labels and surface marks. Do not redraw, tidy, recolour, complete or add any item; a single shell, slice or piece stays exactly that.",
    angleRule(chosen),
    chosen
      ? `This product is ${chosen.name}. Use this advertising set: ${chosen.set}.`
      : `Use the advertising set that suits what the product is: ${list}.`,
    chosen?.allow
      ? `Add nothing else, except at most ${chosen.allow}.`
      : "Add no extra props, fruit, flowers, garnish, cutlery or decorations that are not in the photo.",
    "Remove any watermark, caption or text that is not printed on the product itself.",
    // Close-up wording (2026-10-19): with "about 60% of the frame width" Flash-Lite drew the product at 25–30%.
    "Framing: a tight close-up product shot, the camera close to the product. The product with its plate, case or stand fills about 75% of the frame width and is the clear hero of the picture, centred, its top about 20% from the top of the frame; do not show a wide empty table or a large empty backdrop. Only the lowest fifth of the frame is a calm, plain surface with no objects (text is added there later).",
    "Lit like a high-end commercial: a soft key light, a gentle rim light along the product's edge, natural reflections, photorealistic, the product sharp.",
    "Do not add any people, text, letters, logos or watermarks.",
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
  if (!paidKeyFits(reserveFor(config.model))) throw new ApiError(429, "BACKGROUND_DAILY_LIMIT")
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
  addToLedger(pictureCostKrw(usage, config.model))
  const picture = (data?.candidates?.[0]?.content?.parts ?? []).find((part) => part?.inlineData?.data)?.inlineData
  if (!picture || !/^image\/(png|jpeg|webp)$/.test(picture.mimeType ?? "")) throw new ApiError(502, "AI_BAD_RESPONSE")
  const result = { image: { mimeType: picture.mimeType, data: picture.data } }
  remember(idempotencyKey, result)
  return result
}
