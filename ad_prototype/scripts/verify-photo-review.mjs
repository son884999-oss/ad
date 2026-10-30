// Closed response contracts and UI recovery. All /api traffic is intercepted; no real AI is called.
import assert from "node:assert/strict"
import { mkdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { parsePhotoReview as parseServerReview, PHOTO_RESPONSE_SCHEMA } from "../api/_lib/photo.js"
import { parsePhotoReview, reviewWithQuality } from "../src/photoReview.ts"

const base = process.argv[2] || "http://127.0.0.1:5174/"
const shots = process.env.PHOTO_REVIEW_SHOTS || "/tmp/hongboitda-photo-review"
mkdirSync(shots, { recursive: true })
let count = 0
const check = async (name, fn) => { if (process.env.PHOTO_REVIEW_CASE && !name.includes(process.env.PHOTO_REVIEW_CASE)) return; await fn(); count++; console.log("PASS", name) }
await check("API + browser reject unknown, object, inherited and duplicate categories", () => {
  for (const parse of [parseServerReview, parsePhotoReview]) {
    for (const invalid of [null, [], "x", { items: null }, { items: [{ category: { toString: "person" } }, { category: "__proto__" }, { category: "unknown" }] }]) assert.deepEqual(parse(invalid), { items: [], uncertain: false })
    const result = parse({ items: [{ category: "person", reason: "가".repeat(150) }, { category: "person", reason: "중복" }, ...["animal", "building", "alcohol", "credit_card"].map(category => ({ category, reason: "확인" }))], uncertain: "true" })
    assert.equal(result.items.length, 4); assert.equal(result.items[0].reason.length, 100); assert.equal(result.uncertain, false)
  }
  assert.ok(PHOTO_RESPONSE_SCHEMA.required.includes("photoReview"))
  assert.equal(reviewWithQuality({ items: [{ category: "blurry", reason: "확인" }] }, { isRealPhoto: true, isBlurry: true, reason: "흐림" }).items.length, 1)
})
if (process.env.PHOTO_REVIEW_UNIT_ONLY === "1") process.exit(0)
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: process.env.PLAYWRIGHT_CHROMIUM_ARGS ? JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS) : ["--no-sandbox", "--disable-dev-shm-usage"] } : {}) })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", hasTouch: true, isMobile: true })
const good = { productName: "읽어 온 상품", description: "상품 설명", highlights: "", keyFeatures: [], targetAudience: "", tones: [], photoCheck: { isRealPhoto: true, isBlurry: false, reason: "" }, photoReview: { items: [], uncertain: false } }
const review = { ...good, photoReview: { items: [{ category: "person", reason: "사진에 사람이 보여요" }, { category: "credit_card", reason: "카드로 보이는 물건이 있어요" }], uncertain: true } }
async function open({ width = 390, easy = false, initialName = "직접 적은 상품" } = {}) {
  const page = await context.newPage()
  await page.setViewportSize({ width, height: 844 })
  page.errors = []; page.calls = 0; page.answer = () => ({ status: 200, body: good })
  page.on("pageerror", e => page.errors.push(e.message))
  await page.route("**/api/**", async route => {
    if (route.request().url().includes("/analyze-photo")) {
      page.calls++
      const reply = await page.answer()
      return route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) })
    }
    return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"AI_NOT_CONFIGURED"}' })
  })
  await page.goto(base)
  if (process.env.PHOTO_REVIEW_FONT_ROOT) {
    const root = process.env.PHOTO_REVIEW_FONT_ROOT
    const faces = [[400, "Regular"], [600, "SemiBold"], [700, "Bold"]].map(([weight, name]) => `@font-face{font-family:PhotoReviewQA;src:url(data:font/woff;base64,${readFileSync(`${root}/Pretendard-${name}.woff`).toString("base64")}) format("woff");font-weight:${weight};font-style:normal;font-display:block}`).join("")
    await page.addStyleTag({ content: faces + 'html body,button,input,textarea,.prototype-app.studio-shell{font-family:PhotoReviewQA,sans-serif!important}' })
    await page.evaluate(() => document.fonts.ready)
  }
  const start = page.getByRole("button", { name: "바로 시작하기", exact: true })
  if (await start.isVisible()) await start.click()
  await page.getByRole("radio", { name: easy ? "쉬운 화면" : "기본 화면", exact: true }).first().click()
  await page.getByRole("button", { name: "홍보물 만들기", exact: true }).first().click()
  await page.addLocatorHandler(page.getByRole("dialog", { name: /배경을 광고 사진처럼/ }), async dialog => dialog.getByRole("button", { name: /그대로/ }).click())
  await page.locator("#product-photo").setInputFiles(resolve("public/assets/reference-fresh/coffee.webp"))
  const useAnyway = page.getByRole("button", { name: "이 사진 그대로 쓰기", exact: true })
  if (await useAnyway.isVisible()) await useAnyway.click()
  else await page.getByRole("button", { name: "다음으로", exact: false }).last().click()
  await page.locator("#field-product-name").waitFor()
  assert.equal(page.calls, 0, "upload alone never invokes photo AI")
  if (initialName) await page.locator("#field-product-name").fill(initialName)
  return page
}
const scan = page => page.getByRole("button", { name: "자동으로 채워 주기", exact: true }).click()
const generate = page => page.locator(".details-primary-bar button")
try {
  for (const options of [{ width: 390 }, { width: 360, easy: true }]) await check(`review acknowledgement, ESC gate and keyboard checkbox ${options.width}`, async () => {
    const page = await open(options); page.answer = () => ({ status: 200, body: review }); await scan(page)
    const dialog = page.getByRole("dialog", { name: "사진 내용을 확인해 주세요", exact: true })
    await dialog.waitFor(); assert.equal(await dialog.getByRole("button", { name: "확인하고 계속" }).isDisabled(), true)
    await page.screenshot({ path: `${shots}/warning-${options.width}.png`, fullPage: true })
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" })
    assert.equal(await generate(page).isDisabled(), true)
    assert.equal(await page.locator("#field-product-name").inputValue(), "직접 적은 상품")
    await page.getByRole("button", { name: "사진 내용 확인하기" }).click()
    const checkbox = dialog.getByRole("checkbox"); await checkbox.focus(); await page.keyboard.press("Space")
    assert.equal(await checkbox.isChecked(), true)
    await dialog.getByRole("button", { name: "확인하고 계속" }).click()
    assert.equal(await generate(page).isEnabled(), true)
    await page.locator("#details-photo").setInputFiles(resolve("public/assets/reference-fresh/cake.webp"))
    await page.getByRole("button", { name: "자동으로 채워 주기", exact: true }).waitFor(); await scan(page); await dialog.waitFor()
    assert.equal(await dialog.getByRole("checkbox").isChecked(), false, "new image invalidates acknowledgement")
    assert.deepEqual(page.errors, []); await page.close()
  })
  for (const kind of ["network", "empty", "unavailable"]) await check(`persistent ${kind} failure, same-photo retry, typed fields preserved`, async () => {
    const page = await open(); page.answer = () => kind === "network" ? { status: 500, body: {} } : kind === "empty" ? { status: 200, body: {} } : { status: 503, body: { error: "AI_NOT_CONFIGURED" } }
    await scan(page); await page.getByRole("button", { name: "다시 읽기", exact: true }).waitFor()
    await page.waitForTimeout(6500); assert.equal(await page.getByRole("button", { name: "다시 읽기", exact: true }).isVisible(), true, JSON.stringify({url:page.url(),calls:page.calls,status:await page.locator(".ai-fill-live").allTextContents(),body:(await page.locator("body").innerText()).slice(0,900)}))
    assert.equal(await page.locator("#field-product-name").inputValue(), "직접 적은 상품")
    await page.screenshot({ path: `${shots}/failure-${kind}.png`, fullPage: true })
    page.answer = () => ({ status: 200, body: good }); await page.getByRole("button", { name: "다시 읽기", exact: true }).click()
    await page.waitForFunction(() => !document.querySelector(".ai-fill-spinner"))
    const status = await page.locator(".ai-fill-status").innerText()
    assert.match(status, /사진을 보고 채웠어요|사진을 읽었어요|사진을 보고 미리 써 뒀어요/, `retry calls=${page.calls}, status=${status}`)
    assert.equal(page.calls, 2); assert.equal(await page.locator("#field-product-name").inputValue(), "직접 적은 상품")
    assert.deepEqual(page.errors, []); await page.close()
  })
  await check("new photo clears only old unedited AI fields; failure preserves owner fields", async () => {
    const page = await open({ initialName: "" })
    await scan(page); await page.getByText("사진을 보고 채웠어요. 맞지 않으면 고쳐 주세요.", { exact: true }).waitFor()
    assert.equal(await page.locator("#field-product-name").inputValue(), "읽어 온 상품")
    await page.getByRole("textbox", { name: "가게 이름", exact: true }).fill("직접 적은 가게")
    await page.locator("#details-photo").setInputFiles(resolve("public/assets/reference-fresh/cake.webp"))
    await page.getByRole("button", { name: "자동으로 채워 주기", exact: true }).waitFor()
    assert.equal(await page.locator("#field-product-name").inputValue(), "")
    assert.equal(await page.getByRole("textbox", { name: "가게 이름", exact: true }).inputValue(), "직접 적은 가게")
    page.answer = () => ({ status: 500, body: {} }); await scan(page); await page.getByRole("button", { name: "다시 읽기", exact: true }).waitFor()
    await page.getByRole("button", { name: "직접 입력하기", exact: true }).click()
    assert.equal(await page.getByRole("textbox", { name: "가게 이름", exact: true }).inputValue(), "직접 적은 가게")
    assert.equal(page.calls, 2); assert.deepEqual(page.errors, []); await page.close()
  })
  await check("late previous-photo analysis cannot change a new photo", async () => {
    const page = await open(); let release; page.answer = () => new Promise(resolve => { release = resolve })
    await scan(page); await page.waitForFunction(() => document.querySelector('.ai-fill-spinner'))
    await page.locator("#details-photo").setInputFiles(resolve("public/assets/reference-fresh/cake.webp"))
    await page.getByRole("button", { name: "자동으로 채워 주기", exact: true }).waitFor()
    while (!release) await page.waitForTimeout(10)
    release({ status: 200, body: review }); await page.waitForTimeout(300)
    assert.equal(await page.locator(".photo-review-pending").count(), 0)
    assert.equal(await page.locator("#field-product-name").inputValue(), "직접 적은 상품")
    assert.deepEqual(page.errors, []); await page.close()
  })
  console.log(`PASS ${count} photo review/recovery scenarios; paid API calls: 0`)
} finally { await browser.close() }
