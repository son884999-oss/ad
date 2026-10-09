import { chromium } from "playwright"
import { readFile, writeFile, mkdir } from "node:fs/promises"

// 기존 Playwright의 브라우저 인코더로 크기와 포맷만 최적화한다. 원본과 alpha는 보존한다.
const source = new URL("../design-assets/illustrations/", import.meta.url)
const target = new URL("../public/assets/illustrations/", import.meta.url)
await mkdir(target, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  channel: process.env.UI_BROWSER_CHANNEL || "msedge",
})
const report = []
try {
  const page = await browser.newPage()
  for (const name of [
    "shop-marketing-hero",
    "marketing-workspace-hero",
    "step-photo",
    "step-details",
    "step-ready",
  ]) {
    const data = (await readFile(new URL(`${name}.png`, source))).toString(
      "base64",
    )
    for (const width of name.endsWith("-hero") ? [960, 640] : [400]) {
      const output = await page.evaluate(
        async ({ data, width }) => {
          const image = new Image()
          image.src = `data:image/png;base64,${data}`
          await image.decode()
          const canvas = document.createElement("canvas")
          canvas.width = width
          canvas.height = Math.round(
            (width * image.naturalHeight) / image.naturalWidth,
          )
          canvas
            .getContext("2d")
            .drawImage(image, 0, 0, canvas.width, canvas.height)
          return {
            data: canvas.toDataURL("image/webp", 0.86).split(",")[1],
            width,
            height: canvas.height,
          }
        },
        { data, width },
      )
      const filename = `${name}${width === 640 ? "-640" : ""}.webp`
      const bytes = Buffer.from(output.data, "base64")
      await writeFile(new URL(filename, target), bytes)
      report.push({
        filename,
        transparent: name !== "marketing-workspace-hero",
        width: output.width,
        height: output.height,
        bytes: bytes.length,
      })
    }
  }
  await writeFile(
    new URL("asset-manifest.json", target),
    JSON.stringify(report, null, 2) + "\n",
  )
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
