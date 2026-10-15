// POST /api/promo-text — 홍보 글 (광고 카피 · SNS 홍보문구 · 제품 소개 · 해시태그) with Gemini.
// Prompt rules ported from B_이창훈/prompt.mjs, review/rewrite flow from B_이창훈/promo.mjs.
// Request:  { productName, productDescription?, highlights?, keyFeatures?: string[] | string,
//             targetAudience?, tones?: string[], shopName?, channel? }
// Response: 200 { copy, sns, intro, hashtags: string[] (without "#") }
//           4xx/5xx { error: "AI_NOT_CONFIGURED" | "INVALID_INPUT" | "AI_TIMEOUT" | ... }
import { createJsonHandler } from "./_lib/http.js"
import { getGeminiConfig } from "./_lib/gemini.js"
import { generatePromo, normalizePromoInput } from "./_lib/promo.js"

export default createJsonHandler({
  prepare: getGeminiConfig,
  run: (body, config) => generatePromo(normalizePromoInput(body), config),
})
