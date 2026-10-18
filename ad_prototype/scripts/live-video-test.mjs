// MANUAL, PAID live test: ONE real Higgsfield image-to-video generation (default 5 s, ≈ $0.21 for
// Kling 2.5 Turbo at list price). Runs the same server code as /api/video-start and /api/video-status.
// Without --yes-spend it only prints what it would do and makes no network request.
//
//   node scripts/live-video-test.mjs --yes-spend [photo.jpg|png|webp] [--name "제품 이름"] [--out clip.mp4] [--concept]
//
// --concept sends the 고급형 film (style "concept", api/_lib/video-prompt.js conceptPrompt) instead of the push-in.
//
// Reads HF_CREDENTIALS (and optional HF_VIDEO_MODEL / HF_VIDEO_DURATION / HF_VIDEO_RESOLUTION / GEMINI_*) from the
// environment or .env.local. Never prints credentials. Never retries a submit.
import { readFile, writeFile } from "node:fs/promises"
import { extname, resolve } from "node:path"
import { getHiggsfieldConfig, getVideoStatus } from "../api/_lib/higgsfield.js"
import { normalizeVideoInput, startVideo } from "../api/_lib/video.js"

const args = process.argv.slice(2)
const flag = (name) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args.splice(index, 2)[1]
}
const spend = args.includes("--yes-spend")
const concept = args.includes("--concept")
const name = flag("--name") ?? "수제 커피"
const out = flag("--out")
const photoPath = resolve(args.find((arg) => !arg.startsWith("--")) ?? "public/assets/reference-fresh/coffee.webp")
const mimeType = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[extname(photoPath).toLowerCase()]

async function loadEnvLocal() {
  let text = ""
  try {
    text = await readFile(resolve(".env.local"), "utf8")
  } catch {
    return
  }
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(VIDEO_ENABLED|HF_CREDENTIALS|HF_VIDEO_MODEL|HF_VIDEO_DURATION|HF_VIDEO_RESOLUTION|GEMINI_API_KEY|GEMINI_API_KEY_2|GEMINI_MODEL)\s*=\s*(.*?)\s*$/.exec(line)
    if (match && match[2] && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "")
  }
}

await loadEnvLocal()
// This script is the explicit way to make one paid clip (--yes-spend below), so it turns the server switch on itself.
process.env.VIDEO_ENABLED = "1"
let config
try {
  config = getHiggsfieldConfig()
} catch {
  console.error("HF_CREDENTIALS가 없거나 형식이 틀렸어요 (KEY_ID:KEY_SECRET). .env.local을 확인해 주세요.")
  process.exit(1)
}
if (!mimeType) {
  console.error("사진은 .jpg/.jpeg/.png/.webp만 쓸 수 있어요:", photoPath)
  process.exit(1)
}
console.log(`model=${config.model} duration=${config.duration}s photo=${photoPath} name=${name} style=${concept ? "concept" : "portrait"}`)
if (!spend) {
  console.log("DRY RUN: 실제 요청을 보내지 않았어요. 유료 생성 1회를 하려면 --yes-spend 를 붙여 주세요.")
  process.exit(0)
}

const photo = await readFile(photoPath)
const input = normalizeVideoInput({ image: { mimeType, data: photo.toString("base64") }, details: { productName: name, ...(concept ? { style: "concept" } : {}) } })
console.log("1회 생성 요청을 보내요…")
let started
try {
  started = await startVideo(input, config)
} catch (error) {
  console.error("시작 실패:", error?.code ?? "UNKNOWN", "— 자동으로 다시 보내지 않아요.")
  process.exit(1)
}
console.log("requestId:", started.requestId)
console.log("videoPrompt:", started.videoPrompt)

const startedAt = Date.now()
let delay = 5_000
while (Date.now() - startedAt < 10 * 60_000) {
  await new Promise((done) => setTimeout(done, delay))
  let status
  try {
    status = await getVideoStatus(config, started.requestId)
  } catch (error) {
    console.log("상태 확인 실패 (다시 확인해요):", error?.code ?? "UNKNOWN")
    delay = Math.min(20_000, Math.round(delay * 1.5))
    continue
  }
  delay = 5_000
  console.log(`${Math.round((Date.now() - startedAt) / 1000)}s`, status.status)
  if (status.status === "completed") {
    console.log("videoUrl:", status.videoUrl)
    if (out) {
      const response = await fetch(status.videoUrl)
      if (!response.ok) throw new Error(`DOWNLOAD_HTTP_${response.status}`)
      await writeFile(resolve(out), Buffer.from(await response.arrayBuffer()))
      console.log("saved:", resolve(out))
    }
    process.exit(0)
  }
  if (status.status === "failed") {
    console.error("생성 실패:", status.error, "— 자동으로 다시 만들지 않아요.")
    process.exit(1)
  }
}
console.error(`10분 안에 끝나지 않았어요. 나중에 requestId ${started.requestId} 로 상태를 확인해 주세요.`)
process.exit(1)
