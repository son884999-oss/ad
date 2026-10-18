// Verifies the AI integration without a real Gemini key.
// Part 1 imports the api/ handlers and stubs global fetch to simulate Gemini.
// Part 2 drives the running dev server (default http://127.0.0.1:5173/) in Edge and intercepts
// /api/* with page.route. Usage: node scripts/verify-ai-api.mjs [baseUrl]
import assert from "node:assert/strict"
import { Readable } from "node:stream"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { rmSync, writeFileSync } from "node:fs"
import { BACKUP_DAILY_LIMIT_KRW, backupSpentToday } from "../api/_lib/gemini.js"
import { chromium } from "playwright"
import analyzePhoto from "../api/analyze-photo.js"
import promoText from "../api/promo-text.js"

const base = process.argv[2] || "http://127.0.0.1:5173/"
const results = []
async function check(name, fn) {
  await fn()
  results.push(name)
  console.log("ok -", name)
}

// ---------- Part 1: handlers with a fake Gemini ----------
function request(method, body, headers = { "content-type": "application/json" }) {
  const raw = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body)
  const req = Readable.from(raw ? [Buffer.from(raw)] : [])
  req.method = method
  req.headers = { ...headers, "content-length": String(Buffer.byteLength(raw)) }
  return req
}
async function call(handler, req) {
  const res = { statusCode: 200, headers: {}, body: "", setHeader(k, v) { this.headers[k.toLowerCase()] = v }, end(b) { this.body = b ?? "" } }
  await handler(req, res)
  return { status: res.statusCode, headers: res.headers, json: res.body ? JSON.parse(res.body) : null }
}
const geminiReply = (text, extra = {}) =>
  new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }], ...extra }), { status: 200, headers: { "content-type": "application/json" } })

const sent = []
let reply = () => geminiReply("{}")
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  sent.push({ url: String(url), init })
  return reply(url, init)
}
const photoBody = { image: { mimeType: "image/jpeg", data: Buffer.alloc(30, 7).toString("base64") } }
const promoBody = { productName: "우리밭 딸기잼", productDescription: "직접 키운 딸기로 끓인 잼", tones: ["natural", "friendly"], channel: "instagram" }
const goodPromo = JSON.stringify({
  copyCandidates: ["a", "b", "c"],
  copy: "토스트 위에서 딸기 알갱이가 톡, 우리밭 딸기잼",
  sns: "토스트에 바르면 딸기 알갱이가 씹혀요.\n이번 주에 끓인 잼, 매장에서 만나 보세요.",
  intro: "아침 토스트에 곁들이기 좋은 잼입니다.",
  hashtags: ["#딸기잼", "수제잼", "토스트", "아침 메뉴", "딸기잼"],
})

