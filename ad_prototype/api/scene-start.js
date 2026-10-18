// POST /api/scene-start — 고급형 "배경 바꾸기": starts ONE paid image edit (product kept, new advertising scene,
// 9:16) and returns at once. Request: { image: { mimeType, data }, details: { productName, productDescription?,
// highlights? }, idempotencyKey? }. Response: 200 { requestId } | 4xx/5xx { error } (503 VIDEO_NOT_CONFIGURED:
// paid generation is switched off, no network call). See api/_lib/scene.js.
import { createJsonHandler } from "./_lib/http.js"
import { getHiggsfieldConfig } from "./_lib/higgsfield.js"
import { checkPremiumAccess, withDailyPaid } from "./_lib/paid.js"
import { normalizeSceneInput, startScene } from "./_lib/scene.js"

export default createJsonHandler({
  // Each call is one paid picture: at most 3 per minute per address.
  bucket: "scene-start",
  perMinute: 3,
  // Paid switch first, then the demo access code (when set) and today's cap (api/_lib/paid.js).
  prepare: (req) => {
    const config = getHiggsfieldConfig()
    checkPremiumAccess(req)
    return config
  },
  run: (body, config) => {
    const input = normalizeSceneInput(body)
    return withDailyPaid("scene", () => startScene(input, config))
  },
})
