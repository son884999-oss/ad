import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises"
import { chromium } from "playwright"

const root = new URL("../", import.meta.url)
const out = new URL("public/assets/branding/selected/", root)
await mkdir(out, { recursive: true })

// 사용자가 선택한 C안의 비대칭 고리와 상승하는 끝을 단색 Bézier 면으로 정리한다.
// 생성 원본과 탐색 시안은 그대로 보관한다.
const ribbon = `M448 161 C435 178 415 184 393 193 C359 207 337 225 312 248 C264 204 218 187 158 187 C88 187 32 220 32 274 C32 327 83 355 151 355 C220 355 266 334 313 292 C353 338 377 352 412 349 C463 345 480 308 480 261 C480 219 466 186 448 161 Z
M91 274 C91 250 120 239 160 239 C204 239 245 255 277 277 C242 302 204 314 160 314 C119 314 91 302 91 274 Z
M345 274 C373 247 398 228 416 227 C437 226 445 245 444 266 C443 293 429 309 411 309 C389 310 367 293 345 274 Z`
const crossing =
  "M280 266 C290 257 301 248 312 240 C333 257 350 290 372 309 C337 308 308 293 280 266 Z"
const symbol = (color = "#E88942", fold = "#26364A") =>
  `<path fill="${color}" fill-rule="evenodd" d="${ribbon}"/><path fill="${fold}" d="${crossing}"/>`
const mono = (color) =>
  `<path fill="${color}" fill-rule="evenodd" d="${ribbon}"/>`
const svg = (viewBox, body, label = "홍보잇다") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-labelledby="title"><title id="title">${label}</title>${body}</svg>\n`
const sourceWordmark = await readFile(
  new URL("public/assets/branding/concepts/concept-c/wordmark.svg", root),
  "utf8",
)
const paths = [...sourceWordmark.matchAll(/<path[^>]+\/>/g)]
  .map((match) => match[0])
  .join("")
if (
  [...paths.matchAll(/data-letter="([^"]+)"/g)]
    .map((match) => match[1])
    .join("") !== "홍보잇다"
)
  throw Error("한글 윤곽 확인 실패")
const logo = (dark = false) =>
  svg(
    "0 0 700 180",
    `<g transform="translate(-9 -53) scale(.56)">${symbol("#E88942", dark ? "#FFF8EF" : "#26364A")}</g><g transform="translate(270 21)">${
      dark ? paths.replaceAll("#26364A", "#FFF8EF") : paths
    }</g>`,
  )
await writeFile(
  new URL("symbol.svg", out),
  svg("16 145 480 226", symbol(), "홍보잇다 · 오가는 흐름"),
)
await writeFile(
  new URL("symbol-mono.svg", out),
  svg("16 145 480 226", mono("#26364A")),
)
await writeFile(
  new URL("symbol-reverse.svg", out),
  svg("16 145 480 226", mono("#FFF8EF")),
)
await writeFile(
  new URL("wordmark.svg", out),
  sourceWordmark.replace("· c안", "· 선택한 C안"),
)
await writeFile(new URL("horizontal.svg", out), logo())
await writeFile(new URL("horizontal-reverse.svg", out), logo(true))
await writeFile(
  new URL("primary-stacked.svg", out),
  svg(
    "0 0 480 380",
    `<g transform="translate(0 -121)">${symbol()}</g><g transform="translate(30 249)">${paths}</g>`,
  ),
)
await copyFile(
  new URL("public/assets/branding/concepts/FONT-LICENSE.txt", root),
  new URL("FONT-LICENSE.txt", out),
)
// 정사각 아이콘은 고리의 가로 비례를 유지한다. 작은 크기에서는 접힘보다 실루엣을 우선한다.
const icon = svg(
  "0 0 512 512",
  `<rect width="512" height="512" rx="112" fill="#FFF8EF"/>${symbol()}`,
)
await writeFile(new URL("icon.svg", out), icon)
await writeFile(new URL("public/favicon.svg", root), icon)

const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
  const page = await browser.newPage()
  const png = await page.evaluate(async (data) => {
    const img = new Image()
    img.src = "data:image/svg+xml;base64," + data
    await img.decode()
    const canvas = document.createElement("canvas")
    canvas.width = 180
    canvas.height = 180
    canvas.getContext("2d").drawImage(img, 0, 0, 180, 180)
    return canvas.toDataURL("image/png").split(",")[1]
  }, Buffer.from(icon).toString("base64"))
  await writeFile(
    new URL("apple-touch-icon.png", out),
    Buffer.from(png, "base64"),
  )
} finally {
  await browser.close()
}
console.log(
  "C안: 순수 SVG 심볼·단색·반전·한글·가로 조합·favicon·터치 아이콘 제작 완료",
)
