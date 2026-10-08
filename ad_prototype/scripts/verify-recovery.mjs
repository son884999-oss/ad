import { chromium } from "playwright"
import { fileURLToPath } from "node:url"
import { writeFile } from "node:fs/promises"
const browser = await chromium.launch({
  headless: true,
  channel: process.env.UI_BROWSER_CHANNEL || "msedge",
})
const reports = []
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto("http://127.0.0.1:5173/")
  await page.getByRole("button", { name: "바로 시작하기", exact: true }).click()
  await page.getByRole("button", { name: "만들러 가기", exact: true }).click()
  const fileInput = page.locator("input[type=file]")
  await fileInput.setInputFiles(
    fileURLToPath(
      new URL("../../D_고혜숙/public/sample-product.png", import.meta.url),
    ),
  )
  await page
    .getByRole("button", { name: "사진 확인하고 다음", exact: true })
    .waitFor()
  const original = await page.locator("main img").getAttribute("src")
  for (const file of [
    {
      name: "not-photo.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("text"),
    },
    {
      name: "large.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(21 * 1024 * 1024),
    },
    {
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from("corrupt image"),
    },
  ]) {
    await fileInput.setInputFiles(file)
    await page.getByText(/기존 사진은 그대로예요/).waitFor()
    if (
      (await page.locator("main img").getAttribute("src")) !== original ||
      !(await page
        .getByRole("button", { name: "사진 확인하고 다음", exact: true })
        .isEnabled()) ||
      (await fileInput.inputValue()) !== ""
    )
      throw Error("invalid replacement lost usable original")
    reports.push({
      photoError: file.name,
      originalPreserved: true,
      retryAllowed: true,
    })
  }
  await page.evaluate(() => {
    const Reader = window.FileReader
    window.FileReader = class extends Reader {
      readAsDataURL(file) {
        setTimeout(() => super.readAsDataURL(file), 1000)
      }
    }
  })
  const replacement = {
    name: "new.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#aabbcc"/></svg>',
    ),
  }
  await fileInput.setInputFiles(replacement)
  if (
    await page
      .getByRole("button", { name: "사진 확인 중", exact: true })
      .isEnabled()
  )
    throw Error("pending decode must block next")
  await fileInput.setInputFiles({
    name: "cancel-new.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid latest request"),
  })
  await page.waitForTimeout(1250)
  if ((await page.locator("main img").getAttribute("src")) !== original)
    throw Error("stale decode committed after newer selection")
  await fileInput.setInputFiles(replacement)
  await page.getByText("사진이 준비됐어요.", { exact: true }).waitFor()
  if ((await page.locator("main img").getAttribute("src")) === original)
    throw Error("valid replacement not committed")
  reports.push({
    pendingBlocksNext: true,
    staleDecodeIgnored: true,
    validReplacement: true,
  })
  await page.close()

  for (const scenario of [
    "cancel-preparing",
    "pending-timeout",
    "start-end",
    "interrupted",
    "unsupported",
  ]) {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await p.addInitScript(
      ({ scenario }) => {
        window.__speechProbe = { calls: 0, cancels: 0, utterance: null }
        const probe = window.__speechProbe
        const synth = new (class extends EventTarget {
          speaking = false
          pending = false
          paused = false
          getVoices() {
            return []
          }
          speak(utterance) {
            probe.calls++
            probe.utterance = utterance
            this.pending = true
            if (scenario === "start-end") {
              this.pending = false
              this.speaking = true
              utterance.onstart?.(new Event("start"))
            }
          }
          cancel() {
            probe.cancels++
            this.speaking = false
            this.pending = false
          }
        })()
        Object.defineProperty(window, "speechSynthesis", {
          configurable: true,
          value: synth,
        })
        if (scenario === "unsupported")
          Object.defineProperty(window, "SpeechSynthesisUtterance", {
            configurable: true,
            value: undefined,
          })
      },
      { scenario },
    )
    await p.clock.install()
    await p.goto("http://127.0.0.1:5173/")
    await p.getByRole("button", { name: "화면 읽어주기", exact: true }).click()
    if (scenario === "unsupported") {
      await p.getByText(/읽어주기를 사용할 수 없어요/).waitFor()
    } else if (scenario === "cancel-preparing") {
      await p
        .getByRole("button", { name: "읽기 준비 취소", exact: true })
        .click()
      await p.clock.fastForward(11000)
      if ((await p.evaluate(() => window.__speechProbe.calls)) !== 0)
        throw Error("canceled preparation later started")
    } else {
      await p.clock.fastForward(1600)
      await p.waitForFunction(() => window.__speechProbe.calls === 1)
      if (scenario === "pending-timeout") {
        const old = await p.evaluateHandle(() => window.__speechProbe.utterance)
        await p.clock.fastForward(8100)
        await p.getByText(/읽어주기를 시작하지 못했어요/).waitFor()
        await old.evaluate((u) => u.onstart?.(new Event("start")))
      } else if (scenario === "start-end") {
        await p
          .getByRole("button", { name: "읽어주기 멈추기", exact: true })
          .waitFor()
        await p.evaluate(() => {
          window.speechSynthesis.speaking = false
          window.__speechProbe.utterance.onend?.(new Event("end"))
        })
      } else {
        await p.evaluate(() =>
          window.__speechProbe.utterance.onerror?.({ error: "interrupted" }),
        )
        if (
          await p
            .getByText("읽어주기를 준비하고 있어요.", { exact: true })
            .count()
        )
          throw Error("interrupted speech left stale preparing message")
      }
    }
    await p
      .getByRole("button", { name: "화면 읽어주기", exact: true })
      .waitFor()
    reports.push({
      speechScenario: scenario,
      ...(await p.evaluate(() => ({
        calls: window.__speechProbe.calls,
        cancels: window.__speechProbe.cancels,
      }))),
    })
    await p.close()
  }
  await writeFile(
    new URL("../ui-review/recovery-verification.json", import.meta.url),
    JSON.stringify(reports, null, 2),
  )
  console.log(
    "PASS: invalid/corrupt/large photo replacement preserves original; pending/latest-file guards; mocked speech preparation cancel, pending timeout, stale events, start/end, interrupt and unsupported device states.",
  )
} finally {
  await browser.close()
}
