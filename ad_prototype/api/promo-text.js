// POST /api/promo-text — 홍보 글 (광고 카피 · SNS 홍보문구 · 제품 소개 · 해시태그) with Gemini.
// Prompt rules ported from B_이창훈/prompt.mjs, review/rewrite flow from B_이창훈/promo.mjs.
// Request:  { productName, productDescription?, highlights?, keyFeatures?: string[] | string,
//             targetAudience?, tones?: string[], shopName?, location?, priceInfo?, contact?, channel?,
//             visualDetails?: string[] }
//           (location / priceInfo / contact: up to 60 characters each; visualDetails: ≤5 items, ≤30 characters
//            each — the analyze-photo answer, used as <photo> scene material in the prompt)
// Response: 200 { copy, sns, intro, hashtags: string[] (3–5, without "#"),
//                 copyCandidates: string[] (0–3, ≤60 chars), videoHeadline (≤16 chars), cta (≤14 chars or "") }
//           4xx/5xx { error: "AI_NOT_CONFIGURED" | "INVALID_INPUT" | "AI_TIMEOUT" | ... }
import { createJsonHandler } from "./_lib/http.js"
import { getGeminiConfig } from "./_lib/gemini.js"
import { generatePromo, normalizePromoInput } from "./_lib/promo.js"

export default createJsonHandler({
  bucket: "promo-text",
  perMinute: 20,
  prepare: getGeminiConfig,
  run: (body, config) => generatePromo(normalizePromoInput(body), config),
})
