// 영상 평가 묶음 (free): makes the app's shareable sample video (1080×1920 MP4) for the coffee photo, saves it, and
// captures frames at 0 / 1 / 2.5 / 4 s plus a side-by-side sheet. It also measures the caption contrast in the
// 4 s frame (10th percentile of the background under the headline and the shop name).
// A real Higgsfield clip can be checked the same way: node scripts/eval-video.mjs --file clip.mp4 --out dir
// Usage: node scripts/eval-video.mjs [baseUrl] --out dir [--file clip.mp4]
import { mkdir, readFile } from "node:fs/promises"
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
  await keepPhoto(page)
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

// A shared MP4 must be plain (no moof fragments) with its real duration in mvhd: KakaoTalk posted only the
// first 3 s of the fragmented file MediaRecorder writes (2026-10-19, src/mp4Flatten.ts).
if (file.endsWith(".mp4")) {
  const bytes = await readFile(file)
  const top = []
  for (let at = 0; at + 8 <= bytes.length;) {
    const size = bytes.readUInt32BE(at)
    top.push(bytes.toString("latin1", at + 4, at + 8))
    if (size < 8) break
    at += size
  }
  const moov = bytes.indexOf("mvhd", 0, "latin1")
  const mvhdDuration = moov > 0 ? (bytes[moov + 4] === 1 ? Number(bytes.readBigUInt64BE(moov + 28)) / bytes.readUInt32BE(moov + 24) : bytes.readUInt32BE(moov + 20) / bytes.readUInt32BE(moov + 16)) : 0
  console.log(`mp4 boxes ${top.join(" ")} · header duration ${mvhdDuration.toFixed(2)}s`)
  if (top.includes("moof") || !(mvhdDuration > 4)) {
    console.error("FAIL: the MP4 is fragmented or has no duration (KakaoTalk would cut it)")
    process.exitCode = 1
  }
}

const viewer = await browser.newPage({ viewport: { width: 540, height: 960 } })
const type = file.endsWith(".webm") ? "video/webm" : "video/mp4"
await viewer.setContent(`<body style="margin:0;background:#000"><video id=v muted style="width:540px;height:960px;object-fit:contain" src="data:${type};base64,${(await readFile(file)).toString("base64")}"></video></body>`)
// HAVE_CURRENT_DATA, and one frame after each seek: at readyState 1 the 0 s frame was captured black
await viewer.waitForFunction(() => document.getElementById("v").readyState >= 2)
const duration = await viewer.evaluate(() => document.getElementById("v").duration)
// --times 0.5,2,3.5,5.5 to look at other moments (the contrast check always reads the last one)
const times = args.includes("--times") ? args[args.indexOf("--times") + 1].split(",").map(Number) : [0, 1, 2.5, 4]
const frames = []
for (const time of times) {
  await viewer.evaluate((t) => new Promise((done) => { const el = document.getElementById("v"); el.onseeked = () => requestAnimationFrame(() => requestAnimationFrame(() => done())); el.currentTime = t }), time)
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
  // pick: which share of the background pixels to judge by (0.1 = the worst tenth; 0.5 = the typical one)
  const zone = (from, to, left = 0.02, right = 0.98, pick = 0.1) => {
    const data = ctx.getImageData(Math.round(left * img.width), Math.round(from * img.height), Math.round((right - left) * img.width), Math.round((to - from) * img.height)).data
    const ratios = []
    for (let i = 0; i < data.length; i += 16) { const l = lum(data[i], data[i + 1], data[i + 2]); if (l < 0.85) ratios.push(1.05 / (l + 0.05)) }
    ratios.sort((a, b) => a - b)
    return ratios[Math.floor(ratios.length * pick)] ?? 21
  }
  // src/videoCaption.ts with a headline and a call to action (this script's input): headline rows ≈ 1354–1458 of
  // 1920, shop name pill 240–316.
  return { headline: zone(0.705, 0.76), brand: zone(0.13, 0.16, 0.075, 0.2, 0.5) } // inside the pill: its typical colour (text edges are grey)
}, `data:image/png;base64,${(await readFile(frames.at(-1))).toString("base64")}`)

const sheet = await browser.newPage({ viewport: { width: 1600, height: 760 } })
const images = await Promise.all(frames.map(async (path) => (await readFile(path)).toString("base64")))
await sheet.setContent(`<body style="margin:0;display:flex;gap:6px;background:#555">${images.map((data, i) => `<div><img style="width:395px" src="data:image/png;base64,${data}"><p style="color:#fff;margin:0;font:16px sans-serif">${times[i]}s</p></div>`).join("")}</body>`)
await sheet.screenshot({ path: `${out}/frames.png`, fullPage: true })
await browser.close()
console.log(`video ${file}\nduration ${duration.toFixed(2)}s\ncaption contrast: headline ${contrast.headline.toFixed(2)} (large text, needs 3), shop name ${contrast.brand.toFixed(2)} (needs 4.5)\nframes ${out}/frames.png`)
