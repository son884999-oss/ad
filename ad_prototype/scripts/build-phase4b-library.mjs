import { readFile, writeFile, mkdir } from "node:fs/promises"
import { chromium } from "playwright"
import { fileURLToPath } from "node:url"
const root = new URL("../", import.meta.url)
const out = new URL("public/brand-library/", root)
await mkdir(out, { recursive: true })
const manifest = JSON.parse(
  await readFile(
    new URL("public/assets/illustrations/phase4b/asset-manifest.json", root),
    "utf8",
  ),
)
const cards = manifest.assets
  .map((asset) => {
    const image =
      asset.category === "illustration"
        ? `/assets/illustrations/phase4b/${asset.files[0].filename}`
        : "/" + asset.file.replace("public/", "")
    const dark = asset.creativeId.includes("reverse")
    return `<article><div class="preview ${
      dark ? "dark" : ""
    }"><img src="${image}" alt="${asset.purpose}" width="480" height="320"></div><h2>${asset.purpose}</h2><p>${asset.screen || asset.purpose}</p><a href="${image}" download>파일 저장</a><small>${asset.creativeId}</small></article>`
  })
  .join("")
const html = `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>홍보잇다 — 브랜드·서비스 에셋</title><style>*{box-sizing:border-box}body{margin:0;padding:clamp(20px,4vw,56px);font:18px/1.65 'Malgun Gothic',sans-serif;color:#26364a;background:#fff8ef}header{max-width:900px;margin-bottom:40px}h1{font-size:clamp(28px,4vw,44px);letter-spacing:-.04em;margin:12px 0}header>img{width:220px;height:auto}a{color:#ad4a19;display:inline-block;min-height:44px;padding:8px 0}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:24px}article{min-width:0;border:1px solid #e4d7cc;background:white;border-radius:20px;padding:20px}.preview{display:flex;align-items:center;justify-content:center;height:200px;background:#fff8ef;border-radius:12px}.preview.dark{background:#26364a}.preview>img{width:100%;height:100%;object-fit:contain;padding:16px}h2{font-size:20px;margin:16px 0 4px}p{margin:0;color:#625e59}small{display:block;font-size:14px;color:#625e59;overflow-wrap:anywhere}a:focus-visible{outline:3px solid #255c9a;outline-offset:4px}</style></head><body><header><img src="/assets/branding/selected/horizontal.svg" alt="홍보잇다"><h1>가게와 손님을 잇는 시각 언어</h1><p>승인한 C안 로고 8개 구성과 서비스 설명 삽화 12종. 크기·포맷 변환은 별도 에셋으로 세지 않았습니다.</p><a href="/">실제 서비스 보기 →</a></header><main>${cards}</main></body></html>`
await writeFile(new URL("index.html", out), html)
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  await page.goto("http://127.0.0.1:5173/brand-library/index.html")
  await page.evaluate(() =>
    Promise.all([...document.images].map((img) => img.decode())),
  )
  await page.screenshot({
    path: fileURLToPath(new URL("overview.png", out)),
    fullPage: true,
  })
} finally {
  await browser.close()
}
console.log(`${manifest.assets.length}개 에셋의 실제 파일과 용도 페이지 저장`)
