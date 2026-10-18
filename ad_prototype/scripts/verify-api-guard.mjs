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
await check("PREMIUM_ACCESS_CODE: without the right x-premium-code a paid start answers like paid-off (503 VIDEO_NOT_CONFIGURED)", async () => {
  const { checkPremiumAccess } = await import("../api/_lib/paid.js")
  const req = (code) => ({ headers: code === undefined ? {} : { "x-premium-code": code } })
  delete process.env.PREMIUM_ACCESS_CODE
  checkPremiumAccess(req()) // no code set: open
  process.env.PREMIUM_ACCESS_CODE = "dalbit-demo-7"
  try {
    for (const sent of [undefined, "", "dalbit-demo-8", "dalbit-demo-77"]) {
      assert.throws(() => checkPremiumAccess(req(sent)), (error) => error.status === 503 && error.code === "VIDEO_NOT_CONFIGURED")
    }
    checkPremiumAccess(req("dalbit-demo-7"))
    checkPremiumAccess(req(" dalbit-demo-7 "))
  } finally {
    delete process.env.PREMIUM_ACCESS_CODE
  }
})
await check("DAILY_PAID_LIMIT (default 5): the 6th paid start of a kind today gets 429 VIDEO_DAILY_LIMIT; a failed start gives its place back", async () => {
  const { withDailyPaid, resetPaidCounters, dailyPaidLimit } = await import("../api/_lib/paid.js")
  resetPaidCounters()
  delete process.env.DAILY_PAID_LIMIT
  assert.equal(dailyPaidLimit(), 5)
  await assert.rejects(withDailyPaid("video", async () => { throw new Error("provider down") }), /provider down/)
  for (let i = 0; i < 5; i += 1) assert.deepEqual(await withDailyPaid("video", async () => ({ requestId: `r${i}` })), { requestId: `r${i}` })
  await assert.rejects(withDailyPaid("video", async () => ({})), (error) => error.status === 429 && error.code === "VIDEO_DAILY_LIMIT")
  assert.deepEqual(await withDailyPaid("scene", async () => ({ requestId: "s" })), { requestId: "s" }, "each kind has its own count")
  process.env.DAILY_PAID_LIMIT = "0"
  resetPaidCounters()
  await assert.rejects(withDailyPaid("scene", async () => ({})), (error) => error.code === "VIDEO_DAILY_LIMIT", "0 turns paid jobs off")
  process.env.DAILY_PAID_LIMIT = "abc"
  assert.equal(dailyPaidLimit(), 5, "a bad value falls back to 5")
  delete process.env.DAILY_PAID_LIMIT
  resetPaidCounters()
})
await check("scene-start and video-start use both guards", async () => {
  const fs = await import("node:fs/promises")
  for (const [file, kind] of [["video-start.js", "video"], ["scene-start.js", "scene"]]) {
    const source = await fs.readFile(new URL(`../api/${file}`, import.meta.url), "utf8")
    assert.match(source, /checkPremiumAccess\(req\)/, file)
    assert.match(source, new RegExp(`withDailyPaid\\("${kind}"`), file)
  }
})
console.log(`PASS: verify-api-guard ${results.length} checks (origin, rate limit, demo access code, daily paid cap)`)
