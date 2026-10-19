// Independent screen check (2026-10-17, item 17): 3 phone sizes + the PC phone frame, basic and 쉬운 화면.
// For each screen it measures horizontal scroll, controls overlapping each other, text cut by the frame,
// text under 14px, text contrast under 4.5:1, touch targets under 44px, and whether Tab reaches
// every control with a visible focus ring. /api/* is answered locally (no paid or AI calls).
// Usage: node scripts/audit-mobile-screens.mjs [baseUrl] [--shots dir]
import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { chromium } from "playwright"
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


const args = process.argv.slice(2)
const base = args.find((a) => a.startsWith("http")) || "http://127.0.0.1:5173/"
const shots = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : ""
const photo = resolve("public/assets/reference-fresh/coffee.webp")
const sizes = [[360, 740], [390, 844], [430, 932], [1440, 900]]

const analyze = {
  productName: "수제 크림 커피", description: "직접 만든 크림을 올린 커피", highlights: ["직접 만든 크림"], keyFeatures: ["직접 만든 크림"],
  targetAudience: "동네 직장인", tones: ["따뜻한"], visualDetails: ["갈색 컵"], subjectBox: null,
  photoCheck: { isRealPhoto: true, isBlurry: false, reason: "" },
}
const promo = {
  copy: "크림을 직접 올린 커피", sns: "아침마다 크림을 새로 만들어요.\n출근길에 들러 보세요.", intro: "골목커피의 수제 크림 커피입니다.",
  hashtags: ["#수제크림커피", "#골목커피", "#성수카페"], copyCandidates: ["크림을 직접 올린 커피", "출근길 크림 커피"], videoHeadline: "직접 만든 크림", cta: "들러 보세요",
}

