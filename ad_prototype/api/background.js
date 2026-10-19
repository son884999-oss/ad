// POST /api/background — 배경 바꾸기: ONE Gemini image edit that keeps the product and replaces its surroundings
// with an advertising set (9:16). Request: { image: { mimeType, data }, details?: { productName?, productDescription?,
// highlights? }, idempotencyKey? }. Response: 200 { image: { mimeType, data } } | 4xx/5xx { error }
// (429 BACKGROUND_DAILY_LIMIT: today's ₩ cap on the paid key is used up; the app keeps the original photo).
// See api/_lib/background.js.
import { getBackgroundConfig, makeBackground, normalizeBackgroundInput } from "./_lib/background.js"
import { createJsonHandler } from "./_lib/http.js"

export default createJsonHandler({
  // Each call is one paid picture: at most 3 per minute per address.
  bucket: "background",
  perMinute: 3,
  prepare: getBackgroundConfig,
  run: (body, config) => makeBackground(normalizeBackgroundInput(body), config),
})
