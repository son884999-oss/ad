// Verifies the 고급형 "배경 바꾸기" server functions (api/scene-start.js, api/scene-status.js) WITHOUT any real
// network call or spend: global fetch is stubbed to act as Higgsfield and its CDN.
// Usage: node scripts/verify-scene-api.mjs
import assert from "node:assert/strict"
import { Readable } from "node:stream"
import sceneStart from "../api/scene-start.js"
import sceneStatus from "../api/scene-status.js"
import { scenePrompt } from "../api/_lib/scene.js"

const results = []
async function check(name, fn) {
  await fn()
  results.push(name)
  console.log("ok -", name)
}
function request(method, body, { url = "/api/x" } = {}) {
  const raw = body === undefined ? "" : JSON.stringify(body)
  const req = Readable.from(raw ? [Buffer.from(raw)] : [])
  req.method = method
  req.url = url
  req.headers = { "content-type": "application/json", "content-length": String(Buffer.byteLength(raw)) }
  return req
}
async function call(handler, req) {
  const res = { statusCode: 200, headers: {}, body: "", setHeader(k, v) { this.headers[k.toLowerCase()] = v }, end(b) { this.body = b ?? "" } }
  await handler(req, res)
  return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null }
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })
const REQ_ID = "a1b2c3d4-1111-4222-8333-944455556666"
const PICTURE = Buffer.from("fake-png-bytes")
const sent = []
let providerStatus = { status: "queued" }
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  sent.push({ url, init })
  if (url === "https://api.higgsfield.ai/files/generate-upload-url") return json({ upload_url: "https://storage.example.com/put", public_url: "https://cdn.example.com/in/photo.jpg" })
  if (url.startsWith("https://storage.example.com/")) return new Response(null, { status: 200 })
  if (/\/requests\/[^/]+\/status$/.test(url)) return json(providerStatus)
  if (url === "https://cdn.example.com/out/scene.png") return new Response(PICTURE, { status: 200, headers: { "content-type": "image/png" } })
  if (url.startsWith("https://api.higgsfield.ai/")) return json({ status: "queued", request_id: REQ_ID })
  throw new Error(`unexpected fetch ${url}`)
}
const body = {
  image: { mimeType: "image/jpeg", data: Buffer.alloc(30, 7).toString("base64") },
  details: { productName: "수제 초코 케이크", productDescription: "생크림과 초콜릿을 층층이" },
  idempotencyKey: "scene-1234567890abcdef",
}
const statusReq = (id = REQ_ID) => request("GET", undefined, { url: `/api/scene-status?id=${id}` })

await check("paid switch off (no VIDEO_ENABLED) → 503 VIDEO_NOT_CONFIGURED, zero fetch", async () => {
  delete process.env.VIDEO_ENABLED
  process.env.HF_CREDENTIALS = "id:secret"
  sent.length = 0
  assert.equal((await call(sceneStart, request("POST", body))).json.error, "VIDEO_NOT_CONFIGURED")
  assert.equal((await call(sceneStatus, statusReq())).json.error, "VIDEO_NOT_CONFIGURED")
  assert.equal(sent.length, 0)
})

process.env.VIDEO_ENABLED = "1"
await check("start: upload → PUT → ONE submit to Qwen Image 3 edit, 9:16, same idempotency key", async () => {
  sent.length = 0
  const r = await call(sceneStart, request("POST", body))
  assert.equal(r.status, 200)
  assert.deepEqual(r.json, { requestId: REQ_ID })
  const submits = sent.filter(({ url }) => url === "https://api.higgsfield.ai/alibaba/qwen-image-3/edit")
  assert.equal(submits.length, 1)
  const input = JSON.parse(submits[0].init.body)
  assert.deepEqual(input.image_urls, ["https://cdn.example.com/in/photo.jpg"])
  assert.equal(input.aspect_ratio, "9:16")
  assert.equal(new Headers(submits[0].init.headers).get("Idempotency-Key"), body.idempotencyKey)
  assert.match(input.prompt, /Keep the product exactly as it is/)
  assert.match(input.prompt, /Do not add any text, letters, words, logos, labels or watermarks/)
})

await check("prompt: scene by product group (food / beauty / flowers / household / general)", async () => {
  assert.match(scenePrompt({ productName: "수제 초코 케이크" }), /premium food advertisement/)
  assert.match(scenePrompt({ productName: "천연 수제 비누" }), /natural beauty advertisement/)
  assert.match(scenePrompt({ productName: "꽃다발" }), /florist studio/)
  assert.match(scenePrompt({ productName: "텀블러" }), /lifestyle advertisement/)
  assert.match(scenePrompt({ productName: "가죽 지갑" }), /clean studio advertisement/)
})

await check("input: no product name / bad key → 400, zero submit", async () => {
  sent.length = 0
  assert.equal((await call(sceneStart, request("POST", { ...body, details: {} }))).status, 400)
  assert.equal((await call(sceneStart, request("POST", { ...body, idempotencyKey: "short" }))).status, 400)
  assert.equal(sent.length, 0)
})

await check("status: queued passes through; completed → the picture inline (base64)", async () => {
  providerStatus = { status: "queued" }
  assert.deepEqual((await call(sceneStatus, statusReq())).json, { status: "queued" })
  providerStatus = { status: "completed", images: [{ url: "https://cdn.example.com/out/scene.png" }] }
  const r = await call(sceneStatus, statusReq())
  assert.equal(r.json.status, "completed")
  assert.equal(r.json.image.mimeType, "image/png")
  assert.equal(Buffer.from(r.json.image.data, "base64").toString(), "fake-png-bytes")
})

await check("status: failed / nsfw → safe codes; bad id → 400", async () => {
  providerStatus = { status: "nsfw" }
  assert.deepEqual((await call(sceneStatus, statusReq())).json, { status: "failed", error: "VIDEO_BLOCKED" })
  providerStatus = { status: "failed" }
  assert.deepEqual((await call(sceneStatus, statusReq())).json, { status: "failed", error: "VIDEO_FAILED" })
  assert.equal((await call(sceneStatus, statusReq("nope"))).status, 400)
})

console.log(`PASS: verify-scene-api ${results.length} checks (stubbed Higgsfield, no spend)`)
