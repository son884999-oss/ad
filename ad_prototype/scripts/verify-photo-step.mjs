// Verifies the photo step: instant photo check (blur / dark), AI photo check (stubbed), one shared
// analyze-photo request from photo selection through the info step, camera + album buttons on
// touch phones vs. only the file picker on PC, and the 사진 예시 disclosure on short screens.
// Part 1 imports api/analyze-photo.js with a stubbed Gemini fetch. Part 2 drives the dev server in
// Edge; every /api/* call is answered by page.route (no real AI calls).
// Usage: node scripts/verify-photo-step.mjs [baseUrl]
import assert from "node:assert/strict"
import { Readable } from "node:stream"
import { resolve } from "node:path"
import { chromium } from "playwright"
import analyzePhotoHandler from "../api/analyze-photo.js"
// Plan C: 다음으로 on the photo step asks "배경을 광고 사진처럼 바꿀까요?"; these checks keep the photo. Registered
// once per page after the first photo: whenever the popup shows, 그대로 쓰기 is pressed before the next action.
const keptPages = new WeakSet()
const keepPhoto = async (page) => {
  if (keptPages.has(page)) return
  keptPages.add(page)
  await page.addLocatorHandler(page.getByRole("dialog", { name: /배경을 광고 사진처럼/ }), async (dialog) => {
    await dialog.getByRole("button", { name: /그대로/ }).click()
  })
}


const base = process.argv[2] || "http://127.0.0.1:5173/"
const coffee = resolve("public/assets/reference-fresh/coffee.webp")
const results = []
async function check(name, fn) {
  await fn()
  results.push(name)
  console.log("ok -", name)
}

// ---------- Part 1: photoCheck in the API (stubbed Gemini) ----------
function request(body) {
  const raw = JSON.stringify(body)
  const req = Readable.from([Buffer.from(raw)])
  req.method = "POST"
  req.headers = { "content-type": "application/json", "content-length": String(Buffer.byteLength(raw)) }
  return req
}
async function call(body) {
  const res = { statusCode: 200, headers: {}, body: "", setHeader(k, v) { this.headers[k.toLowerCase()] = v }, end(b) { this.body = b ?? "" } }
  await analyzePhotoHandler(request(body), res)
  return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null }
}
const photoBody = { image: { mimeType: "image/jpeg", data: Buffer.alloc(30, 7).toString("base64") } }
const fields = { productName: "딸기 케이크", description: "", highlights: "", keyFeatures: [], targetAudience: "", tones: [] }
const realFetch = globalThis.fetch
let modelOutput = {}
let sentPrompt = ""
globalThis.fetch = async (_url, init) => {
  sentPrompt = JSON.parse(init.body).systemInstruction.parts[0].text
  return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(modelOutput) }] } }] }), { status: 200 })
}
try {
  process.env.GEMINI_API_KEY = "test-key"
  process.env.GEMINI_MODEL = "gemini-test-model"
  await check("api: photoCheck is asked for and passed through (illustration → isRealPhoto false)", async () => {
    modelOutput = { ...fields, photoCheck: { isRealPhoto: false, isBlurry: false, reason: "  그림으로 그린 이미지예요  " } }
    const r = await call(photoBody)
    assert.equal(r.status, 200)
    assert.deepEqual(r.json.photoCheck, { isRealPhoto: false, isBlurry: false, reason: "그림으로 그린 이미지예요" })
    assert.equal(r.json.productName, "딸기 케이크")
    assert.match(sentPrompt, /photoCheck/)
    assert.match(sentPrompt, /isRealPhoto/)
    assert.match(sentPrompt, /화면 캡처/)
  })
  await check("api: photoCheck is lenient (missing / odd values never flag; reason dropped when fine)", async () => {
    for (const [photoCheck, expected] of [
      [undefined, { isRealPhoto: true, isBlurry: false, reason: "" }],
      ["yes", { isRealPhoto: true, isBlurry: false, reason: "" }],
      [{ isRealPhoto: "false", isBlurry: "true", reason: "x" }, { isRealPhoto: true, isBlurry: false, reason: "" }],
      [{ isRealPhoto: true, isBlurry: false, reason: "괜찮아요" }, { isRealPhoto: true, isBlurry: false, reason: "" }],
      [{ isRealPhoto: true, isBlurry: true, reason: "가".repeat(100) }, { isRealPhoto: true, isBlurry: true, reason: "가".repeat(60) }],
      [{ isRealPhoto: true, isBlurry: true, reason: "면역력에 좋아요" }, { isRealPhoto: true, isBlurry: true, reason: "" }],
    ]) {
      modelOutput = { ...fields, photoCheck }
      const r = await call(photoBody)
      assert.equal(r.status, 200)
      assert.deepEqual(r.json.photoCheck, expected, JSON.stringify(photoCheck))
    }
  })
  await check("api: image validation still applies before Gemini (415 / 400)", async () => {
    assert.equal((await call({ image: { mimeType: "image/gif", data: "AAAA" } })).status, 415)
    assert.equal((await call({ image: { mimeType: "image/jpeg", data: "@@@" } })).status, 400)
  })
} finally {
  globalThis.fetch = realFetch
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
}

