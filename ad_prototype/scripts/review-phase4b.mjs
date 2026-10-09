import { chromium } from "playwright"
import { readFile, mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
const root = new URL("../", import.meta.url)
const output = new URL("ui-review/phase4b-work/", root)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
  const page = await browser.newPage()
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto("http://127.0.0.1:5173/")
    await page.locator(".studio-hero-art img").evaluate((img) => img.decode())
    await page
      .locator(".studio-start-guide")
      .screenshot({ path: fileURLToPath(new URL(`hero-${width}.png`, output)) })
  }
  const manifest = JSON.parse(
    await readFile(
      new URL("public/assets/illustrations/phase4b/asset-manifest.json", root),
      "utf8",
    ),
  )
  await page.setViewportSize({ width: 1200, height: 1000 })
  await page.setContent(
    `<style>body{background:#fff8ef;padding:24px;font:16px 'Malgun Gothic',sans-serif;color:#26364a}main{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}article{background:white;border:1px solid #e4d7cc;border-radius:14px;padding:16px}img{width:100%;height:200px;object-fit:contain}p{margin:0}</style><main>${manifest.assets
      .filter((a) => a.category === "illustration")
      .map(
        (a) =>
          `<article><p>${a.creativeId}</p><img src="http://127.0.0.1:5173/assets/illustrations/phase4b/${a.files[0].filename}"/></article>`,
      )
      .join("")}</main>`,
  )
  await page.evaluate(() =>
    Promise.all([...document.images].map((img) => img.decode())),
  )
  await page.screenshot({
    path: fileURLToPath(new URL("illustration-sheet.png", output)),
    fullPage: true,
  })
} finally {
  await browser.close()
}
