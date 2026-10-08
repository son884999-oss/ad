import { chromium } from "playwright"
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { join, resolve, sep } from "node:path"
const review = resolve(fileURLToPath(new URL("../ui-review/", import.meta.url)))
await mkdir(review, { recursive: true })
const reports = []
for (const zoom of [100, 200]) {
  const profile = await mkdtemp(join(review, "native-zoom-profile-"))
  await mkdir(join(profile, "Default"))
  await writeFile(
    join(profile, "Default", "Preferences"),
    JSON.stringify({
      partition: {
        default_zoom_level: { x: Math.log(zoom / 100) / Math.log(1.2) },
      },
    }),
  )
  let context
  try {
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      channel: process.env.UI_BROWSER_CHANNEL || "msedge",
      viewport: null,
      args: ["--window-size=1440,1000"],
    })
    const page = await context.newPage()
    await page.goto("http://127.0.0.1:5173/")
    const metrics = await page.evaluate(() => ({
      dpr: devicePixelRatio,
      cssWidth: innerWidth,
      cssHeight: innerHeight,
      outerWidth,
      visualScale: visualViewport.scale,
    }))
    await page
      .getByRole("button", { name: "바로 시작하기", exact: true })
      .click()
    await page.getByRole("button", { name: "만들러 가기", exact: true }).click()
    await page
      .locator("input[type=file]")
      .setInputFiles(
        fileURLToPath(
          new URL("../../D_고혜숙/public/sample-product.png", import.meta.url),
        ),
      )
    await page
      .getByRole("button", { name: "사진 확인하고 다음", exact: true })
      .click()
    const optional = page.locator(".optional-hashtags")
    if ((await optional.getAttribute("open")) !== null)
      throw Error("optional keyword controls should initially be collapsed")
    await page
      .getByLabel("제품 설명", { exact: true })
      .fill("강릉에서 만든 커피")
    await page
      .getByLabel("강조할 특징", { exact: true })
      .fill("향기로운 원두 커피")
    await optional.locator("summary").click()
    const keywordField = page.getByLabel("사용할 검색어(#) 직접 수정", {
      exact: true,
    })
    if (!(await keywordField.inputValue()).includes("#커피"))
      throw Error("untouched default keywords must follow current product")
    await keywordField.fill("#우리동네 #내가고른검색어")
    await page
      .getByLabel("제품 설명", { exact: true })
      .fill("서울에서 만든 샴푸")
    if ((await keywordField.inputValue()) !== "#우리동네 #내가고른검색어")
      throw Error("manual keywords must survive description updates")
    await optional.locator("summary").click()
    await page
      .getByRole("button", { name: "이 내용으로 결과 보기", exact: true })
      .click()
    await page.locator("#result-copy").waitFor()
    if (!(await page.locator("#result-copy").innerText()).includes("#우리동네"))
      throw Error("keyword editing")
    await page
      .getByRole("button", { name: "미리보기 재생", exact: true })
      .click()
    await page.getByRole("button", { name: "일시 정지", exact: true }).click()
    await page
      .getByRole("button", { name: "홍보 글 전체 복사하기", exact: true })
      .click()
    await page.locator("#result-copy [role=status]").waitFor()
    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "포스터 저장", exact: true }).click()
    if (!(await download).suggestedFilename().endsWith(".png"))
      throw Error("poster export")
    const beforeReset = await page
      .locator("#result-poster img")
      .getAttribute("src")
    await page
      .getByRole("button", { name: "새 홍보물 만들기", exact: true })
      .click()
    await page
      .getByRole("button", { name: "이전 내용 되돌리기", exact: true })
      .click()
    await page.locator("#result-copy").waitFor()
    if (
      (await page.locator("#result-poster img").getAttribute("src")) !==
        beforeReset ||
      !(await page.locator("#result-copy").innerText()).includes("#우리동네")
    )
      throw Error("undo draft data")
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      cards: document.querySelectorAll(".result-card").length,
      controls: [...document.querySelectorAll(".result-card button")].map(
        (b) => ({
          label: b.textContent,
          height: b.getBoundingClientRect().height,
        }),
      ),
    }))
    if (
      layout.overflow ||
      layout.cards !== 3 ||
      layout.controls.some((b) => b.height < 48)
    )
      throw Error(JSON.stringify(layout))
    await page.screenshot({
      path: join(review, `native-zoom-results-${zoom}.png`),
      fullPage: true,
    })
    await page
      .getByRole("button", { name: "새 홍보물 만들기", exact: true })
      .click()
    await page.getByRole("button", { name: "메뉴 열기", exact: true }).click()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "내 홍보물 보기", exact: true })
      .click()
    await page
      .locator("main[data-app-scroll-container] .grid > button")
      .first()
      .click()
    await page
      .getByRole("button", { name: "내용 다시 수정하기", exact: true })
      .click()
    await page.getByRole("button", { name: "이전으로", exact: true }).click()
    if (
      await page
        .getByRole("button", { name: "이전 내용 되돌리기", exact: true })
        .count()
    )
      throw Error("opening a saved result must expire old undo")
    await page
      .getByRole("button", { name: "사진 확인하고 다음", exact: true })
      .click()
    await page
      .getByRole("button", { name: "이 내용으로 결과 보기", exact: true })
      .click()
    await page
      .getByRole("button", { name: "새 홍보물 만들기", exact: true })
      .click()
    await page.getByRole("button", { name: "메뉴 열기", exact: true }).click()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "로그아웃", exact: true })
      .click()
    await page
      .getByRole("button", { name: "바로 시작하기", exact: true })
      .click()
    await page.getByRole("button", { name: "만들러 가기", exact: true }).click()
    if (
      await page
        .getByRole("button", { name: "이전 내용 되돌리기", exact: true })
        .count()
    )
      throw Error("logout must expire undo")
    reports.push({
      zoom,
      ...metrics,
      ...layout,
      optionalControls: true,
      keywordEdit: true,
      playback: true,
      copy: true,
      posterDownload: true,
      undo: true,
      undoExpiration: true,
    })
  } finally {
    await context?.close()
    if (
      !resolve(profile).startsWith(review + sep) ||
      !profile.split(sep).at(-1).startsWith("native-zoom-profile-")
    )
      throw Error("unsafe test profile cleanup")
    await rm(profile, { recursive: true, force: true })
  }
}
if (
  Math.abs(reports[1].dpr / reports[0].dpr - 2) > 0.01 ||
  Math.abs(reports[0].cssWidth / reports[1].cssWidth - 2) > 0.02 ||
  reports.some((r) => r.visualScale !== 1)
)
  throw Error("native zoom level not proven")
await writeFile(
  join(review, "native-zoom-verification.json"),
  JSON.stringify(reports, null, 2),
)
console.log(
  "PASS: native Chromium 100%/200% zoom verified by DPR and CSS viewport; form, optional keywords, playback, copy, PNG download and new-draft undo remain usable.",
)