// ---------- Part 2: browser ----------
const okSuggestion = {
  productName: "AI가 붙인 이름", description: "AI가 쓴 제품 설명이에요.", highlights: "", keyFeatures: [], targetAudience: "", tones: [],
  photoCheck: { isRealPhoto: true, isBlurry: false, reason: "" },
}
const browser = await chromium.launch({ channel: "msedge", headless: true })
async function open({ width = 390, height = 844, view = "auto", easy = false, touch = false, analyze = null } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce", hasTouch: touch, isMobile: touch })
  page.errors = []
  page.analyzeCalls = 0
  page.on("pageerror", (e) => page.errors.push(e.message))
  await page.route("**/api/**", async (route) => {
    if (route.request().url().includes("analyze-photo")) {
      page.analyzeCalls += 1
      if (analyze) return analyze(route)
    }
    return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"AI_NOT_CONFIGURED"}' })
  })
  await page.goto(base)
  if (easy) await page.getByRole("radio", { name: "쉬운 화면", exact: true }).first().click()
  await page.getByRole("button", { name: "홍보물 만들기", exact: true }).first().click()
  await page.locator(".photo-step").waitFor()
  return page
}
const json = (body) => (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
// A JPEG made from an example photo with a canvas filter (blur / darken).
async function variant(page, filter) {
  const data = await page.evaluate(async (filter) => {
    const img = new Image()
    img.src = "/assets/reference-fresh/coffee.webp"
    await img.decode()
    const c = document.createElement("canvas")
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const x = c.getContext("2d")
    x.filter = filter
    x.drawImage(img, 0, 0)
    return c.toDataURL("image/jpeg", 0.9).split(",")[1]
  }, filter)
  return { name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from(data, "base64") }
}
const warning = (page) => page.locator(".photo-check-warning")
const ready = (page) => page.locator(".reference-selected-photo img").waitFor()
const settle = (page, ms = 500) => page.waitForTimeout(ms)
const button = (page, name) => page.getByRole("button", { name, exact: true })
const done = async (page) => { assert.deepEqual(page.errors, []); await page.close() }

try {
  await check("upfront guide: real photo you took yourself (basic / easy, bold in easy, inside the upload box)", async () => {
    for (const [easy, touch, width, height, view] of [[false, false, 390, 844, "auto"], [true, false, 390, 844, "auto"], [false, true, 360, 640, "auto"], [true, true, 360, 640, "auto"], [false, false, 1440, 900, "pc"], [true, false, 1024, 844, "mobile"]]) {
      const page = await open({ easy, touch, width, height, view })
      const guide = page.locator(".reference-upload-box .photo-guide")
      assert.ok(await guide.isVisible(), "guide shown before a photo is chosen")
      const text = (await guide.innerText()).replace(/\s+/g, " ").trim()
      assert.equal(text, easy ? "직접 찍은 사진을 넣어 주세요 그림이나 캡처는 안 돼요" : "가게나 제품을 직접 찍은 실사 사진을 넣어 주세요 그림·캡처·글자 이미지는 피해 주세요")
      if (easy) for (const part of ["strong", "span"]) assert.ok(Number(await guide.locator(part).evaluate((e) => getComputedStyle(e).fontWeight)) >= 700, "easy guide is bold")
      const box = await guide.boundingBox()
      const navTop = await page.evaluate(() => { const n = document.querySelector(".studio-bottom-nav"); return n && !n.classList.contains("is-top") ? n.getBoundingClientRect().top : innerHeight })
      assert.ok(box.y + box.height <= navTop + 1, `guide not under the bottom nav (${width}×${height})`)
      await page.locator("#product-photo").setInputFiles(coffee)
      await keepPhoto(page)
      await ready(page)
      assert.equal(await guide.count(), 0, "replaced by the photo-ready card")
      await done(page)
    }
  })

  await check("example photo passes: no warning, 다음으로 shown", async () => {
    for (const name of ["coffee", "cake", "store"]) {
      const page = await open()
      await page.locator("#product-photo").setInputFiles(resolve(`public/assets/reference-fresh/${name}.webp`))
      await keepPhoto(page)
      await ready(page)
      await settle(page)
      assert.equal(await warning(page).count(), 0, name)
      assert.ok(await button(page, "다음으로").isVisible())
      await done(page)
    }
  })

  await check("blurry photo → 흐려요 warning; 다시 찍기 shows camera/album; 그대로 쓰기 continues", async () => {
    const page = await open({ touch: true })
    await page.locator("#product-photo").setInputFiles(await variant(page, "blur(4px)"))
    await keepPhoto(page)
    await warning(page).getByText("사진이 흐려요.", { exact: false }).waitFor()
    assert.equal(await page.locator(".photo-check").getAttribute("aria-live"), "polite")
    assert.equal(await button(page, "다음으로").count(), 0, "warning replaces 다음으로")
    await button(page, "다시 찍기").click()
    assert.ok(await button(page, "카메라로 찍기").isVisible())
    const chooser = page.waitForEvent("filechooser")
    await button(page, "앨범에서 고르기").click()
    await (await chooser).setFiles(coffee)
    await keepPhoto(page)
    await page.waitForFunction(() => !document.querySelector(".photo-check-warning") && document.querySelector(".photo-next-action"))
    // Blurry again, then keep it anyway: goes on to the info step and does not warn again.
    await page.locator("#product-photo").setInputFiles(await variant(page, "blur(4px)"))
    await keepPhoto(page)
    await warning(page).waitFor()
    await button(page, "이 사진 그대로 쓰기").click()
    await page.getByLabel("제품 이름", { exact: true }).waitFor()
    await button(page, "뒤로가기").click()
    await ready(page)
    await settle(page)
    assert.equal(await warning(page).count(), 0, "kept photo is not warned again")
    await done(page)
  })

  await check("PC / mouse: blurry warning offers 다른 사진 고르기 (opens the file picker)", async () => {
    const page = await open({ width: 1440, height: 900, view: "pc" })
    await page.locator("#product-photo").setInputFiles(await variant(page, "blur(4px)"))
    await keepPhoto(page)
    await warning(page).waitFor()
    const chooser = page.waitForEvent("filechooser")
    await button(page, "다른 사진 고르기").click()
    assert.equal(await (await chooser).element().getAttribute("id"), "product-photo")
    await done(page)
  })

  await check("dark photo → 어두워요 warning (basic and easy wording)", async () => {
    for (const easy of [false, true]) {
      const page = await open({ easy })
      await page.locator("#product-photo").setInputFiles(await variant(page, "brightness(0.2)"))
      await keepPhoto(page)
      await warning(page).waitFor()
      const text = await warning(page).innerText()
      assert.match(text, /어두워요/)
      assert.match(text, easy ? /밝은 곳에서 찍어 주세요/ : /밝은 곳에서 다시 찍어 주세요/)
      await done(page)
    }
  })

  await check("AI photoCheck isRealPhoto=false → 실제 사진이 아니에요 (on the photo step)", async () => {
    const page = await open({ analyze: json({ ...okSuggestion, photoCheck: { isRealPhoto: false, isBlurry: false, reason: "그림이에요" } }) })
    await page.locator("#product-photo").setInputFiles(coffee)
    await keepPhoto(page)
    await warning(page).getByText("실제 사진이 아니에요.", { exact: false }).waitFor()
    assert.match(await warning(page).innerText(), /가게나 제품을 직접 찍은 사진이 좋아요/)
    assert.ok(await button(page, "이 사진 그대로 쓰기").isVisible())
    await done(page)
  })

  await check("AI flag arriving after leaving the photo step shows nothing; auto-fill still works", async () => {
    let release
    const released = new Promise((r) => { release = r })
    const page = await open({ analyze: async (route) => { await released; await json({ ...okSuggestion, photoCheck: { isRealPhoto: false, isBlurry: true, reason: "" } })(route) } })
    await page.locator("#product-photo").setInputFiles(coffee)
    await keepPhoto(page)
    await ready(page)
    assert.ok(await button(page, "다음으로").isEnabled(), "pending AI check does not block")
    await button(page, "다음으로").click()
    await page.getByLabel("제품 이름", { exact: true }).waitFor()
    release()
    await page.getByText("사진을 보고 채웠어요. 맞지 않으면 고쳐 주세요.").waitFor()
    assert.equal(await page.getByLabel("제품 이름", { exact: true }).inputValue(), okSuggestion.productName)
    assert.equal(await warning(page).count(), 0)
    await button(page, "뒤로가기").click()
    await ready(page)
    await settle(page)
    assert.equal(await warning(page).count(), 0, "late flag is dropped, not shown on return")
    await done(page)
  })

  await check("analyze-photo runs once from photo selection through the info step and fills fields", async () => {
    let body = null
    const page = await open({ analyze: async (route) => { body = route.request().postDataJSON(); await json(okSuggestion)(route) } })
    await page.locator("#product-photo").setInputFiles(coffee)
    await keepPhoto(page)
    await ready(page)
    await settle(page, 400)
    assert.equal(page.analyzeCalls, 1, "started on the photo step")
    assert.equal(body.image.mimeType, "image/jpeg")
    await button(page, "다음으로").click()
    await page.getByText("사진을 보고 채웠어요. 맞지 않으면 고쳐 주세요.").waitFor()
    assert.equal(await page.getByLabel("제품 이름", { exact: true }).inputValue(), okSuggestion.productName)
    assert.equal(await page.getByLabel("제품 설명", { exact: true }).inputValue(), okSuggestion.description)
    await button(page, "뒤로가기").click()
    await button(page, "다음으로").click()
    await page.getByLabel("제품 이름", { exact: true }).waitFor()
    await settle(page)
    assert.equal(page.analyzeCalls, 1, "never a second request for the same photo")
    await done(page)
  })

  await check("touch phone: 카메라로 찍기 (capture=environment) + 앨범에서 고르기; easy labels and ≥60px", async () => {
    const page = await open({ touch: true })
    assert.ok(await button(page, "카메라로 찍기").isVisible())
    assert.ok(await button(page, "앨범에서 고르기").isVisible())
    assert.equal(await page.locator("#product-photo-camera").getAttribute("capture"), "environment")
    assert.equal(await page.locator("#product-photo-camera").getAttribute("accept"), "image/*")
    assert.equal(await page.locator("#product-photo").getAttribute("capture"), null)
    let chooser = page.waitForEvent("filechooser")
    await button(page, "카메라로 찍기").click()
    assert.equal(await (await chooser).element().getAttribute("id"), "product-photo-camera")
    chooser = page.waitForEvent("filechooser")
    await button(page, "앨범에서 고르기").click()
    const picker = await chooser
    assert.equal(await picker.element().getAttribute("id"), "product-photo")
    await picker.setFiles(coffee)
    await keepPhoto(page)
    await ready(page)
    // 사진 변경 on a phone offers the same choice.
    await button(page, "사진 변경").click()
    assert.ok(await button(page, "카메라로 찍기").isVisible())
    await done(page)

    const easy = await open({ touch: true, easy: true })
    for (const name of ["사진 찍기", "앨범에서 고르기"]) {
      const box = await button(easy, name).boundingBox()
      assert.ok(box && box.height >= 60, `${name} ${box?.height}`)
      assert.equal(await button(easy, name).locator("svg").count(), 0, "easy buttons are text only")
    }
    assert.ok(Number(await easy.locator(".reference-upload-box p").first().evaluate((e) => getComputedStyle(e).fontWeight)) >= 700, "easy guide text is bold")
    await done(easy)
  })

  await check("PC and mouse phone view: only the file picker (사진 선택하기), drag & drop still works on PC", async () => {
    for (const [width, height, view] of [[1440, 900, "pc"], [1024, 844, "mobile"], [390, 844, "auto"]]) {
      const page = await open({ width, height, view })
      assert.equal(await button(page, "카메라로 찍기").count(), 0, `${width} ${view}`)
      assert.equal(await page.locator("#product-photo-camera").count(), 0)
      assert.ok(await button(page, "사진 선택하기").isVisible())
      if (view === "pc") {
        await page.evaluate(async () => {
          const blob = await (await fetch("/assets/reference-fresh/cake.webp")).blob()
          const transfer = new DataTransfer()
          transfer.items.add(new File([blob], "cake.webp", { type: "image/webp" }))
          const box = document.querySelector(".reference-upload-box")
          for (const type of ["dragenter", "dragover", "drop"]) box.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }))
        })
        await ready(page)
      }
      await done(page)
    }
  })

  const fit = (page) => page.evaluate(() => {
    const m = document.querySelector(".studio-main")
    const shown = (s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().height > 0 }
    return { inline: shown(".photo-examples-inline"), disclosure: shown(".photo-examples-disclosure"), scroll: m.scrollHeight - m.clientHeight }
  })
  const triangle = (page) => page.locator(".photo-examples-triangle").evaluate((e) => getComputedStyle(e, "::before").content)

  await check("사진 예시: shown when it fits (incl. framed 1024×844); collapsed with ▸/▾ toggle when short (360×640 easy, framed 1280×720 easy)", async () => {
    for (const [width, height, view, easy] of [[390, 844, "auto", false], [390, 844, "auto", true], [430, 932, "auto", false], [1024, 844, "mobile", false], [1024, 844, "mobile", true], [1440, 900, "pc", true]]) {
      const page = await open({ width, height, view, easy })
      await settle(page, 300)
      const f = await fit(page)
      assert.ok(f.inline && !f.disclosure, `${width}×${height} ${view} ${easy}: ${JSON.stringify(f)}`)
      if (view !== "pc") assert.ok(f.scroll <= 1, `${width}×${height} fits without scrolling (${f.scroll})`)
      await done(page)
    }
    for (const [width, height, view] of [[360, 640, "auto"], [320, 640, "auto"], [1280, 720, "mobile"]]) {
      const page = await open({ width, height, view, easy: true })
      await settle(page, 300)
      const f = await fit(page)
      assert.ok(!f.inline && f.disclosure, `${width}×${height} easy collapsed: ${JSON.stringify(f)}`)
      if (view === "auto") assert.ok(f.scroll <= 1, `${width}×${height} easy: no scrolling while collapsed (${f.scroll})`)
      const summary = page.locator(".photo-examples-disclosure > summary")
      assert.equal((await summary.innerText()).trim(), "좋은 사진 보기")
      assert.equal(await triangle(page), '"▸"')
      assert.equal(await page.locator(".photo-examples-disclosure img").first().isVisible(), false)
      await summary.click()
      assert.equal(await triangle(page), '"▾"')
      assert.ok(await page.locator(".photo-examples-disclosure img").first().isVisible())
      assert.equal(await page.locator(".photo-examples-disclosure figcaption").count(), 3)
      await summary.click()
      assert.equal(await triangle(page), '"▸"')
      await done(page)
    }
  })
} finally {
  await browser.close()
}
console.log(`PASS: verify-photo-step ${results.length} checks (api photoCheck, local + AI photo check, single analyze call, camera/album, examples disclosure)`)
