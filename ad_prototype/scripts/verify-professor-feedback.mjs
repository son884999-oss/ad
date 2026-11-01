import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { chromium } from "playwright"

const output =
  process.env.FEEDBACK_REVIEW_OUTPUT ||
  fileURLToPath(new URL("../work/reference-review/", import.meta.url))
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  channel: process.env.UI_BROWSER_CHANNEL || "msedge",
})
const photo = fileURLToPath(
  new URL("../public/assets/samples/product-example.png", import.meta.url),
)
const reports = []
const labels = ["전체", "이미지", "영상", "문구"]

async function capture(page, name, width) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      [...document.images]
        .filter((img) => {
          const r = img.getBoundingClientRect()
          return r.height > 0 && r.top < innerHeight && r.bottom > 0
        })
        .map((img) => img.decode().catch(() => {})),
    )
  })
  await page.screenshot({ path: join(output, name + "-" + width + ".png") })
  const data = await page.evaluate(() => {
    const nav = [...document.querySelectorAll(".studio-bottom-nav")].find(
      (el) => !el.inert,
    )
    const r = nav.getBoundingClientRect()
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      navDisplay: getComputedStyle(nav).display,
      navPosition: getComputedStyle(nav).position,
      navBottom: r.bottom,
      height: innerHeight,
      buttons: nav.querySelectorAll("button").length,
    }
  })
  assert.equal(data.overflow, false, JSON.stringify(data))
  assert.equal(data.buttons, 4)
  if (width < 1024) {
    assert.equal(data.navPosition, "fixed")
    assert.ok(Math.abs(data.navBottom - data.height) <= 1)
    assert.notEqual(data.navDisplay, "none")
  } else assert.equal(data.navDisplay, "none")
  return data
}
async function choose(page, kind) {
  const open = page.getByRole("dialog")
  if (await open.count()) {
    await open
      .locator(".studio-bottom-nav")
      .getByRole("button", { name: "만들기", exact: true })
      .click()
  } else if (await page.locator(".studio-bottom-nav").isVisible()) {
    await page
      .locator(".studio-bottom-nav")
      .getByRole("button", { name: "만들기", exact: true })
      .click()
  } else {
    await page
      .locator(".studio-desktop-nav")
      .getByRole("button", { name: "만들기", exact: true })
      .click()
  }
  await page
    .getByRole("dialog", { name: "홍보물 만들기" })
    .getByRole("button", { name: kind, exact: true })
    .click()
}
async function goResults(page) {
  await page
    .getByRole("button", { name: "사진 확인하고 다음", exact: true })
    .click()
  await page
    .getByRole("button", { name: "이 내용으로 결과 보기", exact: true })
    .click()
  await page.getByRole("tablist").waitFor()
}
try {
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
      permissions: ["clipboard-read", "clipboard-write"],
    })
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(process.env.UI_BASE_URL || "http://127.0.0.1:5173/")
    await capture(page, "home", width)
    await page.getByRole("button", { name: "메뉴 열기", exact: true }).click()
    const menu = page.getByRole("dialog", { name: "설정 및 이용 안내" })
    await menu.waitFor()
    // The one-viewport compact form is the regular mode; large text may scroll.
    const easySwitch = menu.getByRole("switch", { name: "간편모드", exact: true })
    if (await easySwitch.getAttribute("aria-checked") === "true") await easySwitch.click()
    assert.equal(await menu.locator(".studio-menu-row").count(), 0)
    assert.equal(await menu.locator(".menu-creation-shortcuts button").count(), 4)
    assert.ok(await menu.getByText("사용 방법", { exact: true }).isVisible())
    await capture(page, "menu", width)
    await page.keyboard.press("Escape")
    await page
      .getByRole("button", { name: "홍보물 만들기", exact: true })
      .click()
    const chooser = page.getByRole("dialog", { name: "홍보물 만들기" })
    await chooser.getByRole("button", { name: "설정·이용 안내", exact: true }).click()
    await menu.waitFor()
    assert.ok(await menu.evaluate(el => el === document.activeElement))
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "홍보물 만들기", exact: true }).click()
    await chooser.getByRole("button", { name: "메뉴 닫기", exact: true }).focus()
    await page.keyboard.press("Shift+Tab")
    assert.ok(await page.evaluate(() => document.querySelector(".creation-picker-panel").contains(document.activeElement)))
    await page.keyboard.press("Tab")
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "메뉴 닫기")
    assert.equal(await chooser.locator(".studio-menu-row").count(), 4)
    assert.equal(
      await chooser.getByText("구독 관리", { exact: true }).count(),
      0,
    )
    await capture(page, "create-options", width)
    await chooser
      .getByRole("button", { name: "한 번에 완성", exact: true })
      .click()
    assert.equal(
      await page.locator(".photo-format-settings").getAttribute("open"),
      null,
    )
    await capture(page, "photo", width)
    await page
      .getByLabel("제품 사진 올리기", { exact: true })
      .setInputFiles(photo)
    await page
      .getByRole("button", { name: "사진 확인하고 다음", exact: true })
      .click()
    await page
      .getByRole("textbox", { name: "가게·제품 이름", exact: true })
      .fill("행복한 카페")
    await page
      .getByRole("textbox", { name: "제품 설명", exact: true })
      .fill("매일 아침 직접 구운 빵을 판매합니다.")
    await page
      .getByRole("textbox", { name: "강조할 특징", exact: true })
      .fill("따뜻한 빵과 커피를 편안하게 즐겨요.")
    const requirements = page.locator('.compact-information .field-requirement')
    assert.deepEqual(await requirements.allTextContents(), ['선택', '필수', '필수'])
    for (const hint of await requirements.all()) assert.ok(await hint.isVisible())
    await page.getByLabel('가게·제품 이름', { exact: true }).fill('')
    assert.ok(await page.getByRole('button', { name: '이 내용으로 결과 보기', exact: true }).isEnabled())
    await page.getByLabel('가게·제품 이름', { exact: true }).fill('행복한 카페')
    await page.evaluate(() => scrollTo(0, 0))
    await capture(page, "information", width)
    if (width >= 1024) {
      const action = await page.getByRole("button", { name: "이 내용으로 결과 보기", exact: true }).boundingBox()
      assert.ok(action.y + action.height <= 900, "Desktop information action must fit initial viewport: " + JSON.stringify(action))
    }
    if (width < 1024) {
      await page.setViewportSize({ width, height: 844 })
      await page.evaluate(() => scrollTo(0, 0))
      const core = await page.evaluate(() => {
        const fields = [...document.querySelectorAll('.compact-information .details-fields > label input, .compact-information .details-fields > label textarea')]
        const action = document.querySelector('.compact-information .details-primary-bar button').getBoundingClientRect()
        const nav = document.querySelector('.studio-bottom-nav').getBoundingClientRect()
        return { fields: fields.map(el => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom })), actionBottom: action.bottom, navTop: nav.top, parts: [".information-photo", ".description-example-note", ".information-more-settings", ".compact-information > .mt-7"].map(selector => { const el = document.querySelector(selector); const style = getComputedStyle(el); return {selector, height:el.getBoundingClientRect().height, margin:style.margin, padding:style.padding, gap:style.gap} }) }
      })
      assert.equal(core.fields.length, 3)
      assert.ok(core.fields.every(field => field.top >= 65 && field.bottom <= core.navTop), JSON.stringify(core))
      assert.ok(core.actionBottom <= core.navTop, "Core form/action must fit 844px: " + JSON.stringify(core))
      await capture(page, "information-844", width)
      await page.setViewportSize({ width, height: 900 })
    }
    if (width === 390) {
      for (const label of ["이미지 만들기", "문구 만들기", "영상 만들기", "한 번에 만들기"]) {
        await page.getByRole("button", { name: "전체 메뉴 열기", exact: true }).click()
        await menu.getByRole("button", { name: label, exact: true }).click()
        await page.getByRole("button", { name: "사진 확인하고 다음", exact: true }).click()
        assert.equal(await page.getByRole("textbox", { name: "가게·제품 이름", exact: true }).inputValue(), "행복한 카페")
        assert.equal(await page.getByRole("textbox", { name: "제품 설명", exact: true }).inputValue(), "매일 아침 직접 구운 빵을 판매합니다.")
        assert.equal(await page.getByRole("textbox", { name: "강조할 특징", exact: true }).inputValue(), "따뜻한 빵과 커피를 편안하게 즐겨요.")
        assert.ok(await page.locator(".information-photo > img").isVisible())
      }
      const previousPhoto = await page
        .locator(".information-photo > img")
        .getAttribute("src")
      await page
        .getByLabel("정보 입력에서 사진 바꾸기", { exact: true })
        .setInputFiles({
          name: "bad.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("invalid"),
        })
      await page.getByText(/기존 사진은 그대로예요/).waitFor()
      assert.equal(
        await page.locator(".information-photo > img").getAttribute("src"),
        previousPhoto,
      )
      await page
        .getByLabel("정보 입력에서 사진 바꾸기", { exact: true })
        .setInputFiles({
          name: "new.svg",
          mimeType: "image/svg+xml",
          buffer: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200"><rect width="160" height="200" fill="#E88942"/></svg>',
          ),
        })
      await page.waitForFunction(
        (previous) =>
          document.querySelector(".information-photo > img").src !== previous,
        previousPhoto,
      )
      assert.equal(
        await page
          .getByRole("textbox", { name: "가게·제품 이름", exact: true })
          .inputValue(),
        "행복한 카페",
      )
      await page
        .getByLabel("정보 입력에서 사진 바꾸기", { exact: true })
        .setInputFiles(photo)
      await page.waitForFunction(
        (previous) =>
          document.querySelector(".information-photo > img").src === previous,
        previousPhoto,
      )
    }
    await page
      .getByRole("button", { name: "이 내용으로 결과 보기", exact: true })
      .click()
    await page.locator('#result-poster img[src^="blob:"]').waitFor()
    await page.evaluate(() => scrollTo(0, 0))
    const primary = await page
      .getByRole("button", { name: "이미지 저장하기", exact: true })
      .boundingBox()
    assert.ok(
      primary.y + primary.height <= (width < 1024 ? 820 : 900),
      "Image save must be visible at " + width,
    )
    assert.equal(await page.getByRole("tab").count(), 3)
    for (const tab of ["이미지", "영상", "문구"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click()
      assert.equal(await page.getByRole("tabpanel").count(), 1)
      const action = page.getByRole("button", {
        name:
          tab === "이미지"
            ? "이미지 저장하기"
            : tab === "영상"
              ? "영상 저장하기"
              : "문구 전체 복사하기",
        exact: true,
      })
      const box = await action.boundingBox()
      assert.ok(
        box.y + box.height <= (width < 1024 ? 820 : 900),
        "Primary result action must be visible: " + tab + " " + width,
      )
      await capture(
        page,
        "result-" + { 이미지: "image", 영상: "video", 문구: "copy" }[tab],
        width,
      )
    }
    await page.getByRole("tab", { name: "이미지", exact: true }).focus()
    await page.keyboard.press("ArrowRight")
    assert.equal(
      await page
        .getByRole("tab", { name: "영상", exact: true })
        .getAttribute("aria-selected"),
      "true",
    )
    await page.keyboard.press("End")
    assert.equal(
      await page
        .getByRole("tab", { name: "문구", exact: true })
        .getAttribute("aria-selected"),
      "true",
    )
    await page
      .locator(".result-tabs-bar")
      .evaluate((el) => el.scrollIntoView({ block: "start" }))
    const pinned = await page.evaluate(() => {
      const reading = document
        .querySelector(".studio-reading-bar")
        .getBoundingClientRect()
      const tabs = document
        .querySelector(".result-tabs-bar")
        .getBoundingClientRect()
      return {
        readingTop: reading.top,
        readingBottom: reading.bottom,
        tabsTop: tabs.top,
        tabsBottom: tabs.bottom,
      }
    })
    assert.ok(
      Math.abs(pinned.readingTop) <= 1 &&
        Math.abs(pinned.tabsTop - pinned.readingBottom) <= 1,
      JSON.stringify(pinned),
    )
    assert.ok(pinned.tabsBottom <= 145)
    if (width === 390) {
      const text = await page
        .getByRole("textbox", { name: "홍보 문구 원문", exact: true })
        .inputValue()
      assert.match(text, /행복한 카페/)
      assert.match(text, /매일 아침/)
      await page.evaluate(() => {
        window.__spokenText = ""
        speechSynthesis.speak = (utterance) => {
          window.__spokenText = utterance.text
          utterance.onstart?.(new Event("start"))
        }
        speechSynthesis.cancel = () => {}
      })
      await page
        .getByRole("button", { name: "화면 읽어주기", exact: true })
        .click()
      await page.waitForFunction(() => window.__spokenText.length > 0)
      assert.equal(
        await page.evaluate(() => window.__spokenText),
        "홍보 문구 결과입니다. " + text,
      )
      await page
        .getByRole("button", { name: "읽어주기 멈추기", exact: true })
        .click()
      await page
        .getByRole("button", { name: "문구 전체 복사하기", exact: true })
        .click()
      assert.equal(
        (await page.evaluate(() => navigator.clipboard.readText())).replace(
          /\r\n/g,
          "\n",
        ),
        text,
      )
      await page.getByRole("tab", { name: "이미지", exact: true }).click()
      const hash = await page
        .locator("#result-poster img")
        .evaluate(async (img) =>
          [
            ...new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                await (await fetch(img.src)).arrayBuffer(),
              ),
            ),
          ]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join(""),
        )
      const downloaded = page.waitForEvent("download")
      await page
        .getByRole("button", { name: "이미지 저장하기", exact: true })
        .click()
      const png = await downloaded
      await png.saveAs(join(output, "poster.png"))
      assert.equal(
        createHash("sha256")
          .update(await readFile(join(output, "poster.png")))
          .digest("hex"),
        hash,
      )
      await page.getByRole("tab", { name: "영상", exact: true }).click()
      await page
        .getByRole("button", { name: "영상 저장하기", exact: true })
        .click()
      await page
        .getByRole("button", { name: "영상 준비 취소", exact: true })
        .click()
      await page
        .getByRole("button", { name: "영상 저장하기", exact: true })
        .waitFor()
      const videoPromise = page.waitForEvent("download")
      await page
        .getByRole("button", { name: "영상 저장하기", exact: true })
        .click()
      await page.getByRole("tab", { name: "문구", exact: true }).click()
      const video = await videoPromise
      assert.match(video.suggestedFilename(), /\.(mp4|webm)$/)
      await video.saveAs(
        join(output, "video." + video.suggestedFilename().split(".").at(-1)),
      )
    }
    await page.evaluate(() => scrollTo(0, 0))
    if (width < 1024)
      await page
        .locator(".studio-bottom-nav")
        .getByRole("button", { name: "내 홍보물", exact: true })
        .click()
    else
      await page
        .locator(".studio-desktop-nav")
        .getByRole("button", { name: "내 홍보물", exact: true })
        .click()
    assert.equal(await page.locator(".record-item").count(), 3)
    for (const label of labels) {
      await page
        .getByRole("group", { name: "홍보물 종류 필터" })
        .getByRole("button", { name: label, exact: true })
        .click()
      assert.equal(
        await page.locator(".record-item").count(),
        label === "전체" ? 3 : 1,
      )
    }
    await capture(page, "records", width)
    await page.locator(".record-item").first().click()
    assert.equal(
      await page
        .getByRole("tab", { name: "문구", exact: true })
        .getAttribute("aria-selected"),
      "true",
    )
    assert.match(
      await page
        .getByRole("textbox", { name: "홍보 문구 원문", exact: true })
        .inputValue(),
      /행복한 카페/,
    )
    if (width === 390) {
      await page
        .getByRole("button", { name: "내용 다시 수정하기", exact: true })
        .click()
      assert.equal(
        await page
          .getByRole("textbox", { name: "가게·제품 이름", exact: true })
          .inputValue(),
        "행복한 카페",
      )
      await page
        .getByRole("button", { name: "이 내용으로 결과 보기", exact: true })
        .click()
      await page
        .getByRole("button", { name: "새 홍보물 만들기", exact: true })
        .click()
      await page
        .getByRole("button", { name: "이전 내용 되돌리기", exact: true })
        .click()
      assert.match(
        await page
          .getByRole("textbox", { name: "홍보 문구 원문", exact: true })
          .inputValue(),
        /행복한 카페/,
      )
      await choose(page, "홍보 글 만들기")
      await goResults(page)
      assert.equal(await page.getByRole("tab").count(), 1)
      await choose(page, "한 번에 완성")
      await page.locator(".photo-format-settings > summary").click()
      await page.getByRole("radio", { name: "포스터", exact: true }).check()
      await goResults(page)
      assert.deepEqual(await page.getByRole("tab").allTextContents(), [
        "이미지",
        "문구",
      ])
      await page.setViewportSize({ width: 390, height: 450 })
      await capture(page, "short-viewport", width)
    }
    assert.deepEqual(errors, [])
    reports.push({
      width,
      separatedMenus: true,
      retainedInputs: true,
      resultTabs: true,
      filteredRecords: true,
      pinnedControls: pinned,
      errors,
    })
    console.log("PASS " + width + "px")
    await context.close()
  }
  await writeFile(
    join(output, "verification.json"),
    JSON.stringify(reports, null, 2),
  )
} finally {
  await browser.close()
}
