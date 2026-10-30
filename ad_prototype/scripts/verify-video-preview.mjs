// Completed-video preview regression. Every API is blocked; no AI or paid service is called.
// Run a Vite --mode mock server first, then:
// PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/verify-video-preview.mjs [baseUrl] [outputDir]
import assert from "node:assert/strict"
import { mkdir, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { chromium } from "playwright"

const base = process.argv[2] || "http://127.0.0.1:5174/"
const out = resolve(process.argv[3] || join(tmpdir(), "hongboitda-video-preview-qa"))
await mkdir(out, { recursive: true })
const fixture = join(out, "preview-fixture.mp4")
const encoded = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", resolve("public/assets/reference-fresh/coffee.webp"), "-t", "4", "-vf", "scale=180:320:force_original_aspect_ratio=decrease,pad=180:320:(ow-iw)/2:(oh-ih)/2:color=beige", "-r", "10", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", fixture], { encoding: "utf8" })
assert.equal(encoded.status, 0, `FFmpeg fixture: ${encoded.stderr || encoded.error || "failed"}`)
const bytes = await readFile(fixture)
const launch = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: process.env.PLAYWRIGHT_CHROMIUM_ARGS ? JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS) : ["--no-sandbox", "--disable-dev-shm-usage"] }
  : process.platform === "win32" ? { channel: "msedge" } : {}
