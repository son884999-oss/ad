import { chromium } from "playwright"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import assert from "node:assert/strict"
const root = new URL("../", import.meta.url)
const out = new URL("ui-review/phase4b-final/", root)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: "msedge", headless: true })
const report = {
  screens: [],
  integration: [],
  assets: [],
  errors: [],
  clarity: [],
}
const seen = new Set()
try {
  const manifest = JSON.parse(
    await readFile(
      new URL("public/assets/illustrations/phase4b/asset-manifest.json", root),
      "utf8",
    ),
  )
  assert.equal(manifest.distinctCreativeCount, 20)
  assert.equal(
    new Set(manifest.assets.map((asset) => asset.creativeId)).size,
    20,
  )
  assert.equal(
    new Set(
      manifest.assets
        .filter((asset) => asset.category === "illustration")
        .map((asset) => asset.sourceSha256),
    ).size,
    12,
  )
  const page = await browser.newPage()
  page.on("pageerror", (error) => report.errors.push(error.message))
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 })
    await page.goto("http://127.0.0.1:5173/")
    const capture = async (name) => {
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((img) => {
            img.loading = "eager"
            return img.decode()
          }),
        )
      })
      await page.waitForTimeout(280)
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        missing: [...document.images]
          .filter((img) => !img.naturalWidth)
          .map((img) => img.src),
        art: [...document.querySelectorAll("img.service-art")].map((img) => ({
          file: img.getAttribute("src").split("/").pop().replace(".webp", ""),
          width: img.getBoundingClientRect().width,
          height: img.getBoundingClientRect().height,
        })),
        buttonHeights: [...document.querySelectorAll("main button")]
          .filter((button) => button.getBoundingClientRect().width > 0)
          .map((button) => button.getBoundingClientRect().height),
      }))
      assert.equal(metrics.overflow, false, `${width} ${name} 가로 넘침`)
      assert.deepEqual(metrics.missing, [])
      for (const art of metrics.art) {
        assert(art.width > 0 && art.height > 0)
        seen.add(art.file)
      }
      for (const height of metrics.buttonHeights)
        assert(height >= 44, `${name} 조작 영역 ${height}`)
      if ([320, 390, 1440].includes(width))
        await page.screenshot({
          path: fileURLToPath(new URL(`${name}-${width}.png`, out)),
          fullPage: true,
        })
      if (name === "home" && [320, 390, 1440].includes(width))
        await page.screenshot({
          path: fileURLToPath(new URL(`home-first-screen-${width}.png`, out)),
        })
      report.screens.push({ width, name, ...metrics })
    }
    await capture("home")
    const reading = await page
      .getByRole("button", { name: "화면 읽어주기", exact: true })
      .boundingBox()
    const header = await page.locator(".studio-header").boundingBox()
    assert(
      reading && reading.y + reading.height <= header.y,
      "읽어주기가 첫 줄에 항상 노출",
    )
    assert.equal(
      await page.locator(".studio-read-button svg").count(),
      1,
      "스피커 모양 기능 아이콘",
    )
    assert.equal(
      await page
        .locator(".studio-read-button")
        .evaluate((element) => element.closest("details") === null),
      true,
      "읽어주기를 설정 영역 밖에 배치",
    )
    const cta = await page
      .getByRole("button", { name: "홍보물 만들기", exact: true })
      .boundingBox()
    assert(cta.y + cta.height < 700, "첫 행동 가시성")
    const guide = await page.locator(".studio-how").boundingBox()
    const example = await page.locator(".studio-example").boundingBox()
    assert(
      guide.y > cta.y + cta.height && guide.y < example.y,
      "시작 버튼 다음 3단계, 예시 이미지는 그 다음",
    )
    await page
      .getByRole("button", { name: "홍보물 만들기", exact: true })
      .click()
    await capture("photo")
    const uploadAction = await page
      .locator(".upload-target strong")
      .evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const hit = document.elementFromPoint(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        )
        return {
          top: bounds.top,
          height: bounds.height,
          visible: hit === element || element.contains(hit),
          background: getComputedStyle(element).backgroundColor,
        }
      })
    if (width < 640) assert(uploadAction.visible, "사진 선택 행동 가시성")
    await page.locator(".destination-settings > summary").click()
    await capture("channel")
    await page.locator(".destination-settings > summary").click()
    await page
      .locator("input[type=file]")
      .setInputFiles(
        fileURLToPath(
          new URL(
            "design-assets/illustrations/phase4b/service-poster.png",
            root,
          ),
        ),
      )
    await page
      .getByRole("button", { name: "사진 확인하고 다음", exact: true })
      .click()
    await capture("details")
    const descriptionInput = await page
      .getByRole("textbox", { name: "제품 설명", exact: true })
      .boundingBox()
    assert(
      descriptionInput.y < 700,
      "설명 입력을 첫 화면에서 바로 찾을 수 있음",
    )
    report.clarity.push({
      width,
      reading,
      guide,
      example,
      uploadAction,
      descriptionInput,
    })
    await page
      .getByRole("button", { name: "이 내용으로 결과 보기", exact: true })
      .click()
    await capture("results")
    assert.equal(await page.locator(".result-card").count(), 3)
    const file = page.waitForEvent("download")
    await page.getByRole("button", { name: "포스터 저장", exact: true }).click()
    assert.match((await file).suggestedFilename(), /\.png$/)
    // 빈 상태는 새 페이지의 실제 초기 상태에서 확인한다.
    await page.goto("http://127.0.0.1:5173/")
    const nav = width >= 1024 ? ".studio-desktop-nav" : ".studio-bottom-nav"
    await page
      .locator(nav)
      .getByRole("button", { name: "내 홍보물", exact: true })
      .click()
    await capture("records-empty")
  }
  for (const asset of manifest.assets.filter(
    (asset) => asset.category === "illustration",
  )) {
    assert(
      seen.has(asset.creativeId),
      `${asset.creativeId}: 실제 화면 통합 누락`,
    )
    const primary = asset.files[0]
    assert(
      primary.bytes < (asset.creativeId === "service-hero" ? 200000 : 100000),
      "웹 에셋 용량",
    )
    if (asset.creativeId !== "service-hero")
      assert(primary.alphaShare > 0.1, "실제 투명 배경")
    report.integration.push({ id: asset.creativeId, actualRendered: true })
    report.assets.push({ id: asset.creativeId, ...primary })
  }
  assert.deepEqual(report.errors, [])
  await writeFile(
    new URL("verification.json", out),
    JSON.stringify(report, null, 2),
  )
  console.log(
    "PASS: 20개 창작 단위, 12개 삽화의 실제 통합, 7개 너비 × 6개 화면, 3개 결과·PNG 저장·터치 영역·투명 배경",
  )
} finally {
  await browser.close()
}
