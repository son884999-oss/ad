// Verifies the 쉬운 화면 visual round: 내 홍보물 목록/격자 toggle, menu rows as big as the 만들기 cards,
// no emoji / decorative icons in 쉬운 화면, and the larger step bar. /api/* is answered locally.
// Usage: node scripts/verify-records-and-menu.mjs [baseUrl]
import assert from "node:assert/strict"
import { resolve } from "node:path"
import { chromium } from "playwright"

const base = process.argv[2] || "http://127.0.0.1:5173/"
const photo = resolve("public/assets/reference-fresh/coffee.webp")
const results = []
async function check(name, fn) {
  await fn()
  results.push(name)
  console.log("ok -", name)
}

const browser = await chromium.launch({ channel: "msedge", headless: true })
const viewports = {
  phone: { width: 390, height: 844, view: "auto" },
  small: { width: 360, height: 740, view: "auto" },
  frame: { width: 1024, height: 844, view: "mobile" },
  // Mobile web app only (2026-10-17): a computer shows the same app inside the phone frame.
  pc: { width: 1440, height: 900, view: "pc" },
}
// One browser context per scenario, so localStorage starts empty and survives reloads inside it.
async function open(vp, { easy = false } = {}) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce" })
  await context.addInitScript((view) => { try { localStorage.setItem("hongboitda-dev-view-v2", view) } catch {} }, vp.view)
  await context.route("**/api/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"AI_NOT_CONFIGURED"}' }))
  const page = await context.newPage()
  page.errors = []
  page.on("pageerror", (e) => page.errors.push(e.message))
  await page.goto(base)
  if (easy) await setEasy(page)
  return page
}
async function setEasy(page) {
  await page.getByRole("radio", { name: "쉬운 화면", exact: true }).first().click()
}
async function createRecord(page) {
  await page.getByRole("button", { name: "홍보물 만들기", exact: true }).first().click()
  await page.locator("#product-photo").setInputFiles(photo)
  await page.getByRole("button", { name: "다음으로", exact: true }).click()
  await page.getByLabel("제품 이름", { exact: true }).fill("수제 크림과 커피")
  await page.locator(".details-primary-bar .studio-primary").click()
  await page.locator("#result-poster-preview img").waitFor({ timeout: 20000 })
}
const toRecords = (page) => page.locator(".studio-bottom-nav").getByRole("button", { name: "내 홍보물", exact: true }).click()
// Wait two frames so the layout after a click has been committed before measuring it.
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
const box = (locator) => locator.evaluate((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.left, y: r.top } })
const pressed = (page, name) => page.locator(".records-view-toggle").getByRole("button", { name, exact: true }).getAttribute("aria-pressed")

// Visible text with emoji or pictograph-like symbols (✓ ♥ ■ → ★ 📱 …), and visible icons inside text controls.
async function emojiAndIcons(page) {
  return page.evaluate(() => {
    const symbol = /[\p{Extended_Pictographic}←-⇿☀-➿■-◿⬀-⯿️]/u
    const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" }
    const bad = []
    const walker = document.createTreeWalker(document.querySelector(".reference-app"), NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const n = walker.currentNode, p = n.parentElement
      if (!p || !n.textContent.trim() || p.closest(".sr-only,[aria-hidden=true],.result-preview,.poster-image-canvas") || !vis(p)) continue
      if (symbol.test(n.textContent)) bad.push(n.textContent.trim())
    }
    const icons = [...document.querySelectorAll(".studio-bottom-nav svg, .reference-menu svg, .result-tabs svg, .records-filters svg, .reference-home-create svg, .easy-toolbar svg, .record-item > svg")]
      .filter((e) => !e.closest(".reference-logo") && vis(e)).map((e) => e.closest("button")?.innerText.trim() || e.parentElement.className)
    return { bad, icons }
  })
}

