import { chromium } from "playwright"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { mkdir, writeFile } from "node:fs/promises"
const browser = await chromium.launch({
  channel: process.env.UI_BROWSER_CHANNEL || "msedge",
  headless: true,
})
const out = new URL("../ui-review/phase3/", import.meta.url)
await mkdir(out, { recursive: true })
const sample = fileURLToPath(
  new URL("../design-assets/illustrations/step-photo.png", import.meta.url),
)
const report = {
  layouts: [],
  feedback: {},
  reducedMotion: {},
  limitations: [
    "데스크톱 Edge에서 화면 크기를 바꾼 검증이며 실물 휴대전화 검증이 아님",
    "효과음 청감과 실제 진동은 검증하지 않음",
  ],
}
const click = (page, name) =>
  page.getByRole("button", { name, exact: true }).click()
const settled = (page) => page.waitForTimeout(260)
async function layout(page, width, screen) {
  await settled(page)
  const metrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    states: [...document.querySelectorAll(".journey-progress li")].map(
      (e) => e.dataset.state,
    ),
    current: document.querySelector(".journey-progress [aria-current=step]")
      ?.textContent,
    smallTargets: [...document.querySelectorAll("main button")]
      .filter(
        (e) =>
          e.getBoundingClientRect().width > 0 &&
          e.getBoundingClientRect().height < 44,
      )
      .map((e) => e.textContent),
    placeholders: document
      .querySelector("main")
      ?.textContent.includes("[object Object]"),
  }))
  assert.equal(metrics.overflow, false, `${width} ${screen}: 가로 넘침`)
  assert.deepEqual(metrics.smallTargets, [], `${width} ${screen}: 터치 높이`)
  assert.equal(metrics.placeholders, false)
  report.layouts.push({ width, screen, ...metrics })
  if ([320, 390, 1440].includes(width))
    await page.screenshot({
      path: fileURLToPath(new URL(`${screen}-${width}.png`, out)),
      fullPage: true,
    })
  return metrics
}
try {
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: width < 768 ? 844 : 1000 },
    })
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto("http://127.0.0.1:5173/")
    await page.evaluate(() => document.fonts.ready)
    assert.match(await page.title(), /^홍보잇다/)
    assert.equal(
      await page.locator(".studio-accessibility").getAttribute("open"),
      null,
    )
    const hero = await page.locator(".studio-hero-art img").boundingBox()
    const cta = await page
      .getByRole("button", { name: "홍보물 만들기", exact: true })
      .boundingBox()
    assert(cta.y + cta.height < 700, "첫 화면 주요 행동")
    const guide = await page.locator(".studio-how").boundingBox()
    assert(
      guide.y > cta.y + cta.height && guide.y < hero.y && hero.height > 180,
      "시작 행동 다음 세 단계, 그 다음 결과 예시",
    )
    await layout(page, width, "home")
    await click(page, "홍보물 만들기")
    assert.deepEqual((await layout(page, width, "photo")).states, [
      "current",
      "upcoming",
      "upcoming",
    ])
    if (width < 640) {
      assert.equal(
        await page
          .locator(".photo-next-action")
          .evaluate((e) => getComputedStyle(e).position),
        "static",
        "사진 선택 전에는 비활성 다음 버튼이 업로드를 가리지 않음",
      )
      assert.equal(await page.locator(".upload-target strong").evaluate((e) => {
          const r = e.getBoundingClientRect()
          const hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          )
          return hit === e || e.contains(hit)
        }), true, "첫 사진 선택 안내가 하단 메뉴에 가리지 않음")
    }
    assert.equal(
      await page.locator(".destination-settings").getAttribute("open"),
      null,
    )
    assert.equal(
      await page
        .getByRole("button", { name: "사진 확인하고 다음", exact: true })
        .isDisabled(),
      true,
    )
    await page.locator("input[type=file]").setInputFiles(sample)
    await click(page, "사진 확인하고 다음")
    await page
      .getByLabel("제품 설명", { exact: true })
      .fill("우리 동네에서 직접 만드는 수제 빵")
    await page
      .getByLabel("강조할 특징", { exact: true })
      .fill("매일 아침 매장에서 구워요")
    await click(page, "사진 올리기 단계로 돌아가기")
    assert.equal(await page.locator(".selected-photo").count(), 1)
    await click(page, "사진 확인하고 다음")
    assert.equal(
      await page.getByLabel("제품 설명", { exact: true }).inputValue(),
      "우리 동네에서 직접 만드는 수제 빵",
    )
    assert.deepEqual((await layout(page, width, "details")).states, [
      "complete",
      "current",
      "upcoming",
    ])
    await click(page, "이 내용으로 결과 보기")
    assert.deepEqual((await layout(page, width, "results")).states, [
      "complete",
      "complete",
      "current",
    ])
    assert.equal(await page.locator(".result-card").count(), 3)
    await click(page, "홍보 내용 설명하기 단계로 돌아가기")
    assert.equal(
      await page.getByLabel("강조할 특징", { exact: true }).inputValue(),
      "매일 아침 매장에서 구워요",
    )
    await page.locator(".studio-accessibility > summary").click()
    assert.equal(
      await page
        .getByRole("switch", { name: "효과음", exact: true })
        .getAttribute("aria-checked"),
      "false",
    )
    assert.equal(
      await page
        .getByRole("switch", { name: "진동 피드백", exact: true })
        .getAttribute("aria-checked"),
      "false",
    )
    await layout(page, width, "settings")
    assert.deepEqual(errors, [])
    await page.close()
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.addInitScript(() => {
    window.__feedback = { contexts: 0, notes: [], vibrations: [] }
    const Native = window.AudioContext
    window.AudioContext = class extends Native {
      constructor() {
        super()
        window.__feedback.contexts++
      }
      createOscillator() {
        const o = super.createOscillator()
        const start = o.start.bind(o)
        o.start = (...a) => {
          window.__feedback.notes.push(o.frequency.value)
          start(...a)
        }
        return o
      }
    }
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: (ms) => {
        window.__feedback.vibrations.push(ms)
        return true
      },
    })
  })
  await page.goto("http://127.0.0.1:5173/")
  await click(page, "홍보물 만들기")
  await page.locator("input[type=file]").setInputFiles(sample)
  await click(page, "사진 확인하고 다음")
  await click(page, "이 내용으로 결과 보기")
  assert.deepEqual(
    await page.evaluate(() => window.__feedback),
    { contexts: 0, notes: [], vibrations: [] },
    "동의 전 자동 재생 금지",
  )
  await page.locator(".studio-accessibility > summary").click()
  await page.getByRole("switch", { name: "효과음", exact: true }).click()
  await page.getByRole("switch", { name: "진동 피드백", exact: true }).click()
  await settled(page)
  assert.equal(
    (await page.evaluate(() => window.__feedback.notes)).length,
    0,
    "설정 전환만으로 소리 없음",
  )
  await click(page, "효과음 들어보기")
  await settled(page)
  assert.deepEqual(
    await page.evaluate(() => window.__feedback.notes),
    [523.25, 659.25],
  )
  await click(page, "홍보 내용 설명하기 단계로 돌아가기")
  const before = await page.evaluate(() => window.__feedback.notes.length)
  await settled(page)
  assert.equal(
    await page.evaluate(() => window.__feedback.notes.length),
    before,
    "일반 단계 이동은 무음",
  )
  await click(page, "이 내용으로 결과 보기")
  await settled(page)
  assert.equal(
    await page.evaluate(() => window.__feedback.notes.length),
    before + 2,
  )
  assert.deepEqual(
    await page.evaluate(() => window.__feedback.vibrations),
    [20],
  )
  await page.getByRole("switch", { name: "효과음", exact: true }).click()
  await page.getByRole("switch", { name: "진동 피드백", exact: true }).click()
  const offCount = await page.evaluate(() => window.__feedback.notes.length)
  await click(page, "홍보 내용 설명하기 단계로 돌아가기")
  await click(page, "이 내용으로 결과 보기")
  await settled(page)
  assert.equal(
    await page.evaluate(() => window.__feedback.notes.length),
    offCount,
  )
  assert.deepEqual(
    await page.evaluate(() => window.__feedback.vibrations),
    [20, 0],
  )
  await page.getByRole("switch", { name: "효과음", exact: true }).click()
  await page.reload()
  assert.equal(
    await page.evaluate(() => window.__feedback.contexts),
    0,
    "저장된 켜짐도 페이지 로드 시 재생하지 않음",
  )
  await page.locator(".studio-accessibility > summary").click()
  assert.equal(
    await page
      .getByRole("switch", { name: "효과음", exact: true })
      .getAttribute("aria-checked"),
    "true",
  )
  assert.equal(await page.evaluate(() => window.__feedback.notes.length), 0)
  report.feedback = {
    defaultOff: true,
    noAutoplay: true,
    realWebAudioOscillator: true,
    originalToneFrequencies: [523.25, 659.25],
    ordinaryButtonsSilent: true,
    onlyOptedInCompletionVibrationMs: 20,
    offStopsFeedback: true,
    preferencesRestored: true,
    physicalDevice: false,
  }
  await page.close()
  const unsupported = await browser.newPage()
  await unsupported.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", {
      value: undefined,
      configurable: true,
    })
    Object.defineProperty(navigator, "vibrate", {
      value: undefined,
      configurable: true,
    })
    Storage.prototype.setItem = () => {
      throw new Error("storage blocked")
    }
  })
  await unsupported.goto("http://127.0.0.1:5173/")
  await unsupported.locator(".studio-accessibility > summary").click()
  assert.equal(
    await unsupported
      .getByRole("switch", { name: "효과음", exact: true })
      .isDisabled(),
    true,
  )
  assert.equal(
    await unsupported
      .getByRole("switch", { name: "진동 피드백", exact: true })
      .isDisabled(),
    true,
  )
  await click(unsupported, "홍보물 만들기")
  await unsupported.locator("input[type=file]").setInputFiles(sample)
  await click(unsupported, "사진 확인하고 다음")
  await click(unsupported, "이 내용으로 결과 보기")
  assert.equal(await unsupported.locator(".result-card").count(), 3)
  report.feedback.unsupportedCoreWorkflow = true
  await unsupported.close()
  const blocked = await browser.newPage()
  await blocked.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("storage blocked")
    }
  })
  await blocked.goto("http://127.0.0.1:5173/")
  await blocked.locator(".studio-accessibility > summary").click()
  await blocked.getByRole("switch", { name: "효과음", exact: true }).click()
  assert.equal(
    await blocked
      .getByText("설정은 이 창에서만 유지돼요.", { exact: true })
      .isVisible(),
    true,
  )
  report.feedback.storageFailureSafe = true
  await blocked.close()
  const reduced = await browser.newPage({
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  })
  await reduced.goto("http://127.0.0.1:5173/")
  await click(reduced, "홍보물 만들기")
  const motion = await reduced.locator(".step-panel").evaluate((e) => ({
    animation: getComputedStyle(e).animationName,
    transition: getComputedStyle(e.querySelector("button")).transitionDuration,
  }))
  assert.equal(motion.animation, "none")
  assert.equal(parseFloat(motion.transition), 0)
  await reduced.locator("input[type=file]").setInputFiles(sample)
  await click(reduced, "사진 확인하고 다음")
  await click(reduced, "이 내용으로 결과 보기")
  assert.equal(await reduced.locator(".result-card").count(), 3)
  report.reducedMotion = { ...motion, workflow: true }
  await reduced.close()
  await writeFile(
    new URL("verification.json", out),
    JSON.stringify(report, null, 2) + "\n",
  )
  console.log(
    "PASS: 7개 너비 × 5개 화면, 단계 상태·뒤로 이동·입력 보존, 기본 무음·Web Audio·선택형 진동·저장·미지원·저장 실패·동작 줄이기 검증",
  )
} finally {
  await browser.close()
}
