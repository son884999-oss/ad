// 포스터 평가 묶음: 3 photos × 3 ratios rendered with the app's own renderer (through the Vite dev server),
// saved as PNG and measured while drawing:
//   - text contrast: the pixels under each text line are read just before the text is drawn (10th percentile)
//   - safe zone: text inside a 40px margin; Story (9:16) keeps the top 250px and bottom 340px clear
//   - photo area: the largest sharp draw of the product photo, as a share of the poster
//   - title lines: lines drawn in the largest font
// Visual checks (colour match, awkward empty space) are done by looking at the PNGs.
// Usage: node scripts/eval-poster.mjs [baseUrl] [--out dir]
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright"

const args = process.argv.slice(2)
const base = args.find((arg) => arg.startsWith("http")) || "http://127.0.0.1:5173/"
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : ""

const fixtures = [
  { photo: "coffee.webp", content: { eyebrow: "골목커피  ·  성수역 3번 출구", productName: "수제 크림 커피", productDescription: "아침마다 크림을 새로 만들어요", keySellingPoint: "5,500원  ·  직접 만든 크림", targetAudience: "출근길 직장인" } },
  { photo: "cake.webp", content: { eyebrow: "달빛제과", productName: "수제 딸기 초코 케이크", productDescription: "생크림과 딸기를 층층이 올렸어요", keySellingPoint: "조각 6,500원", targetAudience: "기념일을 챙기는 분" } },
  { photo: "store.webp", content: { eyebrow: "작은꽃집  ·  망원동", productName: "작은꽃집", productDescription: "제철 꽃으로 그날 만드는 꽃다발", keySellingPoint: "꽃다발 25,000원부터", targetAudience: "" } },
]
const ratios = ["4:5", "1:1", "9:16"]

const browser = await chromium.launch({ channel: "msedge", headless: true })
const page = await browser.newPage()
await page.route("**/api/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"AI_NOT_CONFIGURED"}' }))
await page.goto(base)
if (out) await mkdir(out, { recursive: true })

const results = await page.evaluate(async ({ fixtures, ratios }) => {
  const renderer = await import("/src/poster/posterRenderer.ts")
  const { photoPalette } = await import("/src/poster/photoColor.ts")
  const load = (src) => new Promise((done, fail) => { const img = new Image(); img.onload = () => done(img); img.onerror = fail; img.src = src })
  const proto = CanvasRenderingContext2D.prototype
  const realFillText = proto.fillText
  const realDrawImage = proto.drawImage
  const parse = (color) => {
    const c = document.createElement("canvas").getContext("2d")
    c.fillStyle = color
    const v = c.fillStyle
    if (v.startsWith("#")) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16))
    return (v.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number)
  }
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const rows = []
  for (const { photo, content } of fixtures) {
    const image = await load(`/assets/reference-fresh/${photo}`)
    await renderer.loadPosterFonts(Object.values(content))
    for (const ratioKey of ratios) {
      const canvas = document.createElement("canvas")
      const texts = []
      let photoArea = 0
      proto.fillText = function (text, x, y, maxWidth) {
        if (this.canvas === canvas && String(text).trim() && typeof this.fillStyle === "string") {
          const m = this.measureText(text)
          const left = Math.max(0, Math.floor(x - m.actualBoundingBoxLeft))
          const top = Math.max(0, Math.floor(y - m.actualBoundingBoxAscent))
          const w = Math.min(canvas.width - left, Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight))
          const h = Math.min(canvas.height - top, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent))
          let contrast = 21
          if (w > 0 && h > 0) {
            const data = this.getImageData(left, top, w, h).data
            const fg = parse(this.fillStyle)
            const ratiosUnder = []
            for (let i = 0; i < data.length; i += 4 * 7) ratiosUnder.push(ratio(fg, [data[i], data[i + 1], data[i + 2]]))
            ratiosUnder.sort((a, b) => a - b)
            contrast = ratiosUnder[Math.floor(ratiosUnder.length * 0.1)] ?? 21
          }
          texts.push({ text: String(text), size: parseFloat(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? "0"), box: [left, top, left + w, top + h], contrast })
        }
        return realFillText.call(this, text, x, y, maxWidth)
      }
      proto.drawImage = function (img, ...rest) {
        if (this.canvas === canvas && img === image && (this.filter === "none" || !this.filter) && this.globalAlpha > 0.9) {
          const [dw, dh] = rest.length === 8 ? rest.slice(6, 8) : rest.length === 4 ? rest.slice(2, 4) : [img.width, img.height]
          photoArea = Math.max(photoArea, (dw * dh) / (canvas.width * canvas.height))
        }
        return realDrawImage.call(this, img, ...rest)
      }
      try {
        renderer.renderPosterToCanvas({ canvas, content, productImage: image, ratioKey, aiMark: true, photoColors: photoPalette(image) })
      } finally {
        proto.fillText = realFillText
        proto.drawImage = realDrawImage
      }
      const story = ratioKey === "9:16"
      const [safeTop, safeBottom, side] = story ? [250, 340, 40] : [40, 40, 40]
      const titleSize = Math.max(...texts.map((t) => t.size))
      const issues = []
      for (const t of texts) {
        const large = t.size >= 48
        if (t.contrast < (large ? 3 : 4.5)) issues.push(`대비 ${t.contrast.toFixed(2)} "${t.text.slice(0, 16)}"`)
        const [l, tp, r, b] = t.box
        if (t.text !== "AI 활용" && (l < side || r > canvas.width - side || tp < safeTop || b > canvas.height - safeBottom)) issues.push(`안전 영역 밖 "${t.text.slice(0, 16)}"`)
      }
      const titleLines = texts.filter((t) => t.size === titleSize).length
      const penalties = Math.min(1, issues.filter((i) => i.startsWith("대비")).length) * 10 + Math.min(1, issues.filter((i) => i.startsWith("안전")).length) * 10 + (photoArea < 0.25 ? 10 : 0) + (titleLines > 2 ? 5 : 0)
      if (photoArea < 0.25) issues.push(`사진 면적 ${(photoArea * 100).toFixed(0)}%`)
      if (titleLines > 2) issues.push(`제목 ${titleLines}줄`)
      rows.push({ name: `${photo.replace(/\..*/, "")}-${ratioKey.replace(":", "x")}`, score: 100 - penalties, photoArea, lines: texts.length, minContrast: Math.min(...texts.map((t) => t.contrast)), issues, png: canvas.toDataURL("image/png").split(",")[1] })
    }
  }
  return rows
}, { fixtures, ratios })

for (const row of results) {
  console.log(`[${row.score}점] ${row.name}  사진 ${(row.photoArea * 100).toFixed(0)}%  글자 ${row.lines}줄  최저 대비 ${row.minContrast.toFixed(1)}${row.issues.length ? "\n    " + row.issues.join("\n    ") : ""}`)
  if (out) await writeFile(`${out}/${row.name}.png`, Buffer.from(row.png, "base64"))
}
console.log(`\n측정 점수 평균 ${Math.round(results.reduce((sum, row) => sum + row.score, 0) / results.length)}점 (${results.length}장, 눈으로 보는 감점 전)`)
await browser.close()