try {
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  await check("missing key → 503 AI_NOT_CONFIGURED (both endpoints, no Gemini call)", async () => {
    for (const [handler, body] of [[analyzePhoto, photoBody], [promoText, promoBody]]) {
      const r = await call(handler, request("POST", body))
      assert.equal(r.status, 503)
      assert.deepEqual(r.json, { error: "AI_NOT_CONFIGURED" })
    }
    process.env.GEMINI_API_KEY = "test-key"
    const r = await call(promoText, request("POST", promoBody))
    assert.equal(r.status, 503, "model missing is also not configured")
    assert.equal(sent.length, 0)
  })

  process.env.GEMINI_MODEL = "gemini-test-model"
  await check("non-POST → 405 with Allow: POST", async () => {
    for (const handler of [analyzePhoto, promoText]) {
      const r = await call(handler, request("GET"))
      assert.equal(r.status, 405)
      assert.equal(r.headers.allow, "POST")
      assert.deepEqual(r.json, { error: "METHOD_NOT_ALLOWED" })
    }
  })

  await check("non-JSON body → 415, broken JSON → 400", async () => {
    assert.equal((await call(promoText, request("POST", "x", { "content-type": "text/plain" }))).status, 415)
    const r = await call(promoText, request("POST", "{oops"))
    assert.equal(r.status, 400)
    assert.equal(r.json.error, "INVALID_JSON")
  })

  await check("oversized image → 413 IMAGE_TOO_LARGE; wrong type → 415", async () => {
    const big = await call(analyzePhoto, request("POST", { image: { mimeType: "image/jpeg", data: "A".repeat(4 * 1024 * 1024 + 4) } }))
    assert.equal(big.status, 413)
    assert.equal(big.json.error, "IMAGE_TOO_LARGE")
    const gif = await call(analyzePhoto, request("POST", { image: { mimeType: "image/gif", data: "AAAA" } }))
    assert.equal(gif.status, 415)
    const huge = await call(analyzePhoto, request("POST", "x".repeat(4_600_000)))
    assert.equal(huge.status, 413)
    assert.equal(sent.length, 0)
  })

  await check("analyze-photo success → cleaned fields, key only in header, image inline", async () => {
    reply = () => geminiReply(JSON.stringify({
      productName: "  딸기 생크림 케이크 ", description: "생크림 위에 딸기를 올린 케이크예요.", highlights: "딸기, 생크림",
      keyFeatures: ["딸기 듬뿍", "딸기 듬뿍", "생크림, 수제"], targetAudience: "디저트를 좋아하는 손님", tones: ["friendly", "bogus", "premium", "natural"],
      visualDetails: [" 윤기 나는 딸기 ", "윤기 나는 딸기", "흰 생크림 층", "가".repeat(31), "프리미엄 케이크", "미백 크림 같은 색", 7, "나무 쟁반 위", "창가 햇빛", "분홍 접시"],
    }))
    const r = await call(analyzePhoto, request("POST", photoBody))
    assert.equal(r.status, 200)
    assert.equal(r.json.productName, "딸기 생크림 케이크")
    assert.deepEqual(r.json.keyFeatures, ["딸기 듬뿍", "생크림 수제"])
    assert.deepEqual(r.json.tones, ["friendly", "premium"])
    assert.deepEqual(r.json.visualDetails, ["윤기 나는 딸기", "흰 생크림 층", "나무 쟁반 위", "창가 햇빛", "분홍 접시"],
      "trimmed, deduped, >30 chars / clichés / claims / non-strings dropped, max 5")
    const last = sent.at(-1)
    assert.match(last.url, /models\/gemini-test-model:generateContent$/)
    assert.equal(last.init.headers["x-goog-api-key"], "test-key")
    assert.ok(!last.url.includes("test-key"))
    const body = JSON.parse(last.init.body)
    assert.equal(body.generationConfig.responseMimeType, "application/json")
    assert.ok(body.generationConfig.maxOutputTokens > 0)
    assert.equal(body.contents[0].parts[1].inlineData.mimeType, "image/jpeg")
    const schema = body.generationConfig.responseJsonSchema
    assert.ok(schema.required.includes("visualDetails") && schema.properties.visualDetails.maxItems === 5)
    assert.deepEqual(schema.properties.tones.items.enum, ["natural", "premium", "friendly", "trendy"])
    assert.equal(body.generationConfig.temperature, undefined, "not a gemini-2 model")
    assert.match(body.systemInstruction.parts[0].text, /visualDetails[\s\S]*색, 질감/)
  })

  await check("analyze-photo: health / unverified claims are dropped from description text and visualDetails", async () => {
    reply = () => geminiReply(JSON.stringify({
      productName: "녹즙", description: "디톡스에 좋은 녹즙이에요.", highlights: "100% 국산 채소", keyFeatures: ["면역 강화", "초록색"],
      targetAudience: "숙취가 있는 손님", tones: [], visualDetails: ["진한 초록색", "무첨가 라벨"],
    }))
    const r = await call(analyzePhoto, request("POST", photoBody))
    assert.equal(r.status, 200)
    assert.equal(r.json.description, "")
    assert.equal(r.json.highlights, "")
    assert.equal(r.json.targetAudience, "")
    assert.deepEqual(r.json.keyFeatures, ["초록색"])
    assert.deepEqual(r.json.visualDetails, ["진한 초록색"])
    reply = () => geminiReply(JSON.stringify({ productName: "케이크" }))
    assert.deepEqual((await call(analyzePhoto, request("POST", photoBody))).json.visualDetails, [], "missing → []")
  })

  await check("promo-text success → copy/sns/intro/hashtags without #, candidates/videoHeadline/cta, B prompt rules sent", async () => {
    reply = () => geminiReply(goodPromo)
    const before = sent.length
    const r = await call(promoText, request("POST", promoBody))
    assert.equal(r.status, 200)
    assert.deepEqual(Object.keys(r.json), ["copy", "sns", "intro", "hashtags", "copyCandidates", "videoHeadline", "cta"])
    assert.deepEqual(r.json.hashtags, ["딸기잼", "수제잼", "토스트", "아침메뉴"])
    assert.deepEqual(r.json.copyCandidates, ["a", "b", "c"])
    // No headline, candidates too short, copy and its comma part over 16 → the product name, never a cut sentence.
    assert.equal(r.json.videoHeadline, "우리밭 딸기잼", "no headline from the model → a complete line")
    assert.equal(r.json.cta, "")
    assert.equal(sent.length - before, 1, "no rewrite needed")
    const body = JSON.parse(sent.at(-1).init.body)
    assert.match(body.systemInstruction.parts[0].text, /의학적 효능/)
    assert.match(body.contents[0].parts[0].text, /<product>[\s\S]*브랜드 분위기: 자연스럽고 건강한, 친근하고 따뜻한/)
    assert.match(body.contents[0].parts[0].text, /인스타그램/)
    assert.doesNotMatch(body.contents[0].parts[0].text, /<photo>/)
    assert.deepEqual(body.generationConfig.responseJsonSchema.properties.hashtags.maxItems, 5)
  })

  await check("promo-text: visualDetails from the photo go into a <photo> block", async () => {
    reply = () => geminiReply(goodPromo)
    const r = await call(promoText, request("POST", { ...promoBody, visualDetails: ["유리병 속 빨간 잼", "굵은 딸기 알갱이"] }))
    assert.equal(r.status, 200)
    assert.match(JSON.parse(sent.at(-1).init.body).contents[0].parts[0].text, /<photo>\n- 유리병 속 빨간 잼\n- 굵은 딸기 알갱이\n<\/photo>/)
  })

  await check("promo-text quality review triggers one rewrite", async () => {
    const replies = [JSON.stringify({ ...JSON.parse(goodPromo), copy: "정성 가득 프리미엄 우리밭 딸기잼" }), goodPromo]
    reply = () => geminiReply(replies.shift() ?? goodPromo)
    const before = sent.length
    const r = await call(promoText, request("POST", promoBody))
    assert.equal(r.status, 200)
    assert.equal(sent.length - before, 2)
    assert.match(JSON.parse(sent.at(-1).init.body).contents[0].parts[0].text, /상투어/)
    assert.ok(!r.json.copy.includes("프리미엄"))
  })

  await check("malformed Gemini JSON → 502 AI_BAD_RESPONSE", async () => {
    reply = () => geminiReply("not json at all")
    assert.deepEqual((await call(analyzePhoto, request("POST", photoBody))).json, { error: "AI_BAD_RESPONSE" })
    const r = await call(promoText, request("POST", promoBody))
    assert.equal(r.status, 502)
    assert.equal(r.json.error, "AI_BAD_RESPONSE")
    reply = () => geminiReply(JSON.stringify({ copy: "x" }))
    assert.equal((await call(promoText, request("POST", promoBody))).json.error, "AI_BAD_RESPONSE")
    reply = () => new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{" }] } }] }), { status: 200 })
    assert.equal((await call(analyzePhoto, request("POST", photoBody))).json.error, "AI_BAD_RESPONSE")
  })

  await check("Gemini HTTP error → 502 AI_REQUEST_FAILED, 429 → AI_RATE_LIMITED, network → 502", async () => {
    reply = () => new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 400 })
    const r = await call(analyzePhoto, request("POST", photoBody))
    assert.equal(r.status, 502)
    assert.deepEqual(r.json, { error: "AI_REQUEST_FAILED" })
    reply = () => new Response("{}", { status: 429 })
    assert.equal((await call(promoText, request("POST", promoBody))).json.error, "AI_RATE_LIMITED")
    reply = () => { throw new TypeError("fetch failed") }
    assert.equal((await call(promoText, request("POST", promoBody))).json.error, "AI_REQUEST_FAILED")
  })

  await check("GEMINI_API_KEY_2: used only after the first key fails; ₩500/day cap", async () => {
    process.env.GEMINI_API_KEY_2 = "backup-key"
    const ledger = join(tmpdir(), `hongboitda-key2-${process.pid}.json`)
    process.env.GEMINI_KEY2_LEDGER = ledger
    const usage = { usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 500, thoughtsTokenCount: 500 } }
    try {
      reply = (url, init) => init.headers["x-goog-api-key"] === "test-key" ? new Response("{}", { status: 429 }) : geminiReply(goodPromo, usage)
      sent.length = 0
      const first = await call(promoText, request("POST", promoBody))
      assert.equal(first.status, 200)
      assert.deepEqual(sent.map((s) => s.init.headers["x-goog-api-key"]), ["test-key", "backup-key"])
      sent.length = 0
      assert.equal((await call(promoText, request("POST", promoBody))).status, 200)
      assert.deepEqual(sent.map((s) => s.init.headers["x-goog-api-key"]), ["test-key", "backup-key"], "the free key is always tried first")
      // Each answer adds its estimated cost: 2000 in × $0.5 + 1000 out × $3 per 1M → $0.004 → ₩6 each.
      const spent = backupSpentToday()
      assert.ok(spent > 10 && spent < 14, `ledger ${spent}`)
      // Near the cap the second key is not called at all and the first key's 429 is the answer.
      writeFileSync(ledger, JSON.stringify({ day: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }), krw: BACKUP_DAILY_LIMIT_KRW - 5 }))
      sent.length = 0
      assert.equal((await call(promoText, request("POST", promoBody))).json.error, "AI_RATE_LIMITED")
      assert.deepEqual(sent.map((s) => s.init.headers["x-goog-api-key"]), ["test-key"], "no call past the daily cap")
    } finally {
      delete process.env.GEMINI_API_KEY_2
      delete process.env.GEMINI_KEY2_LEDGER
      rmSync(ledger, { force: true })
    }
  })

  await check("COPA_API_KEY: Claude → free Gemini → paid Gemini (owner's order), photo sent as an image block; COPA alone works", async () => {
    process.env.COPA_API_KEY = "copa-key"
    const copaReply = (text) => new Response(JSON.stringify({ type: "message", stop_reason: "end_turn", content: [{ type: "text", text }] }), { status: 200 })
    const isCopa = (url) => String(url) === "https://copa.codyssey.kr/v1/messages"
    try {
      // COPA answers → Gemini is never called; the Anthropic key header and the default model.
      reply = (url) => isCopa(url) ? copaReply(goodPromo) : geminiReply(goodPromo)
      sent.length = 0
      assert.equal((await call(promoText, request("POST", promoBody))).status, 200)
      assert.ok(sent.every((s) => isCopa(s.url)), "no Gemini call while COPA works")
      const copaSent = sent[0]
      assert.equal(copaSent.init.headers["x-api-key"], "copa-key")
      assert.equal(JSON.parse(copaSent.init.body).model, "claude-haiku-4")
      // COPA limited → the free Gemini key answers.
      reply = (url) => isCopa(url) ? new Response("{}", { status: 429 }) : geminiReply(goodPromo)
      sent.length = 0
      assert.equal((await call(promoText, request("POST", promoBody))).status, 200)
      assert.deepEqual(sent.map((s) => isCopa(s.url)), [true, false], "COPA first, then Gemini")
      // The photo goes as an Anthropic base64 image block.
      reply = (url) => isCopa(url) ? copaReply(JSON.stringify({ productName: "딸기잼" })) : new Response("{}", { status: 503 })
      sent.length = 0
      await call(analyzePhoto, request("POST", photoBody))
      const content = JSON.parse(sent[0].init.body).messages[0].content
      assert.ok(content.some((part) => part.type === "image" && part.source.type === "base64" && part.source.media_type === "image/jpeg"))
      // Both limited → the app's usual AI_RATE_LIMITED.
      reply = () => new Response("{}", { status: 429 })
      assert.equal((await call(promoText, request("POST", promoBody))).json.error, "AI_RATE_LIMITED")
      // With the paid key too: COPA → free key → paid key, the paid key last.
      process.env.GEMINI_API_KEY_2 = "backup-key"
      process.env.GEMINI_MODEL_2 = "gemini-3.5-flash-lite"
      process.env.GEMINI_KEY2_LEDGER = join(tmpdir(), `hongboitda-key2-copa-${process.pid}.json`)
      reply = (url, init) => !isCopa(url) && init.headers["x-goog-api-key"] === "backup-key" ? geminiReply(goodPromo) : new Response("{}", { status: 429 })
      sent.length = 0
      assert.equal((await call(promoText, request("POST", promoBody))).status, 200)
      assert.deepEqual(sent.map((s) => isCopa(s.url) ? "copa" : s.init.headers["x-goog-api-key"]), ["copa", "test-key", "backup-key"])
      assert.match(sent.at(-1).url, /models\/gemini-3\.5-flash-lite:generateContent$/, "GEMINI_MODEL_2 for the second key")
      assert.match(sent[1].url, /models\/gemini-test-model:generateContent$/)
      delete process.env.GEMINI_MODEL_2
      rmSync(process.env.GEMINI_KEY2_LEDGER, { force: true })
      delete process.env.GEMINI_API_KEY_2
      delete process.env.GEMINI_KEY2_LEDGER
      // No Gemini key: COPA alone answers.
      delete process.env.GEMINI_API_KEY
      reply = (url) => isCopa(url) ? copaReply(goodPromo) : new Response("{}", { status: 500 })
      sent.length = 0
      assert.equal((await call(promoText, request("POST", promoBody))).status, 200)
      assert.ok(sent.every((s) => isCopa(s.url)))
    } finally {
      delete process.env.COPA_API_KEY
      process.env.GEMINI_API_KEY = "test-key"
    }
  })

  await check("promo-text input validation → 400 INVALID_INPUT", async () => {
    for (const body of [{}, { productName: "" }, { productName: "a".repeat(51) }, { ...promoBody, channel: "facebook" }, { ...promoBody, tones: "natural" },
      { ...promoBody, location: "가".repeat(61) }, { ...promoBody, priceInfo: "1".repeat(61) }, { ...promoBody, contact: 1234 },
      { ...promoBody, visualDetails: ["a", "b", "c", "d", "e", "f"] }, { ...promoBody, visualDetails: ["가".repeat(31)] }, { ...promoBody, visualDetails: "잼" }]) {
      const r = await call(promoText, request("POST", body))
      assert.equal(r.status, 400, JSON.stringify(body).slice(0, 60))
      assert.equal(r.json.error, "INVALID_INPUT")
    }
  })
} finally {
  globalThis.fetch = realFetch
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
}

