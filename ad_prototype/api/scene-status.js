// GET /api/scene-status?id=<requestId> — one status check of a 고급형 scene picture (free; poll every ~4 s).
// Response: 200 { status: "queued"|"in_progress"|"failed", error? } | { status: "completed", image: { mimeType, data } }
import { sceneStatusHandler } from "./_lib/scene.js"

export default sceneStatusHandler
