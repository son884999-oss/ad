import { chromium } from "playwright"
import { fileURLToPath } from "node:url"
import { mkdir, writeFile, readFile } from "node:fs/promises"
import assert from "node:assert/strict"

const browser = await chromium.launch({
  headless: true,
  channel: process.env.UI_BROWSER_CHANNEL || "msedge",
})
const output = new URL("../ui-review/phase2/", import.meta.url)
await mkdir(output, { recursive: true })
const report = { layouts: [], channels: [], assets: [], contrast: [] }
const sample = fileURLToPath(
  new URL("../design-assets/illustrations/step-photo.png", import.meta.url),
)
const names = [
  "파일만 저장하기",
  "네이버 스마트플레이스",
  "카카오톡 채널",
  "인스타그램",
  "네이버 블로그",
  "당근 비즈프로필",
  "유튜브 쇼츠",
  "엑스(X)",
  "쓰레드(Threads)",
]
const click = async (page, name) =>
  page.getByRole("button", { name, exact: true }).click()
async function noOverflow(page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "가로 스크롤",
  )
}
try {
  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto("http://127.0.0.1:5173/")
    await page.evaluate(() => document.fonts.ready)
    assert.match(await page.title(), /^홍보잇다/)
    await noOverflow(page)
    const cta = await page
      .getByRole("button", { name: "홍보물 만들기", exact: true })
      .boundingBox()
    assert(cta.y + cta.height < 820, "시작 버튼을 첫 화면에서 확인")
    assert.equal(
      await page
        .locator(".studio-hero-art img")
        .evaluate((i) => i.complete && i.naturalWidth > 0),
      true,
    )
    await click(page, "홍보물 만들기")
    await page.locator(".destination-settings > summary").click()
    assert.equal(
      await page
        .getByRole("radio", { name: names[0], exact: true })
        .isChecked(),
      true,
    )
    assert.deepEqual(
      await page.locator(".channel-recommended strong").allTextContents(),
      names.slice(1, 4),
    )
    await page.getByRole("radio", { name: names[0], exact: true }).focus()
    await page.keyboard.press("ArrowDown")
    assert.equal(
      await page
        .getByRole("radio", { name: names[1], exact: true })
        .isChecked(),
      true,
      "키보드 방향키 선택",
    )
    if (width < 1024)
      assert.notEqual(
        await page
          .locator(".studio-bottom-nav")
          .evaluate((e) => getComputedStyle(e).display),
        "none",
        "선택 컨트롤은 모바일 메뉴를 숨기지 않음",
      )
    await page.getByLabel("가게에 맞는 추천 보기").selectOption("service")
    assert.deepEqual(
      await page.locator(".channel-recommended strong").allTextContents(),
      [names[1], names[4], names[2]],
    )
    assert.equal(
      await page
        .getByRole("radio", { name: names[1], exact: true })
        .isChecked(),
      true,
      "추천 변경은 선택을 바꾸지 않음",
    )
    await page.getByLabel("가게에 맞는 추천 보기").selectOption("visual")
    assert.equal(
      await page.locator(".channel-recommended strong").first().textContent(),
      names[3],
    )
    await page.getByLabel("가게에 맞는 추천 보기").selectOption("local")
    assert.equal(
      await page.locator(".channel-recommended strong").nth(1).textContent(),
      names[5],
    )
    await page.getByLabel("가게에 맞는 추천 보기").selectOption("general")
    await page.locator(".channel-picker").scrollIntoViewIfNeeded()
    await page.locator(".studio-accessibility > summary").click()
    for (const easy of [true, false]) {
      const toggle = page.getByRole("switch", { name: "간편모드", exact: true })
      if ((await toggle.getAttribute("aria-checked")) !== String(easy))
        await toggle.click()
      await noOverflow(page)
      assert(
        await page
          .locator(".channel-option")
          .first()
          .evaluate((e) => e.getBoundingClientRect().height >= 52),
      )
      report.layouts.push({
        width,
        easy,
        overflow: false,
        nativeRadioKeyboard: true,
        adaptiveRecommendations: true,
      })
    }
    if ([390, 1440].includes(width)) {
      await page.locator(".channel-picker").scrollIntoViewIfNeeded()
      await page.screenshot({
        path: fileURLToPath(new URL("channels-" + width + ".png", output)),
        fullPage: false,
      })
    }
    assert.deepEqual(errors, [])
    await page.close()
  }
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text) => {
          window.__copied = text
        },
      },
      configurable: true,
    }),
  )
  await page.goto("http://127.0.0.1:5173/")
  await click(page, "홍보물 만들기")
  await page.locator(".destination-settings > summary").click()
  await page.locator("input[type=file]").setInputFiles(sample)
  for (let index = 0; index < names.length; index++) {
    const name = names[index]
    const radio = page.getByRole("radio", { name, exact: true })
    if (!(await radio.isVisible()))
      await page.locator(".channel-picker summary").click()
    await radio.check()
    await click(page, "사진 확인하고 다음")
    await page.locator(".optional-hashtags summary").click()
    const tags = page.getByLabel("사용할 검색어(#) 직접 수정", { exact: true })
    await tags.fill("#직접작성" + index)
    await page
      .getByLabel("제품 설명", { exact: true })
      .fill("정성껏 준비한 우리 가게 제품 " + index)
    assert.equal(await tags.inputValue(), "#직접작성" + index)
    await page.locator(".optional-hashtags summary").click()
    await click(page, "이 내용으로 결과 보기")
    await page.locator(".result-grid").waitFor()
    assert.equal(await page.locator(".result-card").count(), 3)
    await click(page, "홍보 글 전체 복사하기")
    const copied = await page.evaluate(() => window.__copied)
    assert(copied.includes("#직접작성" + index))
    assert(!copied.includes("undefined"))
    const links = page.locator(".publishing-guide a")
    assert.equal(await links.count(), index === 0 ? 0 : 1)
    if (index !== 0) {
      assert.equal(await links.getAttribute("target"), "_blank")
      assert.match(await links.getAttribute("rel"), /noopener/)
    }
    await noOverflow(page)
    report.channels.push({
      name,
      manualTagsPreserved: true,
      resultCount: 3,
      copy: true,
      manualUploadGuide: true,
    })
    await click(page, "내용 다시 수정하기")
    await click(page, "이전으로")
    await page.locator(".destination-settings > summary").click()
  }
  // 이전 채널의 수동 검색어를 다시 선택해도 유지한다.
  await page.getByRole("radio", { name: "엑스(X)", exact: true }).check()
  await click(page, "사진 확인하고 다음")
  await page.locator(".optional-hashtags summary").click()
  assert.equal(
    await page
      .getByLabel("사용할 검색어(#) 직접 수정", { exact: true })
      .inputValue(),
    "#직접작성7",
  )
  await click(page, "이 내용으로 결과 보기")
  await page.locator(".result-grid").waitFor()
  await click(page, "새 홍보물 만들기")
  await click(page, "이전 내용 되돌리기")
  await page.locator(".result-grid").waitFor()
  assert.match(await page.locator("#result-copy").innerText(), /#직접작성7/)
  // 디자인 토큰의 주요 텍스트 대비. 전체 WCAG 인증을 대신하지 않는다.
  report.contrast = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    const luminance = (hex) => {
      const s = hex.trim().replace("#", "")
      const v = [0, 2, 4]
        .map((n) => parseInt(s.slice(n, n + 2), 16) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
    }
    const cases = [
      ["본문", "--color-ink", "--color-canvas"],
      ["보조 글자", "--color-muted", "--color-surface"],
      ["민트 안내", "--color-brand", "--color-mint"],
      ["파랑 안내", "--color-ink", "--color-sky"],
      ["주요 버튼", "--color-surface", "--color-brand"],
      ["오류", "--color-error", "--color-error-soft"],
    ]
    return cases.map(([name, fg, bg]) => {
      const a = luminance(style.getPropertyValue(fg)),
        b = luminance(style.getPropertyValue(bg))
      return {
        name,
        ratio:
          Math.round(
            ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100,
          ) / 100,
      }
    })
  })
  for (const c of report.contrast) assert(c.ratio >= 4.5, JSON.stringify(c))
  const manifest = JSON.parse(
    await readFile(
      new URL(
        "../public/assets/illustrations/asset-manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  )
  for (const asset of manifest) {
    const data = (
      await readFile(
        new URL(
          "../public/assets/illustrations/" + asset.filename,
          import.meta.url,
        ),
      )
    ).toString("base64")
    const alpha = await page.evaluate(async (data) => {
      const img = new Image()
      img.src = "data:image/webp;base64," + data
      await img.decode()
      const c = document.createElement("canvas")
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext("2d")
      ctx.drawImage(img, 0, 0)
      return {
        width: img.width,
        height: img.height,
        corner: ctx.getImageData(0, 0, 1, 1).data[3],
      }
    }, data)
    assert.equal(alpha.corner, asset.transparent ? 0 : 255, "에셋별 배경 유지")
    assert.equal(alpha.width, asset.width)
    report.assets.push({ ...asset, alpha: alpha.corner })
  }
  await page.close()
  await writeFile(
    new URL("verification.json", output),
    JSON.stringify(report, null, 2),
  )
  console.log(
    "PASS: 12개 화면 설정, 9개 채널의 생성·복사·수동 검색어, 업종별 추천, 키보드 선택, 기존 작업 복원, 이미지 alpha, 주요 색상 대비.",
  )
} finally {
  await browser.close()
}
