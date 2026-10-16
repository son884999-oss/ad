// Verifies 쉬운 화면: plain/shorter wording, 말로 쓰기 (with a fake SpeechRecognition the test drives),
// result tabs, and sizes/contrast of the new controls. /api/* is answered locally (no AI quota used).
// Usage: node scripts/verify-easy-mode.mjs [baseUrl]
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

// A SpeechRecognition the test can drive: __voice.last.emit(text, isFinal) / .fail(error).
function fakeSpeech(supported) {
  if (!supported) {
    Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true })
    Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true })
    return
  }
  const voice = { instances: [], last: null }
  window.__voice = voice
  class FakeRecognition {
    constructor() {
      this.lang = ""
      this.interim = ""
      this.state = "new"
      voice.instances.push(this)
    }
    start() { this.state = "listening"; voice.last = this }
    stop() {
      this.state = "stopped"
      const heard = this.interim
      setTimeout(() => { if (heard) this.emit(heard, true); this.onend?.() }, 20)
    }
    abort() { this.state = "aborted"; setTimeout(() => this.onend?.(), 0) }
    emit(text, isFinal) {
      const result = [{ transcript: text }]
      result.isFinal = isFinal
      if (!isFinal) this.interim = text
      this.onresult?.({ resultIndex: 0, results: [result] })
    }
    fail(error) { this.onerror?.({ error }); this.onend?.() }
  }
  Object.defineProperty(window, "SpeechRecognition", { value: FakeRecognition, configurable: true })
  Object.defineProperty(window, "webkitSpeechRecognition", { value: FakeRecognition, configurable: true })
}