// ---------- Part 2: browser ----------
const photo = resolve("public/assets/reference-fresh/coffee.webp")
const suggestion = {
  productName: "AI가 붙인 이름", description: "AI가 쓴 제품 설명이에요.", highlights: "AI가 고른 알릴 점",
  keyFeatures: ["수제", "당일 생산"], targetAudience: "AI가 고른 손님", tones: ["premium", "friendly"],
}
const cannedPromo = { copy: "AI 카피 한 줄", sns: "AI SNS 문구예요. 들러 보세요.", intro: "AI 제품 소개입니다.", hashtags: ["AI태그", "커피", "디저트", "동네카페"] }
const toneNames = { auto: "AI 자동 추천", natural: "자연스럽고 건강한", premium: "고급스럽고 전문적인", friendly: "친근하고 따뜻한", trendy: "트렌디하고 활기찬" }

const browser = await chromium.launch({ channel: "msedge", headless: true })
// The dev server may hold real keys: every /api/* call is stubbed (503) unless a test routes it itself
// (routes added later take precedence), so no request ever reaches a real AI or video API.
async function newPage(options) {
  const page = await browser.newPage(options)
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"AI_NOT_CONFIGURED"}' }))
  return page
}
async function openInfoStep(page) {
  await page.goto(base)
  await page.getByRole("button", { name: "홍보물 만들기", exact: true }).first().click()
  await page.locator("#product-photo").setInputFiles(photo)
  await page.getByRole("button", { name: "다음으로", exact: true }).click()
  await page.getByLabel("제품 이름", { exact: true }).waitFor()
}
const pressed = (page, name) => page.getByRole("button", { name, exact: true }).getAttribute("aria-pressed")