const browser = await chromium.launch({ headless: true, ...launch })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on("pageerror", (error) => errors.push(error.message))
await page.route("**/api/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"TEST_API_BLOCKED"}' }))
if (process.env.PLAYWRIGHT_TEST_FONT) {
  const font = await readFile(process.env.PLAYWRIGHT_TEST_FONT)
  await page.route("**/__qa-font.woff2", (route) => route.fulfill({ status: 200, contentType: "font/woff2", body: font }))
}

let release
let ready = new Promise((resolve) => { release = resolve })
await page.route("**/__qa-video.mp4*", async (route) => {
  await ready
  const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/)
  if (range) {
    const start = Number(range[1])
    const end = range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1
    await route.fulfill({ status: 206, contentType: "video/mp4", headers: { "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${bytes.length}` }, body: bytes.subarray(start, end + 1) })
  } else {
    await route.fulfill({ status: 200, contentType: "video/mp4", headers: { "accept-ranges": "bytes" }, body: bytes })
  }
})
await page.route("**/__qa-broken.mp4", (route) => route.fulfill({ status: 200, contentType: "video/mp4", body: "not-a-video" }))

try {
  await page.goto(base)
  if (process.env.PLAYWRIGHT_TEST_FONT)
    await page.addStyleTag({ content: '@font-face{font-family:VideoPreviewQa;src:url("/__qa-font.woff2") format("woff2");font-weight:100 900} :root{font-family:VideoPreviewQa,sans-serif}' })
  await page.evaluate(async () => {
    const reactModule = await import("/node_modules/.vite/deps/react.js")
    const React = reactModule.default ?? reactModule
    const domModule = await import("/node_modules/.vite/deps/react-dom_client.js")
    const { createRoot } = domModule.default ?? domModule
    const { default: VideoPreviewPlayer } = await import("/src/VideoPreviewPlayer.tsx")
    const original = document.getElementById("root")
    if (original) original.style.display = "none"
    const host = document.createElement("div")
    document.body.append(host)
    window.videoQaEvents = []
    for (const name of ["loadedmetadata", "loadeddata", "seeked", "playing", "error"])
      document.addEventListener(name, (event) => {
        const node = event.target
        if (node instanceof HTMLVideoElement && node.classList.contains("motion-preview-video"))
          window.videoQaEvents.push({ event: name, time: node.currentTime, duration: node.duration, ready: node.readyState, seeking: node.seeking, error: node.error?.code })
      }, true)
    const root = createRoot(host)
    function Harness({ src, poster }) {
      const [playing, setPlaying] = React.useState(false)
      return React.createElement("div", { className: "reference-app studio-shell", style: { width: "390px", margin: "0 auto" } },
        React.createElement("div", { className: "results-step" },
          React.createElement("div", { className: "result-card result-video" },
            React.createElement("div", { className: "result-preview" },
              React.createElement("div", { className: "result-motion-preview", style: { position: "relative" } },
                React.createElement(VideoPreviewPlayer, { src, poster, playing, onPlayingChange: setPlaying, label: "테스트 영상 미리보기" }),
                React.createElement("button", { className: "result-preview-action video-play-overlay", onClick: () => setPlaying(!playing) }, playing ? "일시 정지" : "재생하기"))))))
    }
    window.renderVideoQa = (src, poster) => root.render(React.createElement(Harness, { src, poster }))
    window.renderVideoQa("/__qa-video.mp4", "/assets/reference-fresh/coffee.webp")
  })
  const video = page.getByLabel("테스트 영상 미리보기")
  const cover = page.locator(".video-first-frame-cover")
  await cover.waitFor()
  await page.waitForFunction(() => document.querySelector(".video-first-frame-cover img")?.naturalWidth > 0)
  assert.equal(await video.getAttribute("poster"), "/assets/reference-fresh/coffee.webp")
  assert.equal(await video.evaluate((node) => getComputedStyle(node).opacity), "0")
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: join(out, "first-load-photo-cover.png") })
  release()
  await page.waitForFunction(() => document.querySelector("video.motion-preview-video")?.dataset.frameReady === "true")
  assert.equal(await cover.count(), 0)
  assert.ok(Math.abs(await video.evaluate((node) => node.currentTime) - 3) < 0.15, JSON.stringify(await video.evaluate(node => ({ time:node.currentTime, duration:node.duration, ready:node.readyState, seeking:node.seeking, paused:node.paused }))))
  assert.equal(await video.evaluate((node) => getComputedStyle(node).opacity), "1")
  await page.screenshot({ path: join(out, "decoded-preview-frame.png") })
  await page.getByRole("button", { name: "재생하기", exact: true }).click()
  await page.waitForFunction(() => !document.querySelector("video.motion-preview-video")?.paused)
  await page.getByRole("button", { name: "일시 정지", exact: true }).click()
  await page.waitForFunction(() => document.querySelector("video.motion-preview-video")?.paused)

  await page.evaluate(() => window.renderVideoQa("/__qa-broken.mp4", "/assets/reference-fresh/coffee.webp"))
  await page.getByRole("alert").filter({ hasText: "영상을 불러오지 못했어요" }).waitFor()
  assert.equal(await cover.count(), 1)
  assert.equal(await video.getAttribute("data-frame-ready"), "false")
  await page.screenshot({ path: join(out, "decode-error-photo-cover.png") })

  // A replacement source must not inherit the old source's decoded state.
  ready = new Promise((resolve) => { release = resolve })
  await page.evaluate(() => window.renderVideoQa("/__qa-video.mp4?replacement=1", "/assets/reference-fresh/coffee.webp?replacement=1"))
  await cover.waitFor()
  assert.equal(await page.getByRole("alert").filter({ hasText: "영상을 불러오지 못했어요" }).count(), 0)
  assert.match(await cover.locator("img").getAttribute("src"), /replacement=1/)
  assert.equal(await video.getAttribute("data-frame-ready"), "false")
  release()
  await page.waitForFunction(() => document.querySelector("video.motion-preview-video")?.dataset.frameReady === "true")
  assert.equal(await cover.count(), 0)
  assert.deepEqual(errors, [])
  console.log("PASS - delayed first decode uses a photo cover, frame seek reveals the clip, playback works, decode failure is explained, replacement resets readiness")
  console.log(`Screenshots: ${out}`)
} catch (error) {
  console.error(await page.evaluate(() => ({ events: window.videoQaEvents, video: [...document.querySelectorAll("video.motion-preview-video")].map(node => ({ src: node.currentSrc, time: node.currentTime, duration: node.duration, ready: node.readyState, seeking: node.seeking, error: node.error?.code })) })))
  throw error
} finally {
  release?.()
  await browser.close()
}
