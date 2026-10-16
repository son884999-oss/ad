// 영상 평가 묶음 (free): makes the app's shareable sample video (1080×1920 MP4) for the coffee photo, saves it, and
// captures frames at 0 / 1 / 2.5 / 4 s plus a side-by-side sheet. It also measures the caption contrast in the
// 4 s frame (10th percentile of the background under the headline and the shop name).
// A real Higgsfield clip can be checked the same way: node scripts/eval-video.mjs --file clip.mp4 --out dir
// Usage: node scripts/eval-video.mjs [baseUrl] --out dir [--file clip.mp4]
import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { chromium } from "playwright"

const args = process.argv.slice(2)
const base = args.find((arg) => arg.startsWith("http")) || "http://127.0.0.1:5173/"
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : ""
let file = args.includes("--file") ? args[args.indexOf("--file") + 1] : ""
if (!out) throw new Error("--out dir is required")
await mkdir(out, { recursive: true })

const browser = await chromium.launch({ channel: "msedge", headless: true })
if (!file) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
  await page.addInitScript(() => { try { localStorage.setItem("hongboitda-easy-asked", "1") } catch {} })
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"AI_NOT_CONFIGURED"}' }))
  await page.goto(base)
  await page.getByRole("button", { name: "홍보물 만들기", exact: true }).first().click()
  await page.locator("#product-photo").setInputFiles(resolve("public/assets/reference-fresh/coffee.webp"))
  await page.getByRole("button", { name: "다음으로" }).click()
  await page.getByLabel("제품 이름", { exact: true }).fill("수제 크림 커피")
  await page.getByLabel("가게 이름", { exact: true }).fill("골목커피")
  await page.locator(".details-primary-bar .studio-primary").click()
  await page.locator("#result-poster-preview img").waitFor()
  await page.locator("#result-tab-video").click()
  const button = page.getByRole("button", { name: "영상 다운로드" })
  await button.waitFor({ timeout: 60000 })
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 90000 }), button.click()])
  file = `${out}/sample.${download.suggestedFilename().split(".").pop()}`
  await download.saveAs(file)
  await page.close()
}

const viewer = await browser.newPage({ viewport: { width: 540, height: 960 } })
const type = file.endsWith(".webm") ? "video/webm" : "video/mp4"
await viewer.setContent(`<body style="margin:0;background:#000"><video id=v muted style="width:540px;height:960px;object-fit:contain" src="data:${type};base64,${(await readFile(file)).toString("base64")}"></video></body>`)
await viewer.waitForFunction(() => document.getElementById("v").readyState >= 1)
const duration = await viewer.evaluate(() => document.getElementById("v").duration)
const times = [0, 1, 2.5, 4]
const frames = []
for (const time of times) {
  await viewer.evaluate((t) => new Promise((done) => { const el = document.getElementById("v"); el.onseeked = () => done(); el.currentTime = t }), time)
  const path = `${out}/frame-${time}.png`
  await viewer.screenshot({ path })
  frames.push(path)
}
// Caption contrast in the last frame: background pixels (white text excluded) under the headline and shop name rows.
const contrast = await viewer.evaluate(async (src) => {
  const img = new Image()
  img.src = src
  await img.decode()
  const canvas = document.createElement("canvas")
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const zone = (from, to) => {
    const data = ctx.getImageData(20, Math.round(from * img.height), img.width - 40, Math.round((to - from) * img.height)).data
    const ratios = []
    for (let i = 0; i < data.length; i += 16) { const l = lum(data[i], data[i + 1], data[i + 2]); if (l < 0.85) ratios.push(1.05 / (l + 0.05)) }
    ratios.sort((a, b) => a - b)
    return ratios[Math.floor(ratios.length * 0.1)] ?? 21
  }
  // Headline is drawn around y 1040/1920 and the shop name around 1206/1920 (src/App.tsx sample video).
  return { headline: zone(0.49, 0.54), brand: zone(0.615, 0.64) }
}, `data:image/png;base64,${(await readFile(frames.at(-1))).toString("base64")}`)

const sheet = await browser.newPage({ viewport: { width: 1600, height: 760 } })
const images = await Promise.all(frames.map(async (path) => (await readFile(path)).toString("base64")))
await sheet.setContent(`<body style="margin:0;display:flex;gap:6px;background:#555">${images.map((data, i) => `<div><img style="width:395px" src="data:image/png;base64,${data}"><p style="color:#fff;margin:0;font:16px sans-serif">${times[i]}s</p></div>`).join("")}</body>`)
await sheet.screenshot({ path: `${out}/frames.png`, fullPage: true })
await browser.close()
console.log(`video ${file}\nduration ${duration.toFixed(2)}s\ncaption contrast: headline ${contrast.headline.toFixed(2)} (large text, needs 3), shop name ${contrast.brand.toFixed(2)} (needs 4.5)\nframes ${out}/frames.png`)
