// Renders docs/기술문서/기술문서.html into 기술문서_1~3.png and 기술문서.pdf (Playwright, Edge).
// Fails when a sheet's content is taller than the sheet (it would be cut off in the PNG/PDF).
import { chromium } from "playwright"
import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, join } from "node:path"

const folder = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "기술문서")
const browser = await chromium.launch({ channel: "msedge" })
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1131 }, deviceScaleFactor: 1.5 })
  await page.goto(pathToFileURL(join(folder, "기술문서.html")).href, { waitUntil: "networkidle" })
  await page.evaluate(() => document.fonts.ready)
  const overflow = await page.$$eval(".sheet", (sheets) =>
    sheets.map((sheet, i) => {
      const bottom = sheet.getBoundingClientRect().bottom
      const worst = Math.max(...[...sheet.querySelectorAll("*")].map((el) => el.getBoundingClientRect().bottom))
      return { sheet: i + 1, over: Math.round(worst - bottom) }
    }),
  )
  const sheets = await page.$$(".sheet")
  for (const [i, sheet] of sheets.entries()) await sheet.screenshot({ path: join(folder, `기술문서_${i + 1}.png`) })
  await page.pdf({ path: join(folder, "기술문서.pdf"), width: "1600px", height: "1131px", printBackground: true })
  console.log(JSON.stringify(overflow))
  if (overflow.some((item) => item.over > 0)) process.exitCode = 1
} finally {
  await browser.close()
}