// Runs in the page: every problem on the current screen.
function measure() {
  const frame = document.querySelector(".reference-app, .reference-login")
  const view = document.documentElement.dataset.view === "mobile" && frame ? frame.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
  const problems = []
  const label = (el) => (el.getAttribute("aria-label") || el.innerText || el.placeholder || el.className || el.tagName).toString().replace(/\s+/g, " ").trim().slice(0, 40)
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false // e.g. inside a closed <details>
    const s = getComputedStyle(el)
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05 && !el.closest("[hidden],[inert],[aria-hidden=true]")
  }
  // horizontal scroll inside the page or any scroller
  if (document.documentElement.scrollWidth > innerWidth + 1) problems.push(`가로 스크롤 ${document.documentElement.scrollWidth}>${innerWidth}`)
  for (const el of document.querySelectorAll("main *, .reference-app *")) {
    const s = getComputedStyle(el)
    if (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 2 && !/(tablist|result-tabs|chips|scroll-x)/.test(el.className + (el.getAttribute("role") || ""))) problems.push(`가로 넘침 ${label(el)}`)
  }
  // clickable things: overlap, size, cut off
  const controls = [...document.querySelectorAll("button, a[href], input:not([type=hidden]):not([type=file]), textarea, select, summary, [role=radio], [role=tab], [role=switch]")].filter(visible)
  // The part of each control that is actually drawn: cut by every scrolling/clipping ancestor.
  const shown = (el) => {
    const r = el.getBoundingClientRect()
    let { left, top, right, bottom } = r
    for (let n = el.parentElement; n; n = n.parentElement) {
      if (getComputedStyle(n).overflow === "visible") continue
      const c = n.getBoundingClientRect()
      left = Math.max(left, c.left); top = Math.max(top, c.top); right = Math.min(right, c.right); bottom = Math.min(bottom, c.bottom)
    }
    return { left, top, right, bottom }
  }
  const rects = controls.map(shown)
  const clipped = (el, r) => {
    // hidden by a scrolling ancestor is fine (user can scroll); cut by the screen edge horizontally is not
    return r.left < view.left - 1 || r.right > view.right + 1
  }
  // Bars that stay put (top bar, bottom nav, sticky action bar): content scrolling under them is normal.
  const pinned = (el) => { for (let n = el; n; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === "fixed" || p === "sticky") return true } return false }
  controls.forEach((el, i) => {
    const r = rects[i]
    if (r.right <= r.left || r.bottom <= r.top) return
    if (clipped(el, el.getBoundingClientRect())) problems.push(`화면 밖으로 잘림 ${label(el)}`)
    const full = el.getBoundingClientRect()
    const tiny = full.width < 44 || full.height < 44
    if (tiny && !el.closest("p, li, .inline-link") && el.tagName !== "A") problems.push(`누르기 작음 ${Math.round(full.width)}×${Math.round(full.height)} ${label(el)}`)
    for (let j = i + 1; j < controls.length; j++) {
      const o = rects[j]
      if (el.contains(controls[j]) || controls[j].contains(el) || pinned(el) !== pinned(controls[j])) continue
      const w = Math.min(r.right, o.right) - Math.max(r.left, o.left)
      const h = Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top)
      if (w > 4 && h > 4) {
        // overlap only counts when one is really drawn over the other at that point
        const x = Math.max(r.left, o.left) + w / 2, y = Math.max(r.top, o.top) + h / 2
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
        const top = document.elementFromPoint(x, y)
        if (top && (el.contains(top) || controls[j].contains(top))) problems.push(`겹침 ${label(el)} ↔ ${label(controls[j])}`)
      }
    }
  })
  // Scrolled to the end, nothing should stay hidden under a pinned bar.
  const scrollers = [document.scrollingElement, ...document.querySelectorAll("main *, .reference-app *")].filter((n) => n && n.scrollHeight > n.clientHeight + 2 && (n === document.scrollingElement || /(auto|scroll)/.test(getComputedStyle(n).overflowY)))
  for (const box of scrollers) {
    const before = box.scrollTop
    box.scrollTop = box.scrollHeight
    for (const el of controls) {
      if (pinned(el) || !box.contains(el)) continue
      const r = el.getBoundingClientRect()
      if (r.bottom < view.bottom - 160) continue
      const top = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, innerHeight - 1))
      if (top && !el.contains(top) && !top.contains(el) && pinned(top)) problems.push(`끝까지 내려도 가려짐 ${label(el)}`)
    }
    box.scrollTop = before
  }
  // text size and contrast
  const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : [0, 0, 0, 0] }
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const blend = (top, under) => { const a = top[3] ?? 1; return [0, 1, 2].map((k) => top[k] * a + under[k] * (1 - a)) }
  // Possible backgrounds behind the text; a gradient gives one per colour stop (the worst one counts).
  const bgOf = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.backgroundImage !== "none") {
        if (!s.backgroundImage.includes("gradient")) return null // photo behind text: skip
        const all = (s.backgroundImage.match(/rgba?\([^)]*\)/g) || []).map(parse)
        const stops = all.filter((c) => (c[3] ?? 1) >= 1)
        if (stops.length) { layers.push(stops); break }
        // Only see-through stops (a fade over a photo or video): what is behind is unknown, like a photo.
        if (all.length) return null
      }
      const c = parse(s.backgroundColor)
      if ((c[3] ?? 1) > 0) { layers.push([c]); if ((c[3] ?? 1) >= 1) break }
    }
    layers.reverse()
    return layers.reduce((unders, tops) => tops.flatMap((top) => unders.map((under) => blend(top, under))), [[255, 255, 255]])
  }
  const seen = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement
    if (!t.textContent.trim() || !el || seen.has(el) || !visible(el) || el.closest("svg, canvas, .sr-only, .visually-hidden")) continue
    seen.add(el)
    const r = el.getBoundingClientRect()
    if (r.right < view.left || r.left > view.right) continue
    const s = getComputedStyle(el)
    const size = parseFloat(s.fontSize)
    const text = t.textContent.trim().slice(0, 24)
    if (size < 14 && !el.closest(".dev-only")) problems.push(`글자 작음 ${size}px "${text}"`)
    const bgs = bgOf(el)
    if (!bgs) continue
    const ratio = Math.min(...bgs.map((bg) => { const [a, b] = [lum(blend(parse(s.color), bg)), lum(bg)].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05) }))
    const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700)
    if (ratio < (large ? 3 : 4.5)) problems.push(`대비 ${ratio.toFixed(2)} "${text}"`)
  }
  return [...new Set(problems)]
}