try {
  await check("records: basic defaults to 목록; keyboard switches to 격자; big thumbnails; choice survives reload", async () => {
    const page = await open(viewports.phone)
    await createRecord(page)
    await toRecords(page)
    assert.equal(await pressed(page, "목록 보기"), "true")
    assert.equal(await pressed(page, "격자 보기"), "false")
    assert.equal(await page.locator(".records-list .record-item").count(), 3)
    const listThumb = await box(page.locator(".records-list .record-thumbnail").first())
    // keyboard: Tab from 목록 보기 to 격자 보기, Space selects it
    await page.locator(".records-view-toggle").getByRole("button", { name: "목록 보기", exact: true }).focus()
    await page.keyboard.press("Tab")
    assert.ok(await page.locator(".records-view-toggle").getByRole("button", { name: "격자 보기", exact: true }).evaluate((e) => e === document.activeElement))
    await page.keyboard.press("Space")
    assert.equal(await pressed(page, "격자 보기"), "true")
    assert.equal(await page.locator(".records-list").count(), 0)
    const cards = page.locator(".records-grid .record-card")
    assert.equal(await cards.count(), 3)
    await settle(page)
    const gridThumb = await box(page.locator(".records-grid .record-thumbnail").first())
    assert.ok(gridThumb.w >= listThumb.w * 1.5 && gridThumb.h >= listThumb.h * 1.5, `grid thumb ${gridThumb.w}x${gridThumb.h} vs list ${listThumb.w}x${listThumb.h}`)
    const columns = new Set(await cards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))).size
    assert.equal(columns, 2, "2 columns on a phone")
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    // the whole card is one button with the title inside; Enter opens the result
    assert.equal(await cards.first().evaluate((e) => e.tagName), "BUTTON")
    assert.match(await cards.first().innerText(), /수제 크림과 커피/)
    await cards.nth(1).focus()
    await page.keyboard.press("Enter")
    await page.getByRole("tab", { name: "영상", exact: true }).waitFor()
    assert.equal(await page.getByRole("tab", { name: "영상", exact: true }).getAttribute("aria-selected"), "true")
    await toRecords(page)
    assert.equal(await pressed(page, "격자 보기"), "true", "remembered when coming back")
    assert.equal(await page.evaluate(() => localStorage.getItem("hongboitda-records-view")), "grid")
    await page.reload()
    await createRecord(page)
    await toRecords(page)
    assert.equal(await pressed(page, "격자 보기"), "true", "remembered after reload")
    assert.deepEqual(page.errors, [])
    await page.context().close()
  })

  await check("records: 쉬운 화면 defaults to 크게 보기 (grid), toggle ≥60px, 줄로 보기 switches back; empty state has no toggle", async () => {
    const page = await open(viewports.phone, { easy: true })
    await toRecords(page)
    assert.equal(await page.locator(".records-view-toggle").count(), 0, "empty state unchanged: no toggle")
    await page.locator(".empty-results").waitFor()
    await createRecord(page)
    await toRecords(page)
    assert.equal(await pressed(page, "크게 보기"), "true")
    assert.equal(await page.locator(".records-grid .record-card").count(), 3)
    for (const b of await page.locator(".records-view-toggle button").all()) assert.ok((await box(b)).h >= 60, "easy toggle ≥60px")
    await page.locator(".records-view-toggle").getByRole("button", { name: "줄로 보기", exact: true }).click()
    assert.equal(await page.locator(".records-list .record-item").count(), 3)
    assert.equal(await pressed(page, "줄로 보기"), "true")
    assert.deepEqual(page.errors, [])
    await page.context().close()
  })

  await check("records: on a computer (phone frame) the grid keeps 2 columns with large thumbnails", async () => {
    for (const easy of [false, true]) {
      const page = await open(viewports.pc, { easy })
      await createRecord(page)
      await toRecords(page)
      if (!easy) await page.locator(".records-view-toggle").getByRole("button", { name: "격자 보기", exact: true }).click()
      const cols = await page.locator(".records-grid").evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(" ").length)
      assert.equal(cols, 2, `framed grid columns ${cols}`)
      await settle(page)
      const thumb = await box(page.locator(".records-grid .record-thumbnail").first())
      assert.ok(thumb.w >= 150, `framed grid thumbnail ${thumb.w}px`)
      assert.deepEqual(page.errors, [])
      await page.context().close()
    }
  })

  await check("menu (쉬운 화면): 내 홍보물 보기 … 쉬운 화면 rows match the 만들기 card height (±4px) on phone, framed phone and PC", async () => {
    for (const [name, vp] of Object.entries(viewports)) {
      const page = await open(vp, { easy: true })
      await page.getByRole("button", { name: "전체 메뉴 열기", exact: true }).click()
      const m = await page.evaluate(() => {
        const h = (e) => e.getBoundingClientRect().height, fs = (e) => parseFloat(getComputedStyle(e).fontSize)
        const card = document.querySelector(".studio-menu-row")
        return {
          card: h(card), cardFont: fs(card.querySelector("strong")),
          rows: [...document.querySelectorAll(".reference-menu-links button, .reference-toggle-row")].map((e) => ({ text: e.innerText.split("\n")[0], h: h(e), font: fs(e), radius: parseFloat(getComputedStyle(e).borderTopLeftRadius) })),
        }
      })
      // 내 홍보물 · 이용 요금 · 로그인 · 쉬운 화면 (the developer switch was removed on 2026-10-17)
      assert.equal(m.rows.length, 4)
      for (const row of m.rows) {
        assert.ok(Math.abs(row.h - m.card) <= 4, `${name}: ${row.text} ${row.h}px vs card ${m.card}px`)
        assert.ok(row.font >= m.cardFont - 0.5, `${name}: ${row.text} font ${row.font} < card ${m.cardFont}`)
        assert.ok(row.radius >= 10, `${name}: ${row.text} should look like a card`)
      }
      console.log(`   ${name}: card ${Math.round(m.card)}px, rows ${m.rows.map((r) => Math.round(r.h)).join("/")}px, font ${m.rows[0].font}px`)
      assert.deepEqual(page.errors, [])
      await page.context().close()
    }
  })

  await check("쉬운 화면: no emoji or decorative icons on home, menu, records and result; step bar labels ≥18px", async () => {
    for (const name of ["phone", "pc"]) {
      const page = await open(viewports[name], { easy: true })
      const screens = {}
      screens.home = await emojiAndIcons(page)
      await page.getByRole("button", { name: "전체 메뉴 열기", exact: true }).click()
      screens.menu = await emojiAndIcons(page)
      await page.getByRole("button", { name: "메뉴 닫기", exact: true }).click()
      await page.getByRole("button", { name: "홍보물 만들기", exact: true }).first().click()
      const stepPhoto = await page.locator(".journey-label").evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)))
      await page.locator("#product-photo").setInputFiles(photo)
      await page.getByRole("button", { name: "다음으로", exact: true }).click()
      await page.getByLabel("제품 이름", { exact: true }).fill("수제 크림과 커피")
      const step = await page.evaluate(() => ({
        labels: [...document.querySelectorAll(".journey-label")].map((e) => parseFloat(getComputedStyle(e).fontSize)),
        node: document.querySelector(".journey-node").getBoundingClientRect().height,
        currentWeight: Number(getComputedStyle(document.querySelector("[data-state=current] .journey-label")).fontWeight),
        action: document.querySelector(".details-primary-bar .studio-primary").getBoundingClientRect().bottom,
        navTop: (() => { const n = document.querySelector(".studio-bottom-nav:not(.is-top)"); return n ? n.getBoundingClientRect().top : innerHeight })(),
      }))
      for (const size of [...stepPhoto, ...step.labels]) assert.ok(size >= 18, `${name}: step label ${size}px`)
      assert.ok(step.node >= 38, `${name}: step node ${step.node}px`)
      assert.ok(step.currentWeight >= 800, "current step is bold")
      if (name === "phone") assert.ok(step.action <= step.navTop + 1, `홍보물 만들기 stays on screen (${step.action} > ${step.navTop})`)
      screens.info = await emojiAndIcons(page)
      await page.locator(".details-primary-bar .studio-primary").click()
      await page.locator("#result-poster-preview img").waitFor({ timeout: 20000 })
      screens.result = await emojiAndIcons(page)
      await page.getByRole("tab", { name: "홍보 글", exact: true }).click()
      screens.resultText = await emojiAndIcons(page)
      await toRecords(page)
      screens.records = await emojiAndIcons(page)
      for (const [screen, found] of Object.entries(screens)) {
        assert.deepEqual(found.bad, [], `${name} ${screen}: emoji/symbols in easy text`)
        assert.deepEqual(found.icons, [], `${name} ${screen}: decorative icons still shown`)
      }
      // basic mode keeps its icons
      await page.getByRole("radio", { name: "기본 화면", exact: true }).first().click()
      assert.ok(await page.locator(".studio-bottom-nav svg").first().isVisible(), "basic mode keeps nav icons")
      assert.deepEqual(page.errors, [])
      await page.context().close()
    }
  })
} finally {
  await browser.close()
}
console.log(`PASS: verify-records-and-menu ${results.length} checks (records toggle/grid/persistence, easy menu rows, no emoji/icons, step bar)`)
