import assert from "node:assert/strict"
import { chromium } from "playwright"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

// Faults are injected only into isolated test pages, never into the app's normal path.
const base = process.env.UI_BASE_URL || "http://127.0.0.1:5173/"
const output =
  process.env.MOBILE_REVIEW_OUTPUT ||
  fileURLToPath(new URL("../ui-review/mobile-flow/", import.meta.url))
const photo = fileURLToPath(
  new URL("../public/assets/samples/product-example.png", import.meta.url),
)
await mkdir(output, { recursive: true })
for (let i = 0; i < 50; i++) {
  try {
    await fetch(base)
    break
  } catch {
    if (i === 49) throw new Error("Preview unavailable")
    await new Promise((r) => setTimeout(r, 100))
  }
}
const browser = await chromium.launch({
  headless: true,
  ...(process.env.UI_BROWSER_EXECUTABLE
    ? {
        executablePath: process.env.UI_BROWSER_EXECUTABLE,
        args: ["--no-sandbox", "--no-zygote", "--disable-dev-shm-usage"],
      }
    : {}),
})
const reports = []
const errors = []
const profiles = [
  [360, 640],
  [390, 844],
  [430, 844],
  [768, 1024],
  [1440, 900],
].filter(
  ([width, height]) =>
    !process.env.UI_LAYOUT_FILTER ||
    `${width}x${height}` === process.env.UI_LAYOUT_FILTER,
)
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  )
const nav = (page) =>
  page.getByRole("navigation", { name: "모바일 빠른 메뉴", exact: true })
