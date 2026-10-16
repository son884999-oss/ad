// Checks the shared /api guard (api/_lib/http.js): other-site Origin refused, per-address rate limit,
// and that the paid video start has the strictest cap. No network calls: the handlers stop before them.
// Usage: node scripts/verify-api-guard.mjs
import assert from "node:assert/strict"
import { Readable } from "node:stream"
import { createJsonHandler } from "../api/_lib/http.js"

const results = []
async function check(name, fn) {
  await fn()
  results.push(name)
  console.log("ok -", name)
}
function call(handler, { origin, host = "app.example", ip = "203.0.113.7" } = {}) {
  const req = Readable.from([Buffer.from("{}")])
  req.method = "POST"
  req.headers = { "content-type": "application/json", host, ...(origin ? { origin } : {}), ...(ip ? { "x-forwarded-for": ip } : {}) }
  return new Promise((resolve) => {
    const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(body) { resolve({ status: this.statusCode, body: JSON.parse(body) }) } }
    handler(req, res)
  })
}
const ok = createJsonHandler({ bucket: "test", perMinute: 3, run: async () => ({ ok: true }) })

await check("same-site Origin and no Origin are accepted", async () => {
  assert.equal((await call(ok, { origin: "https://app.example", ip: "198.51.100.1" })).status, 200)
  assert.equal((await call(ok, { ip: "198.51.100.2" })).status, 200)
})
await check("another site's Origin is refused with 403 FORBIDDEN_ORIGIN", async () => {
  const result = await call(ok, { origin: "https://evil.example", ip: "198.51.100.3" })
  assert.equal(result.status, 403)
  assert.equal(result.body.error, "FORBIDDEN_ORIGIN")
  assert.equal((await call(ok, { origin: "not a url", ip: "198.51.100.3" })).status, 403)
})
await check("ALLOWED_ORIGINS adds an origin", async () => {
  process.env.ALLOWED_ORIGINS = "https://shop.example"
  assert.equal((await call(ok, { origin: "https://shop.example", ip: "198.51.100.4" })).status, 200)
  delete process.env.ALLOWED_ORIGINS
})
await check("the 4th call in a minute from one address gets 429 RATE_LIMITED; other addresses are not affected", async () => {
  for (let i = 0; i < 3; i += 1) assert.equal((await call(ok, { ip: "192.0.2.9" })).status, 200)
  const limited = await call(ok, { ip: "192.0.2.9" })
  assert.equal(limited.status, 429)
  assert.equal(limited.body.error, "RATE_LIMITED")
  assert.equal((await call(ok, { ip: "192.0.2.10" })).status, 200)
})
await check("video-start caps at 3 per minute; promo-text at 20", async () => {
  const fs = await import("node:fs/promises")
  assert.match(await fs.readFile(new URL("../api/video-start.js", import.meta.url), "utf8"), /perMinute: 3/)
  assert.match(await fs.readFile(new URL("../api/promo-text.js", import.meta.url), "utf8"), /perMinute: 20/)
})
console.log(`PASS: verify-api-guard ${results.length} checks (origin, rate limit)`)
