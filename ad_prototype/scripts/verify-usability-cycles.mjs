import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5173/'
const output = process.env.USABILITY_REVIEW_OUTPUT || fileURLToPath(new URL('../ui-review/usability-cycles/', import.meta.url))
const cycles = (process.env.UI_CYCLES || '1,2,3,4,5,6').split(',').map(Number)
const photo = fileURLToPath(new URL('../public/assets/samples/product-example.png', import.meta.url))
const layouts = [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 1440, height: 844 }]
const titles = ['필수 입력·용어', '사진 선택·교체', '메뉴·작업 복귀', '결과 배치·피드백', '재생·정지', '확대·문구 읽기']
await mkdir(output, { recursive: true })
for (let attempt = 0; attempt < 50; attempt++) {
  try { await fetch(base); break } catch {
    if (attempt === 49) throw new Error('Preview server unavailable')
    await new Promise(resolve => setTimeout(resolve, 200))
  }
}
const browser = await chromium.launch({ headless: true, ...(process.env.UI_BROWSER_EXECUTABLE
  ? { executablePath: process.env.UI_BROWSER_EXECUTABLE, args: ['--no-sandbox', '--no-zygote', '--disable-dev-shm-usage'] }
  : process.env.UI_BROWSER_CHANNEL ? { channel: process.env.UI_BROWSER_CHANNEL } : {}) })
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
async function begin(page) {
  await page.goto(base)
  const root = process.env.UI_TEST_FONT_ROOT
  if (root) {
    await page.route('**/test-fonts/*', r => r.fulfill({ path: join(root, 'files', r.request().url().split('/').pop()), contentType: 'font/woff2' }))
    await page.addStyleTag({ content: (await readFile(join(root, 'index.css'), 'utf8')).replaceAll('Noto Sans KR Variable', 'Noto Sans KR').replaceAll('./files/', '/test-fonts/') })
    await page.evaluate(() => document.fonts.ready)
  }
  await page.getByRole('button', { name: '홍보물 만들기', exact: true }).click()
}
async function input(page) {
  await page.getByLabel('제품 사진 올리기', { exact: true }).setInputFiles(photo)
  await page.getByRole('button', { name: '다음으로', exact: true }).click()
  await page.getByLabel('상품 이름', { exact: true }).fill('데일리 샴푸')
}
async function result(page) {
  await page.getByRole('button', { name: '결과 보기', exact: true }).click()
  await page.locator('#result-poster-preview img').waitFor()
}
const style = el => { const s = getComputedStyle(el); return { font: s.fontSize, padding: s.padding, radius: s.borderRadius, color: s.color, background: s.backgroundColor } }
function contrast(s) {
  const lum = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
  const a = lum(s.color), b = lum(s.background)
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
}
try {
  for (const cycle of cycles) {
    const report = []
    for (const layout of layouts) {
      const page = await browser.newPage({ viewport: layout, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] })
      const errors = []; page.on('pageerror', e => errors.push(e.message))
      if (cycle === 6) await page.addInitScript(() => {
        window.cycleSpeechTexts = []
        const synthesis = new EventTarget()
        synthesis.speaking = false; synthesis.pending = false; synthesis.paused = false
        synthesis.getVoices = () => [{ lang: 'ko-KR', name: 'Test Korean voice' }]
        synthesis.cancel = () => { synthesis.speaking = false; synthesis.pending = false }
        synthesis.speak = utterance => { window.cycleSpeechTexts.push(utterance.text); synthesis.speaking = true; utterance.onstart?.() }
        Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis })
        Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class { constructor(text) { this.text = text } } })
      })
      await begin(page)
      let evidence = {}
      if (cycle === 1) {
        await input(page)
        const product = page.getByLabel('상품 이름', { exact: true })
        assert.equal(await product.getAttribute('placeholder'), '예: 카페라떼')
        for (const label of ['소개 및 알리고 싶은 점']) {
          const field = page.getByLabel(label, { exact: true })
          assert.equal(await field.getAttribute('aria-required'), 'false')
          assert.equal(await field.inputValue(), '')
          assert.equal(await field.evaluate(el => el.required), false)
        }
        await product.fill(' ')
        assert.equal(await page.getByRole('button', { name: '결과 보기', exact: true }).isDisabled(), true)
        await product.fill('데일리 샴푸'); await result(page)
        evidence = { productOnlyProgress: true, visibleNamesMatchAccessibleNames: true }
      } else if (cycle === 2) {
        for (const trigger of [page.getByRole('button', { name: '사진 선택창 열기', exact: true }), page.locator('.photo-upload-text-button')]) {
          const opened = page.waitForEvent('filechooser'); await trigger.click()
          const picker = await opened; assert.equal(await picker.element().getAttribute('id'), 'product-photo'); await picker.setFiles([])
        }
        await page.getByLabel('제품 사진 올리기', { exact: true }).setInputFiles(photo)
        await page.locator('.photo-step.is-ready').waitFor()
        assert.equal(await page.locator('#upload-feedback').getAttribute('class'), 'sr-only')
        const selected = page.getByRole('button', { name: '사진 바꾸기', exact: true })
        const selectedStyle = await selected.evaluate(style)
        const opened = page.waitForEvent('filechooser'); await selected.press('Enter'); const picker = await opened; await picker.setFiles([])
        await page.getByRole('button', { name: '다음으로', exact: true }).click()
        await page.getByLabel('상품 이름', { exact: true }).fill('데일리 샴푸')
        const sameStyle = await page.getByRole('button', { name: '사진 바꾸기', exact: true }).evaluate(style)
        assert.deepEqual(sameStyle, selectedStyle)
        const original = await page.locator('.information-photo img').getAttribute('src')
        await page.getByLabel('정보 입력에서 사진 바꾸기').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid image') })
        await page.locator('#details-upload-feedback[role="alert"]').waitFor()
        assert.equal(await page.locator('.information-photo img').getAttribute('src'), original)
        assert.equal(await page.getByLabel('상품 이름', { exact: true }).inputValue(), '데일리 샴푸')
        evidence = { cameraAndTextPicker: true, keyboardPicker: true, sameStyle, failedReplacementPreservesInput: true }
      } else if (cycle === 3) {
        await input(page)
        await page.getByRole('button', { name: '상단 전체 메뉴 열기', exact: true }).click()
        const menu = page.getByRole('dialog')
        const nav = menu.locator('.studio-menu-bottom-nav')
        const before = (await nav.boundingBox()).y
        await menu.evaluate(el => el.scrollTop = el.scrollHeight)
        assert.ok(Math.abs((await nav.boundingBox()).y - before) < 1)
        await menu.getByText('글씨 크기·간편모드', { exact: true }).click()
        await menu.getByRole('switch', { name: '간편모드' }).focus(); await settle(page)
        const switchBounds = await menu.getByRole('switch', { name: '간편모드' }).boundingBox()
        assert.ok(switchBounds.y + switchBounds.height <= before)
        await nav.getByRole('button', { name: '전체 메뉴 닫기' }).click()
        const mainNav = page.locator('.studio-bottom-nav:not(.studio-menu-bottom-nav)')
        await mainNav.getByRole('button', { name: '만들기', exact: true }).click()
        assert.equal(await page.getByLabel('상품 이름', { exact: true }).inputValue(), '데일리 샴푸')
        await mainNav.getByRole('button', { name: '홈', exact: true }).click()
        await page.getByRole('button', { name: '홍보물 이어 만들기' }).click()
        assert.equal(await page.getByLabel('상품 이름', { exact: true }).inputValue(), '데일리 샴푸')
        evidence = { fixedNavY: before, focusedSettingVisible: true, resumeRetainsInput: true }
      } else if (cycle === 4) {
        await input(page); await result(page)
        const actions = []
        for (const [kind, label] of [['poster', '이미지'], ['video', '영상'], ['copy', '문구']]) {
          await page.getByRole('tab', { name: label, exact: true }).click()
          const action = page.locator('#result-' + kind + ' .result-primary-action')
          const styles = await action.evaluate(style)
          assert.ok(contrast(styles) >= 4.5)
          const frame = await page.locator('#result-' + kind + ' .result-preview').boundingBox()
          const box = await action.boundingBox()
          actions.push({ kind, frameHeight: frame.height, actionHeight: box.height, styles })
        }
        assert.equal(actions[0].frameHeight, actions[1].frameHeight)
        assert.equal(actions[1].frameHeight, actions[2].frameHeight)
        assert.deepEqual(actions[0].styles, actions[2].styles)
        const copy = page.getByRole('button', { name: '문구 전체 복사하기' })
        await copy.click()
        await page.locator('#result-copy .result-inline-status[role="status"]').waitFor()
        const id = await copy.getAttribute('aria-describedby')
        assert.ok(id)
        assert.equal(await page.locator('#result-copy .result-inline-status').getAttribute('id'), id)
        assert.equal(await page.locator('#result-copy .result-inline-status').getAttribute('role'), 'status')
        await page.evaluate(() => {
          window.cycleClipboardWrite = navigator.clipboard.writeText.bind(navigator.clipboard)
          window.cycleExecCommand = document.execCommand.bind(document)
          window.cycleFallbackCalls = 0
          navigator.clipboard.writeText = () => Promise.reject(new Error('clipboard denied'))
          document.execCommand = (...args) => { window.cycleFallbackCalls++; return window.cycleExecCommand(...args) }
        })
        await copy.press('Enter')
        await page.waitForFunction(() => window.cycleFallbackCalls === 1 && document.activeElement?.matches('#result-copy .result-primary-action'))
        await page.evaluate(() => { navigator.clipboard.writeText = window.cycleClipboardWrite; document.execCommand = window.cycleExecCommand })
        evidence = { actions, linkedFeedback: true, clipboardFallbackRestoresFocus: true }
      } else if (cycle === 5) {
        await input(page); await result(page)
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        await page.getByRole('tab', { name: '영상', exact: true }).click()
        const image = page.locator('.result-motion-preview img')
        const scale = () => image.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)
        await page.getByRole('button', { name: '재생하기', exact: true }).click()
        await page.waitForTimeout(700)
        assert.ok(await scale() > 1.001)
        await page.getByRole('button', { name: '일시 정지', exact: true }).click(); await settle(page)
        const paused = await scale(); await page.waitForTimeout(400); const later = await scale()
        assert.ok(Math.abs(later - paused) < .0001)
        await page.getByRole('button', { name: '재생하기', exact: true }).click(); await page.waitForTimeout(400)
        assert.ok(Math.abs(await scale() - paused) > .001)
        await page.getByRole('tab', { name: '문구', exact: true }).click()
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.getByRole('tab', { name: '영상', exact: true }).click()
        assert.equal(await image.evaluate(el => getComputedStyle(el).animationName), 'none')
        evidence = { paused, later, pauseDelta: Math.abs(later - paused), resume: true, reducedMotion: true }
      } else if (cycle === 6) {
        await input(page)
        const long = '매일 쓰는 순한 샴푸를 소개합니다.\n제품 특징을 읽고 선택해 주세요.\n'.repeat(15)
        await page.getByLabel('소개 및 알리고 싶은 점', { exact: true }).fill(long)
        await result(page)
        await page.getByRole('button', { name: '크게 보기', exact: true }).click()
        await settle(page)
        assert.equal(await page.locator('#result-poster-preview').evaluate(el => el === document.activeElement), true)
        await page.keyboard.press('ArrowDown')
        await page.waitForFunction(() => document.querySelector('#result-poster-preview').scrollTop > 0)
        await page.getByRole('button', { name: '작게 보기', exact: true }).click()
        await page.getByRole('tab', { name: '문구', exact: true }).click()
        const copy = page.getByRole('region', { name: '홍보 문구 원문', exact: true })
        assert.equal(await page.locator('#result-copy textarea').count(), 0)
        assert.equal(await copy.evaluate(el => getComputedStyle(el).resize), 'none')
        const text = await copy.innerText()
        assert.ok(text.includes(long.trim()))
        await copy.focus(); await settle(page); await page.keyboard.press('ArrowDown')
        await page.waitForFunction(() => document.querySelector('.copy-result-text').scrollTop > 0)
        await page.getByRole('button', { name: '문구 전체 복사하기' }).click()
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), text)
        await page.getByRole('button', { name: '읽어주기', exact: true }).click()
        await page.waitForFunction(() => window.cycleSpeechTexts.length === 1)
        assert.equal(await page.evaluate(() => window.cycleSpeechTexts[0]), '홍보 문구 결과입니다. ' + text)
        await page.getByRole('button', { name: '읽기 멈추기', exact: true }).click()
        evidence = { keyboardImagePan: true, keyboardTextScroll: true, copyMatchesDisplayedText: true, outputNotInput: true, readAloudTextMatches: true, speechMocked: true }
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert.deepEqual(errors, [])
      if (layout.width === 390) { await page.evaluate(() => document.activeElement?.blur()); await page.screenshot({ path: join(output, `cycle-${cycle}-390.png`) }) }
      report.push({ ...layout, status: 'passed', evidence })
      await page.close()
    }
    await writeFile(join(output, `cycle-${cycle}.json`), JSON.stringify({ cycle, title: titles[cycle - 1], layouts: report }, null, 2))
    console.log(`PASS cycle ${cycle}: ${titles[cycle - 1]} (${report.length} layouts)`)
  }
} finally { await browser.close() }