// Tab through the screen: every stop must be visible, inside the frame and show a focus ring.
async function keyboard(page) {
  const problems = []
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0) })
  const stops = []
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab")
    const info = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      const ring = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none")
      const covered = (() => { const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t && !el.contains(t) && !t.contains(el) && !(t.closest("label") && t.closest("label").contains(el)) ? (t.closest("[class]")?.className || t.tagName).toString().slice(0, 40) : "" })()
      return { key: el.outerHTML.slice(0, 80), label: (el.getAttribute("aria-label") || el.innerText || el.tagName).replace(/\s+/g, " ").trim().slice(0, 30), ring, size: r.width * r.height, covered: r.top >= 0 && r.bottom <= innerHeight && covered }
    })
    if (!info) continue
    if (stops.includes(info.key)) break
    stops.push(info.key)
    if (!info.size) problems.push(`보이지 않는 곳에 초점 ${info.label}`)
    else if (!info.ring) problems.push(`초점 테두리 없음 ${info.label}`)
    else if (info.covered) {
      // Measured in the same task as the key press, the previous focus target can still be on top for a frame
      // (seen once in a while with the skip link). Count it only if it is still covered two frames later.
      const still = await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = document.activeElement
        const r = el.getBoundingClientRect()
        const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        done(Boolean(t && !el.contains(t) && !t.contains(el) && !(t.closest("label") && t.closest("label").contains(el))))
      }))))
      if (still) problems.push(`초점이 가려짐 ${info.label} (← ${info.covered})`)
    }
  }
  return problems
}

const browser = await chromium.launch({ channel: "msedge", headless: true })
if (shots) await mkdir(shots, { recursive: true })
let total = 0
for (const [width, height] of sizes) {
  for (const easy of [false, true]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce", hasTouch: width < 768, isMobile: width < 768 })
    page.on("pageerror", (e) => console.log("  페이지 오류", e.message))
    await page.addInitScript((easyOn) => { try { localStorage.setItem("hongboitda-easy-asked", "1"); localStorage.setItem("hongboitda-easy-mode", easyOn ? "1" : "0") } catch {} }, easy)
    await page.route("**/api/**", (route) => {
      const url = route.request().url()
      const body = url.includes("analyze-photo") ? analyze : url.includes("promo-text") ? promo : null
      return body ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }) : route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"VIDEO_NOT_CONFIGURED"}' })
    })
    const tag = `${width}×${height} ${easy ? "쉬운" : "기본"}`
    const report = async (name) => {
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      const measured = await page.evaluate(measure)
      // Capture before the Tab walk so the picture shows the screen as a user sees it, not the last focus ring.
      if (shots) await page.screenshot({ path: `${shots}/${width}x${height}-${easy ? "easy" : "basic"}-${name}.png` })
      const problems = [...measured, ...(await keyboard(page))]
      total += problems.length
      console.log(`${problems.length ? "✗" : "ok"} ${tag} ${name}${problems.length ? "\n    " + problems.join("\n    ") : ""}`)
    }
    await page.goto(base)
    await page.getByRole("button", { name: /홍보물 만들기|홍보물 만들어요/ }).first().waitFor()
    await report("홈")
    await page.getByRole("button", { name: /홍보물 만들기|홍보물 만들어요/ }).first().click()
    await page.locator("#product-photo").waitFor({ state: "attached" })
    await report("사진")
    await page.locator("#product-photo").setInputFiles(photo)
    await page.waitForTimeout(400)
    await report("사진 넣은 뒤")
    await page.getByRole("button", { name: /다음/ }).first().click()
    // Plan C: 다음으로 asks about the background; the popup is measured like any screen, then the photo is kept.
    const ask = page.getByRole("dialog", { name: /배경을 광고 사진처럼/ })
    await ask.waitFor()
    await report("배경 팝업")
    await ask.getByRole("button", { name: /그대로/ }).click()
    await page.getByLabel(/제품 이름|무엇을 파나요|이름/).first().waitFor()
    await page.waitForTimeout(600)
    await report("내용")
    await page.locator(".details-primary-bar .studio-primary").click()
    await page.locator("#result-poster-preview img").waitFor({ timeout: 20000 })
    await report("결과-포스터")
    for (const id of ["video", "copy"]) {
      await page.locator(`#result-tab-${id}`).click()
      await page.waitForTimeout(500)
      await report(`결과-${id === "video" ? "영상" : "글"}`)
    }
    await page.getByRole("button", { name: /메뉴/ }).first().click()
    await page.locator(".reference-menu").waitFor()
    await report("메뉴")
    await page.locator(".reference-menu-links button").first().click()
    await page.waitForTimeout(500)
    await report("내 홍보물")
    await page.close()
  }
}
await browser.close()
console.log(`\n문제 ${total}개`)