const browser = await chromium.launch({ channel: "msedge", headless: true })
async function open({ easy, speech = true, width = 390, height = 844, analyze = null }) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" })
  page.errors = []
  page.on("pageerror", (e) => page.errors.push(e.message))
  await page.addInitScript(fakeSpeech, speech)
  await page.route("**/api/**", (route) =>
    analyze && route.request().url().includes("analyze-photo")
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(analyze) })
      : route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"AI_NOT_CONFIGURED"}' }))
  await page.goto(base)
  if (easy) await page.getByRole("radio", { name: "쉬운 화면", exact: true }).click()
  return page
}
async function toPhoto(page) {
  await page.getByRole("button", { name: "홍보물 만들기", exact: true }).first().click()
}
async function toInfo(page) {
  await toPhoto(page)
  await page.locator("#product-photo").setInputFiles(photo)
  await page.getByRole("button", { name: "다음으로", exact: true }).click()
  await page.getByLabel("제품 이름", { exact: true }).waitFor()
}
async function toResult(page) {
  await toInfo(page)
  await page.getByLabel("제품 이름", { exact: true }).fill("수제 크림과 커피")
  await page.locator(".details-primary-bar .studio-primary").click()
  await page.locator("#result-poster-preview img").waitFor({ timeout: 20000 })
}
const texts = (page, selector) => page.locator(selector).evaluateAll((els) => els.map((e) => (e.innerText || e.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim()))
const len = (list) => list.join("").replace(/\s/g, "").length
const nameField = (page) => page.getByLabel("제품 이름", { exact: true })
const panel = (page) => page.locator(".voice-panel")

try {
  await check("easy wording differs from basic and is shorter (home, photo, info, result)", async () => {
    const collected = {}
    for (const easy of [false, true]) {
      const page = await open({ easy })
      const c = {}
      c.home = await texts(page, ".reference-home-copy > h1, .reference-home-copy > p, .reference-home-copy > small, .reference-home-steps h2, .reference-home-steps strong")
      await toPhoto(page)
      c.photo = await texts(page, ".reference-upload-box p, .upload-hint, .reference-upload-box .studio-primary, .reference-photo-examples h3, .reference-photo-examples > p")
      await page.locator("#product-photo").setInputFiles(photo)
      await page.getByRole("button", { name: "다음으로", exact: true }).click()
      await page.locator(".details-more > summary").click()
      c.info = [
        ...(await texts(page, ".details-more-fields > label")).map((t) => t.replace(/말로 하기/g, "").trim()),
        ...(await page.locator(".details-step input:not([type=file]), .details-step textarea").evaluateAll((els) => els.map((e) => e.placeholder))),
        ...(await texts(page, ".field-hint, .details-more > summary > span, .missing-details-note")),
      ]
      await page.getByLabel("제품 이름", { exact: true }).fill("수제 크림과 커피")
      await page.locator(".details-primary-bar .studio-primary").click()
      await page.locator("#result-poster-preview img").waitFor({ timeout: 20000 })
      c.result = await texts(page, "#result-poster .result-action-buttons button, .result-followup-actions button")
      collected[easy ? "easy" : "basic"] = c
      assert.deepEqual(page.errors, [])
      await page.close()
    }
    for (const key of ["home", "photo", "info", "result"]) {
      const b = collected.basic[key], e = collected.easy[key]
      assert.notDeepEqual(e, b, `${key}: easy text should differ`)
      assert.ok(key === "result" ? len(e) <= len(b) : len(e) < len(b), `${key}: easy ${len(e)} chars should be shorter than basic ${len(b)}\n${e.join(" | ")}\n${b.join(" | ")}`)
      console.log(`   ${key}: basic ${len(b)} → easy ${len(e)} chars`)
    }
    // Result buttons: plain words instead of 다운로드/공유하기 (no loanwords)
    assert.ok(collected.easy.result.includes("폰에 저장") && collected.easy.result.includes("보내기"), collected.easy.result.join(" | "))
    assert.ok(!collected.easy.result.some((t) => /다운로드|공유/.test(t)))
  })

  await check("voice: tap starts listening, final result replaces AI text, 되돌리기 restores, Tab focus does not start", async () => {
    const page = await open({ easy: true, analyze: { productName: "AI가 붙인 이름", description: "", highlights: "", keyFeatures: [], targetAudience: "", tones: [] } })
    await toInfo(page)
    await page.getByText("사진을 보고 미리 써 뒀어요. 맞으면 그대로 두세요.").waitFor()
    assert.equal(await nameField(page).inputValue(), "AI가 붙인 이름")
    // Keyboard focus (Tab) must not start the microphone.
    await page.getByRole("button", { name: "사진 바꾸기", exact: true }).focus()
    for (let i = 0; i < 6 && !(await nameField(page).evaluate((e) => e === document.activeElement)); i += 1) await page.keyboard.press("Tab")
    assert.ok(await nameField(page).evaluate((e) => e === document.activeElement), "Tab reaches 제품 이름")
    assert.equal(await panel(page).count(), 0, "Tab focus must not start listening")
    assert.equal(await page.evaluate(() => window.__voice.instances.length), 0)
    await page.keyboard.press("Shift+Tab")
    // Pointer tap starts it.
    await nameField(page).click()
    await panel(page).getByText("듣고 있어요. 말씀하세요").waitFor()
    assert.equal(await page.evaluate(() => window.__voice.last.lang), "ko-KR")
    assert.equal(await nameField(page).getAttribute("readonly"), "")
    await page.evaluate(() => window.__voice.last.emit("딸기", false))
    await panel(page).locator(".voice-interim", { hasText: "딸기" }).waitFor()
    await page.evaluate(() => window.__voice.last.emit("딸기 생크림 케이크", true))
    await panel(page).waitFor({ state: "detached" })
    assert.equal(await nameField(page).inputValue(), "딸기 생크림 케이크")
    const undo = page.getByRole("button", { name: "제품 이름 되돌리기", exact: true })
    await undo.waitFor()
    await undo.click()
    assert.equal(await nameField(page).inputValue(), "AI가 붙인 이름", "되돌리기 restores the previous text exactly")
    // Speak again; the AI never overwrites a spoken (user) value — it went through the typed-edit path.
    await page.getByRole("button", { name: "제품 이름 말로 하기", exact: true }).click()
    await panel(page).getByText("듣고 있어요. 말씀하세요").waitFor()
    await page.evaluate(() => window.__voice.last.emit("x".repeat(70), true))
    await panel(page).waitFor({ state: "detached" })
    assert.equal((await nameField(page).inputValue()).length, 50, "max length respected")
    assert.deepEqual(page.errors, [])
    await page.close()
  })

  await check("voice: 다 했어요 keeps what was heard; 키보드로 쓸게요 keeps old text and opens typing", async () => {
    const page = await open({ easy: true })
    await toInfo(page)
    await nameField(page).fill("원래 이름")
    await page.getByRole("button", { name: "가게 이름 말로 하기", exact: true }).click()
    await page.evaluate(() => window.__voice.last.emit("행복 카페", false))
    await page.getByRole("button", { name: "다 했어요", exact: true }).click()
    await panel(page).waitFor({ state: "detached" })
    assert.equal(await page.getByLabel("가게 이름", { exact: true }).inputValue(), "행복 카페")
    await page.getByRole("button", { name: "다 했어요" }).waitFor({ state: "detached" })
    await page.locator("body").click({ position: { x: 5, y: 300 } })
    await nameField(page).click()
    await panel(page).waitFor()
    await page.evaluate(() => window.__voice.last.emit("다른 말", false))
    await page.getByRole("button", { name: "키보드로 쓸게요", exact: true }).click()
    await panel(page).waitFor({ state: "detached" })
    assert.equal(await nameField(page).inputValue(), "원래 이름")
    assert.ok(await nameField(page).evaluate((e) => e === document.activeElement && !e.readOnly))
    await page.keyboard.type("!")
    assert.equal(await nameField(page).inputValue(), "원래 이름!")
    await page.locator("body").click({ position: { x: 5, y: 300 } })
    await nameField(page).click()
    assert.equal(await panel(page).count(), 0, "after choosing the keyboard, taps type")
    // Microphone blocked → short message, typing still works.
    await page.getByRole("button", { name: "가게 이름 말로 하기", exact: true }).click()
    await page.evaluate(() => window.__voice.last.fail("not-allowed"))
    await page.getByText("마이크를 허용해 주세요", { exact: false }).waitFor()
    await page.getByLabel("가게 이름", { exact: true }).fill("직접 쓴 가게")
    assert.equal(await page.getByLabel("가게 이름", { exact: true }).inputValue(), "직접 쓴 가게")
    // No speech → message, nothing replaced.
    await page.getByRole("button", { name: "가게 이름 말로 하기", exact: true }).click()
    await page.evaluate(() => window.__voice.last.fail("no-speech"))
    await page.getByText("소리가 안 들렸어요", { exact: false }).waitFor()
    assert.equal(await page.getByLabel("가게 이름", { exact: true }).inputValue(), "직접 쓴 가게")
    assert.deepEqual(page.errors, [])
    await page.close()
  })

  await check("voice: unsupported browser shows the message once and typing works", async () => {
    const page = await open({ easy: true, speech: false })
    await toInfo(page)
    await nameField(page).click()
    await page.getByText("이 브라우저는 말로 쓰기가 안 돼요. 키보드의 마이크 버튼으로 말하거나 글자로 써 주세요.").waitFor()
    assert.equal(await page.locator(".voice-mic-button").count(), 0, "no mic button without speech recognition")
    assert.equal(await panel(page).count(), 0)
    await page.keyboard.type("타이핑 이름")
    assert.equal(await nameField(page).inputValue(), "타이핑 이름")
    await page.locator("body").click({ position: { x: 5, y: 300 } })
    await page.getByLabel("가게 이름", { exact: true }).click()
    assert.equal(await page.getByText("이 브라우저는 말로 쓰기가 안 돼요", { exact: false }).count(), 0, "shown once, not on every tap")
    assert.deepEqual(page.errors, [])
    await page.close()
  })

  await check("basic mode: no mic button, tapping a field never starts listening", async () => {
    const page = await open({ easy: false })
    await toInfo(page)
    await nameField(page).click()
    await page.keyboard.type("기본")
    assert.equal(await nameField(page).inputValue(), "기본")
    assert.equal(await page.locator(".voice-mic-button, .voice-panel").count(), 0)
    assert.equal(await page.evaluate(() => window.__voice.instances.length), 0)
    await page.close()
  })

  await check("result tabs: role/names kept, arrow keys switch, ≥48px basic / ≥60px easy, selected not by colour alone", async () => {
    for (const [easy, names, min] of [[false, ["이미지", "영상", "홍보 글"], 48], [true, ["포스터", "짧은 영상", "홍보 글"], 60]]) {
      for (const [width, height] of [[320, 640], [390, 844], [1440, 900]]) {
        const page = await open({ easy, width, height })
        await toResult(page)
        const tabs = page.getByRole("tab")
        assert.deepEqual(await tabs.allInnerTexts().then((t) => t.map((x) => x.trim())), names)
        for (const name of names) assert.equal(await page.getByRole("tab", { name, exact: true }).count(), 1)
        const info = await tabs.evaluateAll((els) => els.map((e) => {
          const s = getComputedStyle(e), after = getComputedStyle(e, "::after")
          return { h: e.getBoundingClientRect().height, weight: Number(s.fontWeight), underline: after.content !== "none" && after.height !== "auto" && parseFloat(after.height) >= 3, selected: e.getAttribute("aria-selected") }
        }))
        for (const tab of info) assert.ok(tab.h >= min, `${easy ? "easy" : "basic"} ${width}: tab ${tab.h}px < ${min}`)
        const selected = info.find((t) => t.selected === "true"), other = info.find((t) => t.selected === "false")
        assert.ok(selected.underline && !other.underline && selected.weight > other.weight, JSON.stringify(info))
        await tabs.first().focus()
        await page.keyboard.press("ArrowRight")
        assert.equal(await page.getByRole("tab", { name: names[1], exact: true }).getAttribute("aria-selected"), "true")
        assert.ok(await page.getByRole("tab", { name: names[1], exact: true }).evaluate((e) => e === document.activeElement))
        await page.keyboard.press("End")
        assert.equal(await page.getByRole("tab", { name: "홍보 글", exact: true }).getAttribute("aria-selected"), "true")
        await page.keyboard.press("ArrowRight")
        assert.equal(await page.getByRole("tab", { name: names[0], exact: true }).getAttribute("aria-selected"), "true")
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        assert.deepEqual(page.errors, [])
        await page.close()
      }
    }
  })

  await check("new controls: mic/되돌리기/listening buttons ≥60px in easy, text contrast ≥4.5:1", async () => {
    const page = await open({ easy: true, width: 360, height: 740 })
    await toInfo(page)
    await nameField(page).fill("이름")
    await page.getByRole("button", { name: "제품 이름 말로 하기", exact: true }).click()
    await page.evaluate(() => window.__voice.last.emit("말한 이름", false))
    const measure = (selector) => page.locator(selector).evaluateAll((els) => {
      const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number)
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
      const bg = (e) => { for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length === 3 || c[3] > 0.5) return c.slice(0, 3); const img = getComputedStyle(n).backgroundImage; if (img.includes("gradient")) return rgb(img.match(/rgb[a]?\([^)]*\)/)[0]).slice(0, 3) } return [255, 255, 255] }
      return els.map((e) => { const r = e.getBoundingClientRect(), a = lum(rgb(getComputedStyle(e).color)), b = lum(bg(e)); return { text: e.innerText.trim(), w: r.width, h: r.height, contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) } })
    })
    const listening = await measure(".voice-mic-button, .voice-panel-actions button, .voice-panel-head strong, .voice-interim")
    await page.getByRole("button", { name: "다 했어요", exact: true }).click()
    await page.getByRole("button", { name: "제품 이름 되돌리기", exact: true }).waitFor()
    const after = await measure(".voice-undo, .voice-undo-row > span")
    for (const item of [...listening, ...after]) {
      assert.ok(item.contrast >= 4.5, `${item.text}: contrast ${item.contrast.toFixed(2)}`)
      if (/말로 하기|다 했어요|키보드로|되돌리기/.test(item.text)) assert.ok(item.h >= 60 && item.w >= 60, `${item.text}: ${item.w}x${item.h}`)
    }
    console.log("   " + [...listening, ...after].map((i) => `${i.text.slice(0, 8)} ${Math.round(i.h)}px ${i.contrast.toFixed(1)}:1`).join(" · "))
    assert.deepEqual(page.errors, [])
    await page.close()
  })
} finally {
  await browser.close()
}
console.log(`PASS: verify-easy-mode ${results.length} checks (easy wording, voice input, fallbacks, result tabs, control size/contrast)`)
