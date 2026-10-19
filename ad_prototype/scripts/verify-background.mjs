// Verifies 배경 바꾸기 (plan C) without spending: the server module with a stubbed Gemini, and the app flow in
// Edge with /api/background answered by the demo scene picture. Usage: node scripts/verify-background.mjs [baseUrl]
import assert from "node:assert/strict"
import { readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { Readable } from "node:stream"
import { chromium } from "playwright"
import { backgroundPrompt, makeBackground } from "../api/_lib/background.js"
import backgroundHandler from "../api/background.js"
import { BACKUP_DAILY_LIMIT_KRW, backupSpentToday } from "../api/_lib/gemini.js"

const base = process.argv[2] || "http://127.0.0.1:5173/"
const results = []
async function check(name, fn) {
  await fn()
  results.push(name)
  console.log("ok -", name)
}

// ---------- Part 1: server ----------
const ledger = join(tmpdir(), `hongboitda-bg-${process.pid}.json`)
process.env.GEMINI_KEY2_LEDGER = ledger
const sent = []
let reply = () => new Response("{}", { status: 500 })
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  sent.push({ url: String(url), init })
  return reply(url, init)
}
const picture = (extra = {}) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/jpeg", data: "QUJD" } }] } }], usageMetadata: { promptTokenCount: 1300, candidatesTokenCount: 1300, candidatesTokensDetails: [{ modality: "IMAGE", tokenCount: 1120 }, { modality: "TEXT", tokenCount: 180 }] }, ...extra }), { status: 200 })
const image = { mimeType: "image/jpeg", data: Buffer.alloc(40, 9).toString("base64") }
const config = { apiKey: "paid-key", model: "gemini-3.1-flash-image" }
function request(method, body) {
  const raw = body === undefined ? "" : JSON.stringify(body)
  const req = Readable.from(raw ? [Buffer.from(raw)] : [])
  req.method = method
  req.headers = { "content-type": "application/json", "content-length": String(Buffer.byteLength(raw)) }
  return req
}
async function call(handler, req) {
  const res = { statusCode: 200, headers: {}, body: "", setHeader(k, v) { this.headers[k.toLowerCase()] = v }, end(b) { this.body = b ?? "" } }
  await handler(req, res)
  return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null }
}

