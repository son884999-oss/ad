// POST /api/video-start — starts ONE paid image-to-video job on Higgsfield and returns immediately.
// Prompt: E_이채원 direction rules (optionally refined by Gemini, ≤ 6 s, silent fallback).
// Request:  { image: { mimeType: "image/jpeg"|"image/png"|"image/webp", data: "<base64 ≤ 4 MiB>" },
//             details: { productName, productDescription?, highlights?, keyFeatures?, targetAudience?,
//                        tones?: string[], shopName? }, idempotencyKey?: string (16–64 [A-Za-z0-9-]) }
// Response: 200 { requestId, videoPrompt, duration }
//           4xx/5xx { error: "VIDEO_NOT_CONFIGURED" (503, no network call) | "INVALID_INPUT" | "VIDEO_BUSY" |
//                     "VIDEO_NO_CREDITS" | "VIDEO_AUTH_FAILED" | "VIDEO_TIMEOUT" | ... }
import { createJsonHandler } from "./_lib/http.js"
import { getHiggsfieldConfig } from "./_lib/higgsfield.js"
import { checkPremiumAccess, withDailyPaid } from "./_lib/paid.js"
import { normalizeVideoInput, startVideo } from "./_lib/video.js"

export default createJsonHandler({
  // Each call is one paid clip: at most 3 per minute per address.
  bucket: "video-start",
  perMinute: 3,
  // Paid switch first, then the demo access code (when set) and today's cap (api/_lib/paid.js).
  prepare: (req) => {
    const config = getHiggsfieldConfig()
    checkPremiumAccess(req)
    return config
  },
  run: (body, config) => {
    const input = normalizeVideoInput(body)
    return withDailyPaid("video", () => startVideo(input, config))
  },
})