async function createPage(width = 390, height = 844, mode = "easy") {
  const page = await browser.newPage({
    viewport: { width, height },
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(base)
  const root = process.env.UI_TEST_FONT_ROOT
  if (root) {
    await page.route("**/test-fonts/*", (r) =>
      r.fulfill({
        path: join(root, "files", r.request().url().split("/").pop()),
        contentType: "font/woff2",
      }),
    )
    await page.addStyleTag({
      content: (await readFile(join(root, "index.css"), "utf8"))
        .replaceAll("Noto Sans KR Variable", "Noto Sans KR")
        .replaceAll("./files/", "/test-fonts/"),
    })
    await page.evaluate(() => document.fonts.ready)
  }
  if (mode === "regular") {
    await page
      .getByRole("button", { name: "상단 전체 메뉴 열기", exact: true })
      .click()
    await page
      .getByRole("dialog")
      .getByText("글씨 크기·간편모드", { exact: true })
      .click()
    await page
      .getByRole("dialog")
      .getByRole("switch", { name: "간편모드", exact: true })
      .click()
    await page.keyboard.press("Escape")
  }
  return page
}
async function shot(page, name, fullPage = false) {
  await page.evaluate(() => {
    document.activeElement?.blur()
    scrollTo(0, 0)
  })
  await settle(page)
  await page.screenshot({ path: join(output, name + ".png"), fullPage })
}
async function photoStep(page, choice = "둘 다") {
  await page.getByRole("button", { name: "홍보물 만들기", exact: true }).click()
  await page
    .getByRole("radio", { name: choice, exact: true })
    .locator("..")
    .click()
  await page
    .getByLabel("제품 사진 올리기", { exact: true })
    .setInputFiles(photo)
  await page.getByRole("button", { name: "다음으로", exact: true }).click()
}
async function fit(page) {
  await page.evaluate(() => scrollTo(0, 0))
  await settle(page)
  const lower = (await nav(page).boundingBox()).y
  const boxes = []
  for (const selector of [
    ".journey-progress",
    ".photo-upload",
    ".photo-output-format",
    ".photo-next-action > button",
  ]) {
    const box = await page.locator(selector).boundingBox()
    assert.ok(
      box.y >= 0 && box.y + box.height <= lower - 8,
      selector + " does not fit " + JSON.stringify({ box, lower }),
    )
    if (boxes.length) assert.ok(box.y >= boxes.at(-1).y + boxes.at(-1).height)
    boxes.push(box)
  }
  return boxes
}
try {
  for (const [width, height] of profiles)
    for (const mode of ["easy", "regular"]) {
      const page = await createPage(width, height, mode)
      await nav(page)
        .getByRole("button", { name: "내 홍보물", exact: true })
        .click()
      assert.equal(
        await page
          .getByText("아직 만든 결과가 없어요", { exact: true })
          .isVisible(),
        true,
      )
      await page
        .getByRole("button", { name: "홍보물 만들기", exact: true })
        .click()
      assert.equal(await page.getByRole("radio").count(), 3)
      assert.equal(
        await page
          .getByRole("radio", { name: "둘 다", exact: true })
          .isChecked(),
        true,
      )
      assert.equal(
        await page
          .getByRole("button", { name: "다음으로", exact: true })
          .isDisabled(),
        true,
      )
      const emptyFit = width <= 390 ? await fit(page) : null
      if (mode === "easy") await shot(page, `photo-empty-${width}x${height}`)
      await page
        .getByRole("radio", { name: "영상", exact: true })
        .locator("..")
        .click()
      await page
        .getByRole("button", { name: "상단 전체 메뉴 열기", exact: true })
        .click()
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "한 번에 만들기", exact: true })
        .click()
      assert.equal(
        await page
          .getByRole("radio", { name: "영상", exact: true })
          .isChecked(),
        true,
        "Output selection before upload must survive menu re-entry",
      )
      await nav(page).getByRole("button", { name: "홈", exact: true }).click()
      await page
        .getByRole("button", { name: "홍보물 이어 만들기", exact: true })
        .click()
      assert.equal(
        await page
          .getByRole("radio", { name: "영상", exact: true })
          .isChecked(),
        true,
        "Output selection before upload must survive home navigation",
      )
      await page
        .getByRole("radio", { name: "영상", exact: true })
        .locator("..")
        .click()
      await page.getByRole("radio", { name: "영상", exact: true }).focus()
      await page.keyboard.press("ArrowLeft")
      assert.equal(
        await page
          .getByRole("radio", { name: "포스터", exact: true })
          .isChecked(),
        true,
      )
      await page
        .getByRole("radio", { name: "둘 다", exact: true })
        .locator("..")
        .click()
      const picker = page.waitForEvent("filechooser")
      await page
        .getByRole("button", { name: "사진 선택창 열기", exact: true })
        .click()
      await (await picker).setFiles(photo)
      const selectedFit = width <= 390 ? await fit(page) : null
      if (mode === "easy") await shot(page, `photo-selected-${width}x${height}`)
      await page.getByRole("button", { name: "다음으로", exact: true }).click()
      assert.equal(
        await page
          .getByRole("button", { name: "결과 보기", exact: true })
          .isDisabled(),
        true,
      )
      const name = page.getByLabel("상품 이름", { exact: true })
      await name.fill("   ")
      await page.getByLabel("가게 이름", { exact: true }).focus()
      assert.equal(await name.getAttribute("aria-invalid"), "true")
      assert.equal(
        await page
          .getByText("상품 이름을 입력해 주세요.", { exact: true })
          .isVisible(),
        true,
      )
      await name.fill("카페라떼")
      assert.equal(
        await page
          .getByRole("button", { name: "결과 보기", exact: true })
          .isEnabled(),
        true,
      )
      await page
        .getByLabel("소개 및 알리고 싶은 점", { exact: true })
        .fill("잠시 보관할 설명")
      await nav(page)
        .getByRole("button", { name: "내 홍보물", exact: true })
        .click()
      await page
        .getByRole("button", { name: "홍보물 만들기", exact: true })
        .click()
      assert.equal(
        await name.inputValue(),
        "카페라떼",
        "Empty saved-output creation entry must preserve the unfinished draft",
      )
      assert.equal(
        await page
          .getByLabel("소개 및 알리고 싶은 점", { exact: true })
          .inputValue(),
        "잠시 보관할 설명",
      )
      assert.equal(
        await page
          .getByRole("img", { name: "선택한 제품 사진", exact: true })
          .count(),
        1,
      )
      await page.getByLabel("소개 및 알리고 싶은 점", { exact: true }).fill("")
      for (const label of ["소개 및 알리고 싶은 점"])
        assert.ok(
          !/선택|필수/u.test(
            await page
              .getByLabel(label, { exact: true })
              .locator("..")
              .innerText(),
          ),
        )
      if (mode === "easy" && width === 390)
        await shot(page, "information-product-only", true)
      await page.getByRole("button", { name: "결과 보기", exact: true }).click()
      await page.locator("#result-poster-preview img").waitFor()
      assert.deepEqual(
        (await page.getByRole("tab").allTextContents()).map((s) => s.trim()),
        ["이미지", "영상", "문구"],
      )
      const frames = []
      for (const [label, kind] of [
        ["이미지", "poster"],
        ["영상", "video"],
      ]) {
        await page.getByRole("tab", { name: label, exact: true }).click()
        const frame = await page
          .locator(`#result-${kind} .result-preview`)
          .boundingBox()
        frames.push({ width: frame.width, height: frame.height, x: frame.x })
        if (mode === "easy" && [390, 1440].includes(width))
          await shot(page, `result-${kind}-${width}`)
      }
      assert.deepEqual(
        frames[0],
        frames[1],
        "Poster and video display dimensions differ",
      )
      await page.getByRole("button", { name: "재생하기", exact: true }).click()
      assert.equal(
        await page
          .getByRole("button", { name: "일시 정지", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      )
      await page.getByRole("tab", { name: "문구", exact: true }).click()
      await page
        .getByRole("button", { name: "문구 전체 복사하기", exact: true })
        .click()
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        await page.locator(".copy-result-text").innerText(),
      )
      if (mode === "easy" && width === 390) await shot(page, "result-copy-390")
      for (const text of [
        "사진 움직임 미리보기예요. 저장 파일에는 홍보 문구도 들어가요.",
        "문구와 검색어를 함께 복사해요.",
        "원문 보기",
        "게시 방법",
        "문구 확인",
      ])
        assert.equal(await page.getByText(text, { exact: true }).count(), 0)
      await nav(page)
        .getByRole("button", { name: "내 홍보물", exact: true })
        .click()
      assert.equal(await page.locator(".record-item").count(), 3)
      if (width === 390 && mode === "easy") await shot(page, "records-390")
      await page.locator(".record-item").filter({ hasText: "영상" }).click()
      assert.equal(
        await page
          .getByRole("tab", { name: "영상", selected: true, exact: true })
          .count(),
        1,
      )
      await page
        .getByRole("button", { name: "내용 다시 수정하기", exact: true })
        .click()
      await page.getByLabel("가게 이름", { exact: true }).fill("행복한 카페")
      await nav(page).getByRole("button", { name: "홈", exact: true }).click()
      await page
        .getByRole("button", { name: "홍보물 이어 만들기", exact: true })
        .click()
      assert.equal(
        await page.getByLabel("가게 이름", { exact: true }).inputValue(),
        "행복한 카페",
      )
      await page.getByRole("button", { name: "이전으로", exact: true }).click()
      await page
        .getByRole("radio", { name: "영상", exact: true })
        .locator("..")
        .click()
      await page.getByRole("button", { name: "다음으로", exact: true }).click()
      await page
        .getByRole("button", { name: "상단 전체 메뉴 열기", exact: true })
        .click()
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "한 번에 만들기", exact: true })
        .click()
      assert.equal(
        await name.inputValue(),
        "카페라떼",
        "Menu re-entry must preserve the current step",
      )
      await page.getByRole("button", { name: "이전으로", exact: true }).click()
      assert.equal(
        await page
          .getByRole("radio", { name: "영상", exact: true })
          .isChecked(),
        true,
        "Menu re-entry reset output selection",
      )
      if (width <= 390) await fit(page)
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      )
      reports.push({
        width,
        height,
        mode,
        emptyFit,
        selectedFit,
        mediaFrames: frames,
        status: "passed",
      })
      console.log(`PASS mobile journey ${width}×${height} ${mode}`)
      await page.close()
    }
  for (const choice of ["포스터", "영상"]) {
    const page = await createPage()
    await photoStep(page, choice)
    await page
      .getByLabel("상품 이름", { exact: true })
      .fill("초이셀 데일리 샴푸")
    await page.evaluate(() => {
      window.exportCalls = { poster: 0, video: 0 }
      const toBlob = HTMLCanvasElement.prototype.toBlob
      HTMLCanvasElement.prototype.toBlob = function (...args) {
        window.exportCalls.poster++
        return toBlob.apply(this, args)
      }
      const start = MediaRecorder.prototype.start
      MediaRecorder.prototype.start = function (...args) {
        window.exportCalls.video++
        return start.apply(this, args)
      }
    })
    await page.getByRole("button", { name: "결과 보기", exact: true }).click()
    const expected = choice === "포스터" ? ["이미지", "문구"] : ["영상", "문구"]
    assert.deepEqual(
      (await page.getByRole("tab").allTextContents()).map((s) => s.trim()),
      expected,
    )
    if (choice === "포스터")
      await page.locator("#result-poster-preview img").waitFor()
    await settle(page)
    assert.deepEqual(
      await page.evaluate(() => window.exportCalls),
      { poster: choice === "포스터" ? 1 : 0, video: 0 },
      "Selection must control actual file preparation, not only result visibility",
    )
    const download = page.waitForEvent("download")
    await page
      .getByRole("button", {
        name: choice === "포스터" ? "이미지 저장하기" : "영상 저장하기",
        exact: true,
      })
      .click()
    const file = await download
    assert.equal(await file.failure(), null)
    assert.ok((await stat(await file.path())).size > 1000)
    assert.deepEqual(
      await page.evaluate(() => window.exportCalls),
      { poster: choice === "포스터" ? 1 : 0, video: choice === "영상" ? 1 : 0 },
      "An unselected format was generated",
    )
    await page
      .getByRole("button", { name: "새 홍보물 만들기", exact: true })
      .click()
    assert.equal(
      await page.getByRole("radio", { name: "둘 다", exact: true }).isChecked(),
      true,
    )
    assert.equal(
      await page
        .getByRole("img", { name: "넣은 제품 사진 미리보기", exact: true })
        .count(),
      0,
    )
    reports.push({
      scenario: choice + " only + real local download",
      filename: file.suggestedFilename(),
      status: "passed",
    })
    await page.close()
  }
  const failure = await createPage()
  await photoStep(failure)
  await failure.getByLabel("상품 이름", { exact: true }).fill("오류 복구 상품")
  await failure.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob
    let once = true
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      if (once) {
        once = false
        callback(null)
      } else original.call(this, callback, ...args)
    }
  })
  await failure.getByRole("button", { name: "결과 보기", exact: true }).click()
  await failure
    .getByText("이미지를 준비하지 못했어요. 다시 시도해 주세요.", {
      exact: true,
    })
    .waitFor()
  assert.equal(
    await failure
      .getByRole("button", { name: "이미지 저장하기", exact: true })
      .isDisabled(),
    true,
  )
  await shot(failure, "poster-partial-failure")
  await failure.getByRole("tab", { name: "문구", exact: true }).click()
  await failure
    .getByRole("button", { name: "문구 전체 복사하기", exact: true })
    .click()
  await failure.getByRole("tab", { name: "이미지", exact: true }).click()
  await failure
    .getByRole("button", { name: "이미지 다시 준비", exact: true })
    .click()
  await failure.locator("#result-poster-preview img").waitFor()
  await shot(failure, "poster-retry-success")
  await failure
    .getByRole("button", { name: "내용 다시 수정하기", exact: true })
    .click()
  assert.equal(
    await failure.getByLabel("상품 이름", { exact: true }).inputValue(),
    "오류 복구 상품",
  )
  await failure.setViewportSize({ width: 390, height: 400 })
  await failure.getByLabel("소개 및 알리고 싶은 점", { exact: true }).focus()
  await settle(failure)
  const field = await failure
    .getByLabel("소개 및 알리고 싶은 점", { exact: true })
    .boundingBox()
  assert.ok(
    field.y >= 0 &&
      field.y + field.height < (await nav(failure).boundingBox()).y,
  )
  await failure.screenshot({
    path: join(output, "keyboard-height-simulation.png"),
  })
  await failure.setViewportSize({ width: 390, height: 844 })
  await failure
    .getByRole("button", { name: "상단 전체 메뉴 열기", exact: true })
    .click()
  await failure
    .getByRole("dialog")
    .getByRole("button", { name: "로그인 화면 보기", exact: true })
    .click()
  assert.equal(
    await failure.getByLabel("이메일", { exact: true }).isDisabled(),
    true,
  )
  assert.equal(
    await failure
      .getByRole("button", { name: "연결 준비 중", exact: true })
      .isDisabled(),
    true,
  )
  await failure
    .getByRole("button", { name: "바로 시작하기", exact: true })
    .click()
  reports.push({
    scenario:
      "isolated Canvas failure + partial result + retry + draft preservation + keyboard-height simulation + disconnected auth",
    status: "passed",
  })
  await failure.close()
  const completeFailure = await createPage()
  await completeFailure
    .getByRole("button", { name: "상단 전체 메뉴 열기", exact: true })
    .click()
  await completeFailure
    .getByRole("dialog")
    .getByRole("button", { name: "이미지 만들기", exact: true })
    .click()
  await completeFailure
    .getByLabel("제품 사진 올리기", { exact: true })
    .setInputFiles(photo)
  await completeFailure
    .getByRole("button", { name: "다음으로", exact: true })
    .click()
  await completeFailure
    .getByLabel("상품 이름", { exact: true })
    .fill("이미지 오류 확인")
  await completeFailure.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext
    let once = true
    HTMLCanvasElement.prototype.getContext = function (...args) {
      if (once) {
        once = false
        return null
      }
      return original.apply(this, args)
    }
  })
  await completeFailure
    .getByRole("button", { name: "결과 보기", exact: true })
    .click()
  await completeFailure
    .getByText("다시 준비하거나 아래에서 내용을 수정해 주세요.", {
      exact: true,
    })
    .waitFor()
  assert.equal(await completeFailure.getByRole("tab").count(), 1)
  await completeFailure
    .getByRole("button", { name: "이미지 다시 준비", exact: true })
    .click()
  await completeFailure.locator("#result-poster-preview img").waitFor()
  reports.push({
    scenario:
      "image-only complete failure + retry + explicit new creation defaults",
    status: "passed",
  })
  await completeFailure.close()
  assert.deepEqual(errors, [])
  await writeFile(
    join(output, "verification.json"),
    JSON.stringify(
      {
        reports,
        errors,
        actualApis:
          "Local Canvas/MediaRecorder/clipboard only. Faults injected only in test pages. No paid generation API.",
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
}
