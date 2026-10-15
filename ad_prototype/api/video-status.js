// GET /api/video-status?id=<requestId> — one status check of a Higgsfield job (free; poll every ~5 s).
// Response: 200 { status: "queued"|"in_progress"|"completed"|"failed", videoUrl?, error? }
//           error codes on failed: VIDEO_FAILED | VIDEO_BLOCKED (nsfw) | VIDEO_CANCELED | VIDEO_NO_OUTPUT | VIDEO_NOT_FOUND
//           4xx/5xx { error: "VIDEO_NOT_CONFIGURED" | "INVALID_ID" | "METHOD_NOT_ALLOWED" | ... }
import { videoStatusHandler } from "./_lib/video.js"

export default videoStatusHandler
