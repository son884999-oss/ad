import { chromium } from "playwright"
import { fileURLToPath } from "node:url"
import { mkdir, writeFile } from "node:fs/promises"
const browser = await chromium.launch({
  headless: true,
  channel: process.env.UI_BROWSER_CHANNEL || "msedge",
})
const output = new URL("../ui-review/", import.meta.url)
await mkdir(output, { recursive: true })
const reports = []
try {
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.goto("http://127.0.0.1:5173/")
    await page
      .getByRole("button", { name: "처음이신가요? 회원가입", exact: true })
      .click()
    await page
      .getByRole("button", { name: "이미 계정이 있나요? 로그인", exact: true })
      .waitFor()
    await page
      .getByRole("button", { name: "이미 계정이 있나요? 로그인", exact: true })
      .click()
    await page
      .getByRole("button", { name: "비밀번호 보기", exact: true })
      .click()
    if (
      (await page.getByPlaceholder("4자 이상 입력").getAttribute("type")) !==
      "text"
    )
      throw Error("password visibility")
    await page
      .getByRole("button", { name: "비밀번호 숨기기", exact: true })
      .click()
    await page.getByPlaceholder("name@example.com").fill("demo@example.com")
    await page.getByPlaceholder("4자 이상 입력").fill("demo")
    await page.getByRole("button", { name: "로그인", exact: true }).click()
    await page.locator(".studio-start-guide").waitFor()
    if (
      (await page
        .getByRole("switch", { name: "간편모드", exact: true })
        .getAttribute("aria-checked")) !== "true"
    )
      throw Error("default simple mode")
    await page
      .getByRole("button", { name: "화면 읽어주기", exact: true })
      .waitFor()
    if ((await page.locator(".studio-guide-steps li").count()) !== 3)
      throw Error("guide")
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      leftNav: getComputedStyle(document.querySelector(".studio-quickbar"))
        .display,
      bottomNav: getComputedStyle(document.querySelector(".studio-bottom-nav"))
        .display,
      buttonY: document
        .querySelector(".studio-guide-action button")
        .getBoundingClientRect().top,
      stepsBottom: document
        .querySelector(".studio-guide-steps")
        .getBoundingClientRect().bottom,
    }))
    if (
      metrics.overflow ||
      metrics.buttonY < metrics.stepsBottom ||
      (width < 1024
        ? metrics.leftNav !== "none" || metrics.bottomNav === "none"
        : metrics.leftNav === "none" || metrics.bottomNav !== "none")
    )
      throw Error(JSON.stringify(metrics))
    await page.screenshot({
      path: fileURLToPath(new URL(`guide-${width}.png`, output)),
      fullPage: true,
    })
    await page.getByRole("button", { name: "메뉴 열기", exact: true }).click()
    await page.getByRole("dialog", { name: "전체 메뉴", exact: true }).waitFor()
    await page.keyboard.press("Tab")
    if (
      !(await page.evaluate(() =>
        document
          .querySelector(".studio-menu-panel")
          .contains(document.activeElement),
      ))
    )
      throw Error("dialog focus")
    await page.keyboard.press("Escape")
    if (await page.locator(".studio-menu-panel").count())
      throw Error("escape close")
    if (width >= 1024)
      await page
        .locator(".studio-quickbar")
        .getByRole("button", { name: "구독·건당 플랜", exact: true })
        .click()
    else {
      await page.getByRole("button", { name: "메뉴 열기", exact: true }).click()
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "구독·건당 플랜", exact: true })
        .click()
    }
    const monthly = page.getByRole("button", {
      name: /매달 이용하는 구독 플랜/,
    })
    const single = page.getByRole("button", {
      name: /한 번씩 이용하는 건당 플랜/,
    })
    await monthly.waitFor()
    await single.click()
    if ((await single.getAttribute("aria-pressed")) !== "true")
      throw Error("single plan")
    await monthly.click()
    if ((await monthly.getAttribute("aria-pressed")) !== "true")
      throw Error("monthly plan")
    await page.getByRole("button", { name: "홍보잇다 홈", exact: true }).click()
    await page.getByRole("button", { name: "만들러 가기", exact: true }).click()
    await page
      .getByRole("heading", { name: "제품 사진을 올려 주세요", exact: true })
      .waitFor()
    reports.push({
      width,
      ...metrics,
      guide: true,
      defaultMode: true,
      loginForm: true,
      signupForm: true,
      passwordVisibility: true,
      menuFocus: true,
      plans: true,
    })
    await page.close()
  }
  await writeFile(
    new URL("studio-verification.json", output),
    JSON.stringify(reports, null, 2),
  )
  console.log(
    "PASS: onboarding, default simple mode, desktop left/mobile bottom navigation, login/signup form switching, password visibility, menu keyboard focus and two plan selections at 320/390/1440px.",
  )
} finally {
  await browser.close()
}
