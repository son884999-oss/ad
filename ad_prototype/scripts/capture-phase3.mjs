import { chromium } from "playwright"
import { mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
const out = new URL("../ui-review/phase3/", import.meta.url)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 1000 },
    })
    await page.goto("http://127.0.0.1:5173/")
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(260)
    await page.screenshot({
      path: fileURLToPath(new URL(`home-${width}.png`, out)),
      fullPage: true,
    })
    console.log(
      width,
      await page.locator(".studio-guide-action button").boundingBox(),
      await page.locator(".studio-hero-art").boundingBox(),
    )
    await page
      .getByRole("button", { name: "홍보물 만들기", exact: true })
      .click()
    await page.waitForTimeout(260)
    await page.screenshot({
      path: fileURLToPath(new URL(`photo-${width}.png`, out)),
      fullPage: true,
    })
    await page
      .locator("input[type=file]")
      .setInputFiles(
        fileURLToPath(
          new URL(
            "../design-assets/illustrations/step-photo.png",
            import.meta.url,
          ),
        ),
      )
    await page
      .getByRole("button", { name: "사진 확인하고 다음", exact: true })
      .click()
    await page.waitForTimeout(260)
    await page.screenshot({
      path: fileURLToPath(new URL(`details-${width}.png`, out)),
      fullPage: true,
    })
    await page
      .getByRole("button", { name: "이 내용으로 결과 보기", exact: true })
      .click()
    await page.locator(".result-grid").waitFor()
    await page.waitForTimeout(260)
    await page.screenshot({
      path: fileURLToPath(new URL(`results-${width}.png`, out)),
      fullPage: true,
    })
    await page.close()
  }
} finally {
  await browser.close()
}
