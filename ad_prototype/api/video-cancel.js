// POST /api/video-cancel { id } — cancels a Higgsfield job that has not started yet (refunded).
// Response: 200 { canceled: boolean } | 4xx/5xx { error }
import { createJsonHandler } from "./_lib/http.js"
import { getHiggsfieldConfig } from "./_lib/higgsfield.js"
import { cancelVideoRequest } from "./_lib/video.js"

export default createJsonHandler({
  prepare: getHiggsfieldConfig,
  run: (body, config) => cancelVideoRequest(body, config),
})
