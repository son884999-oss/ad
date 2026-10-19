// Renders a sheet document (default docs/기술문서/기술문서.html) into <name>_<sheet>.png per sheet and <name>.pdf, next to
// the HTML. Each `.sheet` may set data-file (the PNG suffix); otherwise its number is used.
// Usage: node scripts/render-tech-doc.mjs [path/to/document.html]
// Fails when a sheet's content is taller than the sheet (it would be cut off in the PNG/PDF).
import { chromium } from "playwright"
import { fileURLToPath, pathToFileURL } from "node:url"
import { basename, dirname, join, resolve } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const source = resolve(process.argv[2] ?? join(root, "docs", "기술문서", "기술문서.html"))
const folder = dirname(source)
const name = basename(source, ".html")
const browser = await chromium.launch({ channel: "msedge" })
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1131 }, deviceScaleFactor: 1.5 })
  await page.goto(pathToFileURL(source).href, { waitUntil: "networkidle" })
  await page.evaluate(() => document.fonts.ready)
  const sheets = await page.$$eval(".sheet", (all) =>
    all.map((sheet, i) => {
      const bottom = sheet.getBoundingClientRect().bottom
      const worst = Math.max(...[...sheet.querySelectorAll("*")].map((el) => el.getBoundingClientRect().bottom))
      return { file: sheet.dataset.file || String(i + 1), over: Math.round(worst - bottom) }
    }),
  )
  const handles = await page.$$(".sheet")
  for (const [i, handle] of handles.entries()) await handle.screenshot({ path: join(folder, `${name}_${sheets[i].file}.png`) })
  await page.pdf({ path: join(folder, `${name}.pdf`), width: "1600px", height: "1131px", printBackground: true })
  console.log(JSON.stringify(sheets))
  if (sheets.some((item) => item.over > 0)) process.exitCode = 1
} finally {
  await browser.close()
}
