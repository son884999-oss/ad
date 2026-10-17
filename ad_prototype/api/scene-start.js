// POST /api/scene-start — 고급형 "배경 바꾸기": starts ONE paid image edit (product kept, new advertising scene,
// 9:16) and returns at once. Request: { image: { mimeType, data }, details: { productName, productDescription?,
// highlights? }, idempotencyKey? }. Response: 200 { requestId } | 4xx/5xx { error } (503 VIDEO_NOT_CONFIGURED:
// paid generation is switched off, no network call). See api/_lib/scene.js.
import { createJsonHandler } from "./_lib/http.js"
import { getHiggsfieldConfig } from "./_lib/higgsfield.js"
import { normalizeSceneInput, startScene } from "./_lib/scene.js"

export default createJsonHandler({
  // Each call is one paid picture: at most 3 per minute per address.
  bucket: "scene-start",
  perMinute: 3,
  prepare: getHiggsfieldConfig,
  run: (body, config) => startScene(normalizeSceneInput(body), config),
})
