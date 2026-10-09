import { chromium } from "playwright"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import assert from "node:assert/strict"

const root = new URL("../", import.meta.url)
const out = new URL("ui-review/phase4b/", root)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: "msedge", headless: true })
const report = { viewports: [], errors: [], assets: [], contrast: [] }
try {
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    page.on("pageerror", error => report.errors.push(error.message))
    await page.goto("http://127.0.0.1:5173/")
    const logo = page.locator(".studio-brand-logo")
    await logo.evaluate(img => img.decode())
    assert.match(await page.title(), /홍보잇다/)
    const metrics = await page.evaluate(() => {
      const logo = document.querySelector(".studio-brand-logo").getBoundingClientRect()
      const menu = document.querySelector(".studio-menu-button").getBoundingClientRect()
      const button = document.querySelector(".studio-brand-button").getBoundingClientRect()
      return { overflow: document.documentElement.scrollWidth > innerWidth, logoWidth: logo.width, logoHeight: logo.height, overlap: logo.right > menu.left, touchHeight: button.height }
    })
    assert.equal(metrics.overflow, false)
    assert.equal(metrics.overlap, false, JSON.stringify({ width, ...metrics }))
    assert(metrics.touchHeight >= 44)
    assert(Math.abs(metrics.logoWidth / metrics.logoHeight - 700 / 180) < .01)
    if ([320, 390, 1440].includes(width)) await page.screenshot({ path: fileURLToPath(new URL(`home-${width}.png`, out)), fullPage: true })
    await page.getByRole("button", { name: "메뉴 열기", exact: true }).click()
    await page.getByRole("dialog").getByRole("img", { name: "홍보잇다", exact: true }).evaluate(img => img.decode())
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.getByRole("button", { name: "로그인 화면 보기", exact: true }).click()
    await page.locator(".studio-brand-logo").evaluate(img => img.decode())
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    report.viewports.push({ width, ...metrics, menu: true, login: true })
    await page.close()
  }
  for (const file of ["symbol.svg", "symbol-mono.svg", "symbol-reverse.svg", "wordmark.svg", "horizontal.svg", "horizontal-reverse.svg", "primary-stacked.svg", "icon.svg"]) {
    const svg = await readFile(new URL("public/assets/branding/selected/" + file, root), "utf8")
    assert(!/<image|<text[\s>]|data:image/.test(svg), "순수 벡터 자산")
    if (file.includes("horizontal") || file === "wordmark.svg" || file === "primary-stacked.svg") assert.equal([...svg.matchAll(/data-letter="([^"]+)"/g)].map(m => m[1]).join(""), "홍보잇다")
    report.assets.push({ file, bytes: Buffer.byteLength(svg), vector: true })
  }
  const lum = hex => hex.match(/\w\w/g).map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0)
  for (const [name, fg, bg, min] of [["본문", "26364A", "FFF8EF", 4.5], ["보조 글자", "625E59", "FFF8EF", 4.5], ["피치 카드 글자", "625E59", "F8E4D4", 4.5], ["주요 버튼", "FFFFFF", "AD4A19", 4.5], ["선택 안내", "AD4A19", "FAEDE2", 4.5], ["입력 경계", "897465", "FFFFFF", 3]]) {
    const a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
    assert(ratio >= min, `${name}: ${ratio}`)
    report.contrast.push({ name, ratio: Number(ratio.toFixed(2)) })
  }
  const sheet = await browser.newPage({ viewport: { width: 1200, height: 750 } })
  await sheet.goto("http://127.0.0.1:5173/")
  await sheet.setContent(`<html lang="ko"><meta charset="UTF-8"><style>body{margin:0;padding:40px;font:18px 'Malgun Gothic',sans-serif;color:#26364a;background:#fff8ef}h1{font-size:28px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.cell{border:1px solid #e4d7cc;border-radius:20px;padding:24px;background:white}.wide{width:100%;height:100px}.dark{background:#26364a;color:#fff8ef}.icons{display:flex;align-items:center;gap:32px}.icons img{object-fit:contain}p{margin:0 0 16px}</style><h1>홍보잇다 · C안 ‘오가는 흐름’ 적용</h1><div class="grid"><div class="cell"><p>선택한 생성 시안</p><img class="wide" src="/assets/branding/concepts/concept-c/horizontal.svg"></div><div class="cell"><p>벡터로 정리한 서비스 로고</p><img class="wide" src="/assets/branding/selected/horizontal.svg"></div><div class="cell dark"><p>어두운 배경</p><img class="wide" src="/assets/branding/selected/horizontal-reverse.svg"></div><div class="cell"><p>16 · 24 · 32 · 96px 아이콘</p><div class="icons">${[16, 24, 32, 96].map(n => `<img width="${n}" height="${n}" src="/favicon.svg">`).join("")}</div></div><div class="cell"><p>남색 단색</p><img class="wide" src="/assets/branding/selected/symbol-mono.svg"></div><div class="cell dark"><p>흰색 단색</p><img class="wide" src="/assets/branding/selected/symbol-reverse.svg"></div></div></html>`)
  await sheet.evaluate(() => Promise.all([...document.images].map(img => img.decode())))
  const bounds = await sheet.evaluate(async () => {
    const host = document.createElement("div")
    host.innerHTML = await (await fetch("/assets/branding/selected/horizontal.svg")).text()
    document.body.append(host)
    const result = [...host.querySelectorAll("svg > g")].map(g => {
      const box = g.getBoundingClientRect()
      return { top: box.top, height: box.height, center: box.top + box.height / 2 }
    })
    host.remove()
    return result
  })
  assert(Math.abs(bounds[0].center - bounds[1].center) < 2, "심볼과 한글 수직 정렬")
  report.logoAlignment = bounds
  await sheet.screenshot({ path: fileURLToPath(new URL("brand-sheet.png", out)), fullPage: true })
  assert.deepEqual(report.errors, [])
  await writeFile(new URL("verification.json", out), JSON.stringify(report, null, 2))
  console.log("PASS: 7개 너비의 홈·메뉴·로그인 로고, 한글 윤곽, 순수 SVG, 색상 대비")
} finally { await browser.close() }
