// POST /api/analyze-photo — suggests 정보 입력 fields from one product photo (Gemini).
// Request:  { "image": { "mimeType": "image/jpeg" | "image/png" | "image/webp", "data": "<base64>" } }
// Response: 200 { productName, description, highlights, keyFeatures: string[], targetAudience,
//                 mediaHeadline, mediaCta (≤16 chars each, for the poster and the video; "" when unsure),
//                 tones: ("natural"|"premium"|"friendly"|"trendy")[],
//                 visualDetails: string[] (0–5 short phrases, ≤30 chars: color, texture, plating, setting),
//                 photoCheck: { isRealPhoto: boolean, isBlurry: boolean, reason: string } }
//           4xx/5xx { error: "AI_NOT_CONFIGURED" | "METHOD_NOT_ALLOWED" | "IMAGE_TOO_LARGE" | ... }
import { createJsonHandler } from "./_lib/http.js"
import { getGeminiConfig } from "./_lib/gemini.js"
import { analyzeProductPhoto, readImageInput } from "./_lib/photo.js"

export default createJsonHandler({
  prepare: getGeminiConfig,
  run: (body, config) => analyzeProductPhoto(readImageInput(body), config),
})