try {
  await check("browser: photo fills empty fields, keeps typed name, presses returned tones, uses AI 홍보 글", async () => {
    const page = await newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] })
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    let release
    const released = new Promise((r) => { release = r })
    let analyzeBody = null
    let promoBodySent = null
    await page.route("**/api/analyze-photo", async (route) => {
      analyzeBody = route.request().postDataJSON()
      await released
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(suggestion) })
    })
    await page.route("**/api/promo-text", async (route) => {
      promoBodySent = route.request().postDataJSON()
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cannedPromo) })
    })
    await openInfoStep(page)
    await page.getByText("사진을 보고 내용을 채우고 있어요…").waitFor()
    assert.ok(await page.getByRole("button", { name: "홍보물 만들기", exact: true }).isDisabled(), "name still empty")
    await page.getByLabel("제품 이름", { exact: true }).fill("내가 쓴 이름")
    assert.ok(await page.getByRole("button", { name: "홍보물 만들기", exact: true }).isEnabled(), "loading does not block the button")
    release()
    await page.getByText("사진을 보고 채웠어요. 맞지 않으면 고쳐 주세요.").waitFor()
    assert.equal(analyzeBody.image.mimeType, "image/jpeg")
    assert.ok(analyzeBody.image.data.length < 4 * 1024 * 1024)
    assert.equal(await page.getByLabel("제품 이름", { exact: true }).inputValue(), "내가 쓴 이름")
    assert.equal(await page.getByLabel("제품 설명", { exact: true }).inputValue(), suggestion.description)
    assert.equal(await page.getByLabel("어떤 점을 알려주고 싶나요?", { exact: true }).inputValue(), suggestion.highlights)
    assert.equal(await page.getByLabel("핵심 특징", { exact: true }).inputValue(), "수제, 당일 생산")
    assert.equal(await page.getByLabel("주요 고객층", { exact: true }).inputValue(), suggestion.targetAudience)
    assert.equal(await pressed(page, toneNames.premium), "true")
    assert.equal(await pressed(page, toneNames.friendly), "true")
    assert.equal(await pressed(page, toneNames.natural), "false")
    assert.equal(await pressed(page, toneNames.auto), "false")
    // Multi-select: toggling off one tone keeps the other; 자동 clears all.
    await page.getByRole("button", { name: toneNames.premium, exact: true }).click()
    assert.equal(await pressed(page, toneNames.premium), "false")
    assert.equal(await pressed(page, toneNames.friendly), "true")
    await page.getByRole("button", { name: toneNames.auto, exact: true }).click()
    assert.equal(await pressed(page, toneNames.auto), "true")
    assert.equal(await pressed(page, toneNames.friendly), "false")
    await page.getByRole("button", { name: toneNames.trendy, exact: true }).click()
    await page.getByRole("button", { name: toneNames.natural, exact: true }).click()
    await page.getByRole("button", { name: "홍보물 만들기", exact: true }).click()
    await page.locator("#result-poster-preview img").waitFor({ timeout: 20000 })
    assert.deepEqual(promoBodySent.tones, ["trendy", "natural"])
    assert.equal(promoBodySent.productName, "내가 쓴 이름")
    await page.getByRole("tab", { name: "홍보 글", exact: true }).click()
    const copy = await page.locator(".copy-result-text").innerText()
    assert.ok(copy.includes("AI 카피 한 줄") && copy.includes("#AI태그"), copy)
    assert.ok(copy.includes("내가 쓴 이름"), "product name is always in the 홍보 글")
    await page.getByRole("button", { name: "홍보 글 복사하기", exact: true }).click()
    assert.ok((await page.evaluate(() => navigator.clipboard.readText())).includes("AI 카피 한 줄"))
    assert.deepEqual(errors, [])
    await page.close()
  })

  await check("browser: with 503 the info step shows nothing extra and keeps the local result", async () => {
    const page = await newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    let calls = 0
    for (const path of ["**/api/analyze-photo", "**/api/promo-text"]) {
      await page.route(path, (route) => { calls += 1; return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"AI_NOT_CONFIGURED"}' }) })
    }
    await openInfoStep(page)
    await page.waitForTimeout(1500)
    assert.equal(await page.locator(".ai-fill-status").count(), 0)
    assert.equal(await page.locator(".details-step [role=alert]").count(), 0)
    assert.equal(await page.getByLabel("제품 설명", { exact: true }).inputValue(), "")
    assert.equal(await pressed(page, toneNames.auto), "true")
    await page.getByLabel("제품 이름", { exact: true }).fill("수제 크림과 커피")
    await page.getByRole("button", { name: "홍보물 만들기", exact: true }).click()
    await page.locator("#result-poster-preview img").waitFor({ timeout: 20000 })
    await page.getByRole("tab", { name: "홍보 글", exact: true }).click()
    assert.ok((await page.locator(".copy-result-text").innerText()).includes("수제 크림과 커피"))
    assert.equal(calls, 1, "after a 503 the client stops asking")
    assert.deepEqual(errors, [])
    await page.close()
  })

  await check("browser: a hanging promo-text request is capped and the local 홍보 글 is used", async () => {
    const page = await newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })
    await page.route("**/api/analyze-photo", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...suggestion, productName: "" }) }))
    await page.route("**/api/promo-text", () => {}) // never answers
    await openInfoStep(page)
    await page.getByLabel("제품 이름", { exact: true }).fill("느린 응답 케이크")
    const started = Date.now()
    await page.getByRole("button", { name: "홍보물 만들기", exact: true }).click()
    await page.locator("#result-poster-preview img").waitFor({ timeout: 25000 })
    const waited = Date.now() - started
    assert.ok(waited < 16000, `waited ${waited} ms`)
    await page.getByRole("tab", { name: "홍보 글", exact: true }).click()
    const copy = await page.locator(".copy-result-text").innerText()
    assert.ok(copy.includes("느린 응답 케이크") && !copy.includes("AI 카피"))
    await page.close()
  })
} finally {
  await browser.close()
}
console.log(`PASS: verify-ai-api ${results.length} checks (handlers with stubbed Gemini + browser auto-fill, tones, 503, promo cap)`)
