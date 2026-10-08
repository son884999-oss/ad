import { chromium } from "playwright"
import { fileURLToPath } from "node:url"
import { writeFile, mkdir } from "node:fs/promises"
const browser = await chromium.launch({
  headless: true,
  channel: process.env.UI_BROWSER_CHANNEL || "msedge",
})
const results = []
const output = new URL("../ui-review/", import.meta.url)
await mkdir(output, { recursive: true })
try {
  for (const width of [320, 390, 768]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } })
    await page.goto("http://127.0.0.1:5173/")
    await page
      .getByRole("button", { name: "바로 시작하기", exact: true })
      .click()
    await page
      .getByRole("button", { name: "만들러 가기", exact: true })
      .click()
    await page
      .locator("input[type=file]")
      .setInputFiles(
        fileURLToPath(
          new URL("../../D_고혜숙/public/sample-product.png", import.meta.url),
        ),
      )
    await page
      .getByRole("button", { name: "사진 확인하고 다음", exact: true })
      .click()
    await page
      .getByLabel("제품 설명", { exact: true })
      .fill("자연에서찾은싱그러움과우리일상의편안한샤워시간".repeat(8))
    await page
      .getByLabel("강조할 특징", { exact: true })
      .fill("매일함께하는싱그러운샤워루틴".repeat(8))
    await page
      .getByLabel("주요 고객", { exact: true })
      .fill("제품설명을읽고직접선택하고싶은우리동네고객".repeat(4))
    const inputState = await page.evaluate(() => ({
      nav: getComputedStyle(document.querySelector(".mobile-navigation"))
        .display,
      position: getComputedStyle(document.querySelector(".mobile-primary-bar"))
        .position,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }))
    if (
      inputState.nav !== "none" ||
      inputState.position !== "static" ||
      inputState.overflow
    )
      throw Error(JSON.stringify(inputState))
    await page
      .getByRole("button", { name: "이 내용으로 결과 보기", exact: true })
      .click()
    await page.locator("#result-copy").waitFor()
    const longState = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      fullText: document.querySelector("#result-copy").textContent.length,
      nav: getComputedStyle(document.querySelector(".mobile-navigation"))
        .display,
    }))
    if (
      longState.overflow ||
      longState.fullText < 200 ||
      longState.nav === "none"
    )
      throw Error(JSON.stringify(longState))
    const canvas = await page.evaluate(async () => {
      const { wrapCanvasText } = await import("/src/canvasText.ts")
      const context = document.createElement("canvas").getContext("2d")
      context.font = "64px sans-serif"
      const cases = [
        "아주긴무공백상품명".repeat(20),
        "자연 🍃👨‍👩‍👧‍👦 느낌의 상품명 ".repeat(20),
        "첫째줄\n둘째줄",
      ]
      return cases.map((text) => {
        const lines = wrapCanvasText(context, text, 500, 3)
        return { lines, widths: lines.map((s) => context.measureText(s).width) }
      })
    })
    if (
      canvas.some((c) => c.lines.length > 3 || c.widths.some((w) => w > 500)) ||
      !canvas[0].lines.at(-1).endsWith("…") ||
      canvas[2].lines.join("|") !== "첫째줄|둘째줄"
    )
      throw Error(JSON.stringify(canvas))
    if ((await page.getByRole("switch",{name:"간편모드",exact:true}).getAttribute("aria-checked")) !== "true") await page.getByRole("switch",{name:"간편모드",exact:true}).click()
    await page.screenshot({
      path: fileURLToPath(new URL(`long-results-${width}.png`, output)),
      fullPage: true,
    })
    await page.setViewportSize({ width, height: 420 })
    const short = await page.evaluate(() => ({
      header: getComputedStyle(document.querySelector("header")).position,
      nav: getComputedStyle(document.querySelector(".mobile-navigation"))
        .position,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }))
    if (short.header === "sticky" || short.nav === "fixed" || short.overflow)
      throw Error(JSON.stringify(short))
    results.push({ width, inputState, longState, canvas, short })
    await page.close()
  }
  await writeFile(
    new URL("readability-verification.json", output),
    JSON.stringify(results, null, 2),
  )
  console.log(
    "PASS: 3 narrow layouts, long Korean text, emoji-aware canvas wrapping, multiline customers, focused-field and low-height navigation.",
  )
} finally {
  await browser.close()
}