try {
  await check("prompt: product rules first (count, arrangement, colours, no completing a lone piece), no text, lower quarter clear", async () => {
    const prompt = backgroundPrompt({})
    assert.match(prompt, /same number of items, the same arrangement/)
    assert.match(prompt, /a white item stays white/)
    assert.match(prompt, /a single shell, slice or piece stays exactly that/)
    assert.match(prompt, /Remove any watermark/)
    assert.match(prompt, /lower quarter is a calm, plain surface/)
    // No name yet: the model picks the set from the photo; with a known food it gets the food set.
    assert.match(prompt, /food or drinks: a white marble surface/)
    assert.match(backgroundPrompt({ productName: "수제 마카롱" }), /premium food advertisement set/)
  })

  await check("one call: the paid key, the image model, 9:16 picture back; the ledger is charged from the usage", async () => {
    reply = () => picture()
    sent.length = 0
    const before = backupSpentToday()
    const r = await makeBackground({ image, details: {}, idempotencyKey: "" }, config)
    assert.deepEqual(r, { image: { mimeType: "image/jpeg", data: "QUJD" } })
    assert.equal(sent.length, 1)
    assert.match(sent[0].url, /models\/gemini-3\.1-flash-image:generateContent$/)
    assert.equal(sent[0].init.headers["x-goog-api-key"], "paid-key")
    const body = JSON.parse(sent[0].init.body)
    assert.deepEqual(body.generationConfig, { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } })
    assert.equal(body.contents[0].parts[0].inlineData.data, image.data)
    const spent = backupSpentToday() - before
    // Official prices: 1,120 image tokens × $60/1M + 180 text × $3/1M + 1,300 input × $0.5/1M = $0.0688 → ₩103 at ₩1,500
    assert.ok(spent > 101 && spent < 105, `charged ₩${spent}`)
  })

  await check("same idempotency key again → the same picture, no second call (no second charge)", async () => {
    reply = () => picture()
    sent.length = 0
    const key = "bg-1234abcd-5678-retry"
    await makeBackground({ image, details: {}, idempotencyKey: key }, config)
    const again = await makeBackground({ image, details: {}, idempotencyKey: key }, config)
    assert.equal(again.image.data, "QUJD")
    assert.equal(sent.length, 1)
  })

  await check("today's cap reached → 429 BACKGROUND_DAILY_LIMIT and no call", async () => {
    const { writeFileSync } = await import("node:fs")
    writeFileSync(ledger, JSON.stringify({ day: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }), krw: BACKUP_DAILY_LIMIT_KRW - 20 }))
    sent.length = 0
    await assert.rejects(makeBackground({ image, details: {}, idempotencyKey: "" }, config), (e) => e.status === 429 && e.code === "BACKGROUND_DAILY_LIMIT")
    assert.equal(sent.length, 0)
    rmSync(ledger, { force: true })
  })

  await check("no picture in the answer → 502 AI_BAD_RESPONSE; provider 429 → AI_RATE_LIMITED", async () => {
    reply = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "sorry" }] } }] }), { status: 200 })
    await assert.rejects(makeBackground({ image, details: {}, idempotencyKey: "" }, config), (e) => e.code === "AI_BAD_RESPONSE")
    reply = () => new Response("{}", { status: 429 })
    await assert.rejects(makeBackground({ image, details: {}, idempotencyKey: "" }, config), (e) => e.code === "AI_RATE_LIMITED")
  })

  await check("handler: no key → 503 AI_NOT_CONFIGURED; GET → 405; bad key → 400", async () => {
    delete process.env.GEMINI_API_KEY
    delete process.env.GEMINI_API_KEY_2
    assert.deepEqual((await call(backgroundHandler, request("POST", { image }))).json, { error: "AI_NOT_CONFIGURED" })
    process.env.GEMINI_API_KEY_2 = "paid-key"
    assert.equal((await call(backgroundHandler, request("GET"))).status, 405)
    assert.equal((await call(backgroundHandler, request("POST", { image, idempotencyKey: "bad key!" }))).status, 400)
    delete process.env.GEMINI_API_KEY_2
  })
} finally {
  globalThis.fetch = realFetch
  rmSync(ledger, { force: true })
}

// ---------- Part 2: the app ----------
const photo = resolve("public/assets/reference-fresh/coffee.webp")
const scene = readFileSync(resolve("public/assets/reference-fresh/demo-scene-cake.jpg")).toString("base64")
const browser = await chromium.launch({ channel: "msedge", headless: true })
async function newPage(answer = { status: 200, body: { image: { mimeType: "image/jpeg", data: scene } } }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  const counts = { background: 0 }
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"AI_NOT_CONFIGURED"}' }))
  await page.route("**/api/background", async (route) => {
    counts.background += 1
    await new Promise((done) => setTimeout(done, 600))
    return route.fulfill({ status: answer.status, contentType: "application/json", body: JSON.stringify(answer.body) })
  })
  await page.goto(base)
  await page.getByRole("button", { name: "홍보물 만들기", exact: true }).first().click()
  return { page, errors, counts }
}
const dialog = (page) => page.getByRole("dialog", { name: /배경을 광고 사진처럼/ })

