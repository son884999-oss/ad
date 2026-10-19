import assert from "node:assert/strict"
import { chromium } from "playwright"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const base = process.env.UI_BASE_URL || "http://127.0.0.1:5173/"
const output =
  process.env.SCREEN_FIT_OUTPUT ||
  fileURLToPath(new URL("../ui-review/screen-fit/", import.meta.url))
const photo = fileURLToPath(
  new URL("../public/assets/samples/product-example.png", import.meta.url),
)
const profiles = [
  [360, 640],
  [390, 693],
  [390, 844],
  [430, 760],
  [430, 844],
  [768, 1024],
  [1440, 900],
]
const reports = [],
  errors = []
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  ...(process.env.UI_BROWSER_EXECUTABLE
    ? {
        executablePath: process.env.UI_BROWSER_EXECUTABLE,
        args: ["--no-sandbox", "--no-zygote", "--disable-dev-shm-usage"],
      }
    : {}),
})
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  )
const nav = (page) =>
  page.getByRole("navigation", { name: "모바일 빠른 메뉴", exact: true })
async function geometry(page, name, targets, menu = false) {
  await page.evaluate(() => scrollTo(0, 0))
  if (menu) await page.getByRole("dialog").evaluate((el) => (el.scrollTop = 0))
  await settle(page)
  const lower = (
    await (
      menu
        ? page.getByRole("dialog").locator(".studio-menu-bottom-nav")
        : nav(page)
    ).boundingBox()
  ).y
  const boxes = []
  for (const [label, target] of targets) {
    const box = await target.boundingBox()
    boxes.push({ label, ...box })
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  )
  const r = { name, viewport: page.viewportSize(), lower, boxes, overflow }
  reports.push(r)
  await page.screenshot({ path: join(output, name + ".png") })
  await writeFile(
    join(output, "geometry.json"),
    JSON.stringify({ reports, errors }, null, 2),
  )
  assert.equal(overflow, false, name + ": horizontal overflow")
  for (const box of boxes)
    assert.ok(
      box.y >= 0 && box.y + box.height <= lower - 6,
      name + ": hidden below navigation " + JSON.stringify(box),
    )
  return r
}
async function font(page) {
  const root = process.env.UI_TEST_FONT_ROOT
  if (!root) return
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
try {
  for (const [width, height] of profiles)
    for (const mode of ["easy", "regular"]) {
      const page = await browser.newPage({
        viewport: { width, height },
        reducedMotion: "reduce",
      })
      page.on("pageerror", (e) => errors.push(e.message))
      await page.goto(base)
      await font(page)
      if (mode === "regular") {
        await page
          .getByRole("button", { name: "상단 전체 메뉴 열기", exact: true })
          .click()
        await page
          .getByRole("dialog")
          .getByText("글씨 크기·간편모드", { exact: true })
          .click()
        await page
          .getByRole("switch", { name: "간편모드", exact: true })
          .click()
        await page.keyboard.press("Escape")
      }
      const key = `${width}x${height}-${mode}`
      await geometry(
        page,
        "home-" + key,
        [
          ".studio-header",
          "#start-guide-title",
          ".studio-hero-description",
          ".studio-guide-action",
          ".home-sample-art",
          ".studio-section-title",
          ".studio-guide-steps",
        ].map((s) => [s, page.locator(s)]),
      )
      await page
        .getByRole("button", { name: "상단 전체 메뉴 열기", exact: true })
        .click()
      const menu = page.getByRole("dialog", { name: "전체 메뉴", exact: true })
      const menuTargets = []
      for (const target of await menu.getByRole("button").all()) {
        if (await target.evaluate((el) => !!el.closest(".studio-bottom-nav")))
          continue
        menuTargets.push([await target.innerText(), target])
      }
      for (const target of await menu
        .locator(":scope > .service-menu-section > summary")
        .all())
        menuTargets.push([await target.innerText(), target])
      await geometry(page, "menu-" + key, menuTargets, true)
      for (const [, target] of menuTargets)
        assert.ok((await target.boundingBox()).height >= 44)
      await page.keyboard.press("Escape")
      await page
        .getByRole("button", { name: "홍보물 만들기", exact: true })
        .click()
      const photoTargets = [
        ".journey-progress",
        ".photo-upload",
        ".photo-output-format",
        ".photo-next-action > button",
      ]
      await geometry(
        page,
        "photo-empty-" + key,
        photoTargets.map((s) => [s, page.locator(s)]),
      )
      await page
        .getByLabel("제품 사진 올리기", { exact: true })
        .setInputFiles(photo)
      await geometry(
        page,
        "photo-selected-" + key,
        photoTargets.map((s) => [s, page.locator(s)]),
      )
      await page.getByRole("button", { name: "다음으로", exact: true }).click()
      assert.equal(await page.locator(".details-fields > label").count(), 3)
      const product = page.getByLabel("상품 이름", { exact: true })
      const description = page.getByLabel("소개 및 알리고 싶은 점", {
        exact: true,
      })
      assert.equal(await description.getAttribute("aria-required"), "false")
      assert.equal(await product.getAttribute("aria-required"), "true")
      const formTargets = [
        ".journey-progress",
        ".information-photo",
        ".details-fields > label:nth-child(1)",
        ".details-fields > label:nth-child(2)",
        ".details-fields > label:nth-child(3)",
        ".details-actions",
      ]
      await geometry(
        page,
        "information-empty-" + key,
        formTargets.map((s) => [s, page.locator(s)]),
      )
      const initial = await description.boundingBox()
      assert.ok(
        initial.height >= 44 && initial.height <= 58,
        "Description must initially be a single comfortable row",
      )
      await product.fill("카페라떼")
      await geometry(
        page,
        "information-product-only-" + key,
        formTargets.map((s) => [s, page.locator(s)]),
      )
      await description.fill("고소한 라떼")
      assert.ok((await description.boundingBox()).height <= 58)
      const long =
        "첫 줄의 소개와 알리고 싶은 내용입니다. ".repeat(12) +
        "\n마지막 줄도 남아 있어요."
      await description.fill(long)
      await settle(page)
      const grown = await description.evaluate((el) => ({
        height: el.clientHeight,
        content: el.scrollHeight,
        value: el.value,
      }))
      assert.ok(
        grown.height > initial.height && grown.height >= grown.content - 1,
      )
      assert.equal(grown.value, long)
      await page.screenshot({
        path: join(output, "information-grown-" + key + ".png"),
        fullPage: true,
      })
      await description.fill("")
      await settle(page)
      assert.ok(
        (await description.boundingBox()).height <= 58,
        "Textarea must shrink after deleting text",
      )
      await page.getByRole("button", { name: "결과 보기", exact: true }).click()
      await page.locator("#result-poster-preview img").waitFor()
      for (const [kind, label] of [
        ["poster", "이미지"],
        ["video", "영상"],
      ]) {
        await page.getByRole("tab", { name: label, exact: true }).click()
        await geometry(
          page,
          `result-${kind}-` + key,
          [
            ".journey-progress",
            ".result-tabs",
            `#result-${kind} .result-card-heading`,
            `#result-${kind} .result-preview`,
            `#result-${kind} .result-card-actions`,
          ].map((s) => [s, page.locator(s)]),
        )
      }
      if (width === 360 && height === 640 && mode === "easy") {
        for (const [kind, label] of [
          ["poster", "이미지 만들기"],
          ["video", "영상 만들기"],
          ["copy", "문구 만들기"],
        ]) {
          await page
            .getByRole("button", { name: "상단 전체 메뉴 열기", exact: true })
            .click()
          await page
            .getByRole("dialog")
            .getByRole("button", { name: label, exact: true })
            .click()
          await page.locator("#product-photo").setInputFiles(photo)
          await page
            .getByRole("button", { name: "다음으로", exact: true })
            .click()
          await product.fill("")
          await description.fill("")
          await geometry(
            page,
            `information-${kind}-empty-` + key,
            formTargets.map((s) => [s, page.locator(s)]),
          )
          await product.fill("카페라떼")
          await geometry(
            page,
            `information-${kind}-product-only-` + key,
            formTargets.map((s) => [s, page.locator(s)]),
          )
        }
      }
      await page.close()
      console.log(`PASS first screen ${key}`)
    }
  assert.deepEqual(errors, [])
  await writeFile(
    join(output, "verification.json"),
    JSON.stringify(
      {
        profiles: profiles.length * 2,
        screens: reports.length,
        reports,
        errors,
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
}
