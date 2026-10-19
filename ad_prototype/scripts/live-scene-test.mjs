// MANUAL, PAID live test for the 고급형 "배경 바꾸기" idea: ONE image edit on Higgsfield (Qwen Image 3 edit) that keeps
// the product and puts it in a new advertising scene, 9:16. The resulting picture can then be animated with
// scripts/live-video-test.mjs (one more paid clip). Without --yes-spend it only prints what it would do.
//
//   node scripts/live-scene-test.mjs --yes-spend photo.jpg --scene "…" --out scene.jpg
//
// Reads HF_CREDENTIALS from the environment or .env.local. Never prints credentials. Never retries a submit.
import { readFile, writeFile } from "node:fs/promises"
import { extname, resolve } from "node:path"
import { getHiggsfieldConfig, HF_BASE, submitVideo, uploadImage } from "../api/_lib/higgsfield.js"

const args = process.argv.slice(2)
const flag = (name) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args.splice(index, 2)[1]
}
const spend = args.includes("--yes-spend")
const scene = flag("--scene") ?? ""
const out = flag("--out") ?? "scene.jpg"
const photoPath = resolve(args.find((arg) => !arg.startsWith("--")) ?? "")
const mimeType = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[extname(photoPath).toLowerCase()]
const MODEL = "alibaba/qwen-image-3/edit"

// The product must come through untouched; only the setting changes. Text is never asked for (it is added later).
const prompt = [
  "Keep the product exactly as it is in the photo: the same shape, size, colours, surface details and any printed text or logo, unchanged.",
  "Replace only the surroundings with this advertising scene:",
  scene,
  "Photorealistic commercial product photography, the product sharp and centred in the lower middle of a vertical frame, soft natural light consistent across product and scene.",
  "Do not add any text, letters, words, logos, labels or watermarks anywhere.",
].join(" ")

for (const line of (await readFile(resolve(".env.local"), "utf8").catch(() => "")).split(/\r?\n/)) {
  const match = /^\s*(HF_CREDENTIALS)\s*=\s*(.*?)\s*$/.exec(line)
  if (match && match[2] && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "")
}
process.env.VIDEO_ENABLED = "1" // this script is the explicit way to spend, like live-video-test.mjs
let config
try {
  config = getHiggsfieldConfig()
} catch {
  console.error("HF_CREDENTIALS가 없거나 형식이 틀렸어요.")
  process.exit(1)
}
if (!mimeType || !scene) {
  console.error("사진(.jpg/.png/.webp)과 --scene \"장면 설명\"이 필요해요.")
  process.exit(1)
}
console.log(`model=${MODEL} photo=${photoPath}\nprompt=${prompt}`)
if (!spend) {
  console.log("DRY RUN: 실제 요청을 보내지 않았어요. 유료 1회를 하려면 --yes-spend 를 붙여 주세요.")
  process.exit(0)
}

const imageUrl = await uploadImage(config, { mimeType, bytes: await readFile(photoPath) })
const requestId = await submitVideo({ ...config, model: MODEL }, { prompt, image_urls: [imageUrl], aspect_ratio: "9:16", resolution: "1k" }, crypto.randomUUID())
console.log("requestId:", requestId)
const startedAt = Date.now()
while (Date.now() - startedAt < 5 * 60_000) {
  await new Promise((done) => setTimeout(done, 4000))
  const response = await fetch(`${HF_BASE}/requests/${requestId}/status`, { headers: { Authorization: `Key ${config.credentials}` } })
  const data = await response.json().catch(() => null)
  const status = data?.status ?? `HTTP_${response.status}`
  console.log(`${Math.round((Date.now() - startedAt) / 1000)}s ${status}`)
  if (status === "completed") {
    const url = data?.images?.[0]?.url
    if (!url) break
    const image = await fetch(url)
    await writeFile(out, Buffer.from(await image.arrayBuffer()))
    console.log("saved:", resolve(out))
    process.exit(0)
  }
  if (["failed", "nsfw", "canceled", "cancelled"].includes(status)) break
}
console.error("장면 이미지를 받지 못했어요 — 자동으로 다시 보내지 않아요.")
process.exit(1)
