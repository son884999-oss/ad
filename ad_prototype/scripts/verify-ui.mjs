import { fileURLToPath } from "node:url"
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright")
import { mkdir, writeFile } from "node:fs/promises"
const browser = await chromium.launch({
  headless: true,
  channel: process.env.UI_BROWSER_CHANNEL || "msedge",
})
const out = new URL("../ui-review/", import.meta.url)
await mkdir(out, { recursive: true })
const reports = []
try {
  for (const width of [320, 390, 768, 1280, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto("http://127.0.0.1:5173/")
    await page
      .getByRole("button", { name: "바로 시작하기", exact: true })
      .click()
    await page
      .getByRole("button", { name: "홍보물 만들기 시작", exact: true })
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
      .getByRole("button", { name: "이 내용으로 결과 보기", exact: true })
      .click()
    await page.locator(".result-grid").waitFor()
    for (const large of [false, true]) {
      if (large)
        await page.getByRole("button", { name: /큰 글씨·쉬운 안내/ }).click()
      const metric = await page.evaluate(() => {
        const cards = [...document.querySelectorAll(".result-card")].map(
          (c) => {
            const r = c.getBoundingClientRect()
            return { x: r.x, y: r.y, width: r.width }
          },
        )
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          columns: getComputedStyle(document.querySelector(".result-grid"))
            .gridTemplateColumns,
          cards,
          buttons: [
            ...document.querySelectorAll(
              ".result-card-actions button,.result-copy-action",
            ),
          ].map((b) => ({
            label: b.textContent,
            height: b.getBoundingClientRect().height,
          })),
          navHeight: document
            .querySelector(".mobile-navigation")
            .getBoundingClientRect().height,
        }
      })
      if (metric.overflow || errors.length || metric.cards.length !== 3)
        throw Error(JSON.stringify({ width, large, metric, errors }))
      if (
        width >= 1440 &&
        new Set(metric.cards.map((c) => Math.round(c.y))).size !== 1
      )
        throw Error("three cards must share a row")
      if (
        width < 1440 &&
        new Set(metric.cards.map((c) => Math.round(c.x))).size !== 1
      )
        throw Error("narrow layout must be one column")
      if (metric.buttons.some((b) => b.height < 48)) throw Error("small target")
      reports.push({ width, large, ...metric })
      if ([390, 1440].includes(width))
        await page.screenshot({
          path: fileURLToPath(
            new URL(`results-${width}-${large ? "large" : "normal"}.png`, out),
          ),
          fullPage: true,
        })
    }
    await page.close()
  }
  const interactions = []
  for (const format of ["포스터", "영상", "포스터와 영상 둘 다"]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    })
    await page.goto("http://127.0.0.1:5173/")
    await page
      .getByRole("button", { name: "바로 시작하기", exact: true })
      .click()
    await page
      .getByRole("button", { name: "홍보물 만들기 시작", exact: true })
      .click()
    await page.getByRole("radio", { name: format, exact: true }).click()
    await page
      .locator("input[type=file]")
      .setInputFiles({
        name: "wrong.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not a photo"),
      })
    await page
      .getByText("20MB 이하의 사진 파일을 선택해 주세요.", { exact: true })
      .waitFor()
    if (
      await page
        .getByRole("button", { name: "사진 확인하고 다음", exact: true })
        .isEnabled()
    )
      throw Error("invalid image must block next")
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
    const description = page.getByLabel("제품 설명", { exact: true })
    await description.fill("   ")
    if (
      await page
        .getByRole("button", { name: "이 내용으로 결과 보기", exact: true })
        .isEnabled()
    )
      throw Error("blank description")
    await page
      .getByText("제품 설명을 입력하면 다음으로 갈 수 있어요.", { exact: true })
      .waitFor()
    await description.fill("샘플 제품 설명")
    await page
      .getByRole("button", { name: "이 내용으로 결과 보기", exact: true })
      .click()
    const count = await page.locator(".result-card").count()
    if (count !== (format === "포스터와 영상 둘 다" ? 3 : 2))
      throw Error("wrong result count")
    await page
      .getByRole("link", { name: "홍보 글 보기 ↓", exact: true })
      .click()
    if ((await page.evaluate(() => document.activeElement.id)) !== "copy-title")
      throw Error("result focus")
    await page
      .getByRole("button", { name: "홍보 글 전체 복사하기", exact: true })
      .click()
    await page.locator("#result-copy [role=status]").waitFor()
    if (format === "포스터") {
      const download = page.waitForEvent("download")
      await page
        .getByRole("button", { name: "포스터 저장하기", exact: true })
        .click()
      if (!(await download).suggestedFilename().endsWith(".png"))
        throw Error("poster download")
    }
    if (format === "영상") {
      const download = page.waitForEvent("download")
      await page
        .getByRole("button", { name: "영상 저장하기", exact: true })
        .click()
      if (!/\.(mp4|webm)$/.test((await download).suggestedFilename()))
        throw Error("video download")
    }
    interactions.push({
      format,
      count,
      invalidFile: true,
      blankField: true,
      focus: true,
      copy: true,
    })
    await page.close()
  }
  await writeFile(
    new URL("verification.json", out),
    JSON.stringify({ layouts: reports, interactions }, null, 2),
  )
  console.log(
    `PASS: ${reports.length} responsive layouts, ${interactions.length} result combinations, image validation, field validation, result focus, copy and poster/video downloads.`,
  )
} finally {
  await browser.close()
}