try {
  await check("browser: asked on 다음으로 (not over the photo checks); Escape stays on the photo step; a photo swapped later asks again", async () => {
    const { page, errors, counts } = await newPage()
    await page.locator("#product-photo").setInputFiles(photo)
    await page.getByRole("button", { name: "다음으로", exact: true }).waitFor()
    assert.equal(await dialog(page).count(), 0, "no popup right after adding the photo")
    await page.getByRole("button", { name: "다음으로", exact: true }).click()
    await dialog(page).waitFor()
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "바꾸기", "focus starts on 바꾸기")
    await page.keyboard.press("Escape")
    await dialog(page).waitFor({ state: "detached" })
    assert.ok(await page.getByRole("button", { name: "다음으로", exact: true }).isVisible(), "Escape stays on the photo step")
    await page.waitForTimeout(800)
    assert.equal(counts.background, 0)
    await page.getByRole("button", { name: "다음으로", exact: true }).click()
    await dialog(page).getByRole("button", { name: /그대로/ }).click()
    await page.getByLabel("제품 이름", { exact: true }).waitFor()
    assert.equal(counts.background, 0, "그대로 쓰기 pays nothing")
    // Swapping the photo on the info step asks about the new one.
    await page.locator("#details-photo").setInputFiles(resolve("public/assets/reference-fresh/cake.webp"))
    await dialog(page).waitFor()
    await dialog(page).getByRole("button", { name: /그대로/ }).click()
    assert.equal(counts.background, 0)
    assert.deepEqual(errors, [])
    await page.close()
  })

  await check("browser: 바꾸기 → one request while typing; the result uses the new picture and offers 바뀐/원래 사진", async () => {
    const { page, errors, counts } = await newPage()
    await page.locator("#product-photo").setInputFiles(photo)
    await page.getByRole("button", { name: "다음으로", exact: true }).click()
    await dialog(page).getByRole("button", { name: "바꾸기" }).click()
    await page.getByLabel("제품 이름", { exact: true }).fill("하트 카페라테")
    await page.waitForTimeout(900)
    assert.equal(counts.background, 1, "started on 바꾸기, before 홍보물 만들기")
    await page.getByRole("button", { name: "홍보물 만들기", exact: true }).click()
    const notice = page.getByText(/AI가 배경을 광고 사진처럼 바꿨어요/)
    await notice.waitFor({ timeout: 25000 })
    const pick = page.getByRole("radiogroup", { name: "포스터와 영상에 쓸 사진" })
    assert.equal(await pick.getByRole("radio", { name: /바뀐 사진/ }).getAttribute("aria-checked"), "true")
    await page.locator("#result-poster-preview img").waitFor()
    const changedPoster = await page.locator("#result-poster-preview img").getAttribute("src")
    await pick.getByRole("radio", { name: /원래 사진/ }).click()
    await page.getByText("원래 사진으로 만들었어요.").waitFor()
    await page.waitForFunction((before) => document.querySelector("#result-poster-preview img")?.getAttribute("src") !== before, changedPoster, { timeout: 15000 })
    assert.equal(counts.background, 1, "switching photos never asks again")
    assert.deepEqual(errors, [])
    await page.close()
  })

  await check("browser: today's cap → plain notice and the original photo; no picture choice", async () => {
    const { page, counts } = await newPage({ status: 429, body: { error: "BACKGROUND_DAILY_LIMIT" } })
    await page.locator("#product-photo").setInputFiles(photo)
    await page.getByRole("button", { name: "다음으로", exact: true }).click()
    await dialog(page).getByRole("button", { name: "바꾸기" }).click()
    await page.getByLabel("제품 이름", { exact: true }).fill("하트 카페라테")
    await page.getByRole("button", { name: "홍보물 만들기", exact: true }).click()
    await page.getByText("오늘 배경 바꾸기를 다 써서 원래 사진으로 만들었어요.").waitFor({ timeout: 25000 })
    assert.equal(await page.getByRole("radiogroup", { name: "포스터와 영상에 쓸 사진" }).count(), 0)
    assert.equal(counts.background, 1)
    await page.close()
  })

  await check("browser: the photo step no longer shows 기본형/고급형 (plan C); ?premiumui still does", async () => {
    const { page } = await newPage()
    await page.locator("#product-photo").setInputFiles(photo)
    await page.getByRole("button", { name: "다음으로", exact: true }).waitFor()
    assert.equal(await page.getByRole("radio", { name: /고급형/ }).count(), 0)
    await page.goto(`${base}?premiumui`)
    await page.getByRole("button", { name: "홍보물 만들기", exact: true }).first().click()
    await page.locator("#product-photo").setInputFiles(photo)
    await page.getByRole("button", { name: "다음으로", exact: true }).waitFor()
    assert.equal(await page.getByRole("radio", { name: /고급형/ }).count(), 1)
    await page.close()
  })
} finally {
  await browser.close()
}
console.log(`PASS: verify-background ${results.length} checks (server with stubbed Gemini, app flow with a stubbed picture)`)
