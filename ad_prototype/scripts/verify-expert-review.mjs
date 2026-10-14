import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const output = process.env.EXPERT_REVIEW_OUTPUT || fileURLToPath(new URL('../ui-review/expert-review/', import.meta.url))
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5173/'
const photo = fileURLToPath(new URL('../public/assets/samples/product-example.png', import.meta.url))
const layouts = [320, 375, 390, 430, 768, 1024, 1440].map(width => ({ width, height: 844 }))
layouts.push({ width: 320, height: 568 }, { width: 390, height: 450 }, { width: 844, height: 390 })
const selectedLayouts = process.env.UI_LAYOUT_FILTER ? layouts.filter(layout => `${layout.width}x${layout.height}` === process.env.UI_LAYOUT_FILTER) : layouts
const modes = process.env.UI_MODE_FILTER ? [process.env.UI_MODE_FILTER] : ['easy', 'regular']
await mkdir(output, { recursive: true })
for (let i = 0; i < 50; i++) {
  try { await fetch(base); break } catch { if (i === 49) throw new Error('Preview server unavailable'); await new Promise(resolve => setTimeout(resolve, 200)) }
}
const browser = await chromium.launch({ headless: true, ...(process.env.UI_BROWSER_EXECUTABLE
  ? { executablePath: process.env.UI_BROWSER_EXECUTABLE, args: ['--no-sandbox', '--no-zygote', '--disable-dev-shm-usage'] }
  : process.env.UI_BROWSER_CHANNEL ? { channel: process.env.UI_BROWSER_CHANNEL } : {}) })
const reports = []
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
async function open(page, mode) {
  await page.addInitScript(() => {
    window.expertSpeech = { texts: [], cancels: 0 }
    const synthesis = new EventTarget()
    synthesis.speaking = false; synthesis.pending = false; synthesis.paused = false
    synthesis.getVoices = () => [{ lang: 'ko-KR', name: 'QA Korean voice' }]
    synthesis.cancel = () => { window.expertSpeech.cancels++; synthesis.speaking = false; synthesis.pending = false }
    synthesis.speak = utterance => { window.expertSpeech.texts.push(utterance.text); synthesis.speaking = true; utterance.onstart?.() }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class { constructor(text) { this.text = text } } })
    const Recorder = window.MediaRecorder
    window.expertRecorders = []
    if (Recorder) window.MediaRecorder = class extends Recorder { constructor(...args) { super(...args); window.expertRecorders.push(this) } }
  })
  await page.goto(base)
  const root = process.env.UI_TEST_FONT_ROOT
  if (root) {
    await page.route('**/test-fonts/*', r => r.fulfill({ path: join(root, 'files', r.request().url().split('/').pop()), contentType: 'font/woff2' }))
    await page.addStyleTag({ content: (await readFile(join(root, 'index.css'), 'utf8')).replaceAll('Noto Sans KR Variable', 'Noto Sans KR').replaceAll('./files/', '/test-fonts/') })
    await page.evaluate(() => document.fonts.ready)
  }
  if (mode === 'regular') {
    await page.getByRole('button', { name: '상단 전체 메뉴 열기', exact: true }).click()
    await page.getByRole('dialog').getByRole('switch', { name: '간편모드' }).click()
    await page.keyboard.press('Escape')
  }
}
async function speak(page) {
  const count = await page.evaluate(() => window.expertSpeech.texts.length)
  await page.getByRole('button', { name: '읽어주기', exact: true }).click()
  await page.waitForFunction(expected => window.expertSpeech.texts.length > expected, count)
  const stop = page.getByRole('button', { name: '읽기 멈추기', exact: true })
  assert.equal(await stop.innerText(), await stop.getAttribute('aria-label'))
  return page.evaluate(() => window.expertSpeech.texts.at(-1))
}
async function stop(page) { await page.getByRole('button', { name: '읽기 멈추기', exact: true }).click() }
async function capture(page, name, top = false) {
  if (top) await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0) })
  await settle(page); await page.screenshot({ path: join(output, name) })
}
async function input(page) {
  await page.getByRole('button', { name: '홍보물 만들기', exact: true }).click()
  await page.getByLabel('제품 사진 올리기', { exact: true }).setInputFiles(photo)
  await page.getByRole('button', { name: '다음 단계', exact: true }).click()
  await page.getByLabel('상품명', { exact: true }).fill('데일리 샴푸')
}
async function result(page) {
  await page.getByRole('button', { name: '결과 보기', exact: true }).click()
  await settle(page)
  await page.locator('#result-poster-preview img').waitFor({ state: 'attached' })
}
const metrics = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return { width: r.width, height: r.height, font: s.fontSize, family: s.fontFamily, lineHeight: s.lineHeight } }
async function completeControl(page, control) {
  await control.scrollIntoViewIfNeeded(); await control.focus(); await settle(page)
  const r = await control.evaluate(el => {
    const b = el.getBoundingClientRect()
    const points = [[b.x + b.width / 2, b.y + b.height / 2]]
    for (let i = 0; i < 8; i++) points.push([b.x + b.width / 2 + Math.cos(i * Math.PI / 4) * b.width * .375, b.y + b.height / 2 + Math.sin(i * Math.PI / 4) * b.height * .375])
    const nav = document.querySelector('.studio-bottom-nav:not(.studio-menu-bottom-nav)').getBoundingClientRect()
    const tabs = document.querySelector('.result-tabs-bar').getBoundingClientRect()
    const label = el.querySelector('span').getBoundingClientRect()
    return { top: b.top, bottom: b.bottom, labelTop: label.top, labelBottom: label.bottom, safeTop: tabs.bottom, safeBottom: nav.top, hits: points.map(([x, y]) => el.contains(document.elementFromPoint(x, y))) }
  })
  assert.ok(r.hits.every(Boolean), 'Media control is obscured: ' + JSON.stringify(r))
  assert.ok(r.top >= r.safeTop - 1 && r.bottom <= r.safeBottom + 1, 'Media control/label not fully visible: ' + JSON.stringify(r))
  return r
}
async function lifecycle(page, downloads) {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('tab', { name: '영상', exact: true }).click()
  await page.getByRole('button', { name: '재생하기', exact: true }).click()
  assert.ok((await speak(page)).includes('일시 정지'))
  await stop(page)
  await page.getByRole('button', { name: '내용 다시 수정하기', exact: true }).click()
  await page.getByLabel('상품명', { exact: true }).fill('새 샴푸')
  await result(page)
  assert.equal(await page.getByRole('button', { name: '재생하기', exact: true }).getAttribute('aria-pressed'), 'false')
  assert.equal(await page.locator('.result-motion-preview img').evaluate(el => getComputedStyle(el).animationPlayState), 'paused')

  await page.getByRole('button', { name: '영상 저장하기', exact: true }).click()
  await page.waitForFunction(() => window.expertRecorders.some(r => r.state === 'recording'))
  assert.match(await page.locator('#result-video .result-inline-status').innerText(), /이동하면 준비를 취소/)
  assert.ok((await speak(page)).includes('준비 취소'))
  await stop(page)
  const count = downloads.length
  await page.locator('.studio-bottom-nav:not(.studio-menu-bottom-nav)').getByRole('button', { name: '홈', exact: true }).click()
  await page.waitForTimeout(3500)
  assert.equal(downloads.length, count, 'Hidden preparation downloaded after leaving')
  assert.ok(await page.evaluate(() => window.expertRecorders.every(r => r.state === 'inactive' && r.stream.getTracks().every(t => t.readyState === 'ended'))))
  await page.getByRole('button', { name: '홍보물 이어 만들기', exact: true }).click()
  await page.locator('#result-poster-preview img').waitFor()
  await page.getByRole('tab', { name: '영상', exact: true }).click()

  const recordCount = await page.evaluate(() => window.expertRecorders.length)
  await page.getByRole('button', { name: '영상 저장하기', exact: true }).click()
  await page.waitForFunction(n => window.expertRecorders.length > n && window.expertRecorders.at(-1).state === 'recording', recordCount)
  await page.getByRole('button', { name: '내용 다시 수정하기', exact: true }).click()
  await page.getByLabel('상품명', { exact: true }).fill('최종 샴푸')
  await result(page)
  await page.waitForTimeout(3500)
  assert.equal(downloads.length, count, 'Old name preparation downloaded after edit')
  assert.ok(!/준비됐어요/.test(await page.locator('#result-video').innerText()))

  // A cancelled image decode must settle before retry resets the shared cancellation flag.
  await page.evaluate(() => {
    const ImageClass = window.Image
    window.Image = class extends ImageClass {
      set src(value) { setTimeout(() => { super.src = value }, 1000) }
      get src() { return super.src }
    }
  })
  await page.getByRole('button', { name: '영상 저장하기', exact: true }).click()
  await page.getByRole('button', { name: '영상 준비 취소', exact: true }).click()
  const saved = page.waitForEvent('download', { timeout: 45000 })
  await page.getByRole('button', { name: '영상 저장하기', exact: true }).click()
  const video = await saved
  assert.ok((await stat(await video.path())).size > 1000)
  assert.equal(downloads.length, count + 1, 'Cancelled decode revived a duplicate export')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  return { editStopsPlayback: true, leaveCancelsPreparation: true, tracksReleased: true, editCancelsOldExport: true, delayedDecodeCancelRetrySingleExport: true }
}
try {
  for (const layout of selectedLayouts) for (const mode of modes) {
    const page = await browser.newPage({ viewport: layout, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] })
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    const downloads = []; page.on('download', d => downloads.push(d))
    await open(page, mode)
    await input(page)
    const informationSpeech = await speak(page)
    assert.ok(informationSpeech.includes('소개') && informationSpeech.includes('알리고 싶은 점') && informationSpeech.includes('사진 바꾸기'))
    assert.ok(!/주요 고객|제품 설명|강조할 특징|사진 변경/.test(informationSpeech))
    await stop(page)
    const field = await page.getByLabel('상품명', { exact: true }).evaluate(metrics)
    const guide = await page.locator('#details-example-note').evaluate(metrics)
    const photoChange = await page.getByRole('button', { name: '사진 바꾸기', exact: true }).evaluate(metrics)
    assert.equal(parseFloat(field.font), mode === 'easy' ? 22 : 18)
    assert.equal(parseFloat(guide.font), mode === 'easy' ? 18 : 16)
    assert.ok(field.family.includes('Noto Sans KR') && field.family.includes('Apple SD Gothic Neo'))
    assert.ok(photoChange.height >= 44)
    if (layout.width === 390 && layout.height === 844 && mode === 'easy') await capture(page, 'expert-input-390.png', true)
    await result(page)
    const media = {}
    for (const [kind, label] of [['poster', '이미지'], ['video', '영상']]) {
      await page.getByRole('tab', { name: label, exact: true }).click()
      const control = page.locator('#result-' + kind + ' .result-preview-action')
      media[kind] = { ...await control.evaluate(metrics), visibility: await completeControl(page, control) }
      assert.ok(media[kind].width >= 120)
      assert.ok(media[kind].height >= 48)
      if (layout.height < 600 && mode === 'easy') await capture(page, `expert-${kind}-${layout.width}x${layout.height}.png`)
    }
    await page.getByRole('tab', { name: '이미지', exact: true }).click()
    const description = await page.locator('#poster-visible-text').innerText()
    assert.ok(description.includes('데일리 샴푸'))
    await page.getByRole('button', { name: '크게 보기', exact: true }).click(); await settle(page)
    await page.locator('#result-poster-preview').evaluate(el => { el.scrollLeft = el.scrollWidth; el.scrollTop = el.scrollHeight })
    const corner = await page.locator('#result-poster-preview').evaluate(el => {
      const img = el.querySelector('img').getBoundingClientRect(), frame = el.getBoundingClientRect(), control = el.closest('.result-card').querySelector('.result-preview-action').getBoundingClientRect()
      return { imageRight: img.right, imageBottom: img.bottom, frameRight: frame.right, frameBottom: frame.bottom, frameTop: frame.top, controlBottom: control.bottom }
    })
    assert.ok(corner.imageRight <= corner.frameRight + 1 && corner.imageBottom <= corner.frameBottom + 1 && corner.controlBottom <= corner.frameTop + 1, 'Expanded image corner is obscured: ' + JSON.stringify(corner))
    await page.getByRole('button', { name: '작게 보기', exact: true }).click()
    await page.getByRole('tab', { name: '문구', exact: true }).click()
    const utterance = await speak(page)
    assert.equal(utterance, '홍보 문구 결과입니다. ' + await page.getByRole('region', { name: '홍보 문구 원문' }).innerText())
    const cancels = await page.evaluate(() => window.expertSpeech.cancels)
    await page.getByRole('tab', { name: '이미지', exact: true }).click()
    assert.ok(await page.evaluate(n => !speechSynthesis.speaking && window.expertSpeech.cancels > n, cancels))
    assert.equal(await page.getByRole('button', { name: '읽어주기', exact: true }).getAttribute('aria-pressed'), 'false')
    assert.equal(await speak(page), '이미지 결과입니다. ' + await page.locator('#poster-visible-text').innerText())
    await stop(page)
    const retention = await page.locator('.result-retention-note').innerText()
    assert.ok(retention.includes('저장') && retention.includes('복사'))
    assert.equal(await page.locator('.result-retention-note').count(), 1)
    let jobs
    if (layout.width === 390 && layout.height === 844 && mode === 'easy') {
      await page.evaluate(() => speechSynthesis.getVoices = () => [])
      const count = await page.evaluate(() => window.expertSpeech.texts.length)
      await page.getByRole('button', { name: '읽어주기', exact: true }).click()
      await page.getByRole('tab', { name: '문구', exact: true }).click()
      await page.waitForTimeout(1700)
      assert.equal(await page.evaluate(() => window.expertSpeech.texts.length), count, 'Cancelled pending speech started on another tab')
      await page.evaluate(() => speechSynthesis.getVoices = () => [{ lang: 'ko-KR', name: 'QA Korean voice' }])
      jobs = await lifecycle(page, downloads)
      await page.getByRole('button', { name: '내용 다시 수정하기', exact: true }).click()
      await page.getByLabel('상품명', { exact: true }).fill('우리동네정성가득한샴푸와향기로운생활제품'.repeat(3).slice(0, 60))
      await page.getByLabel('소개', { exact: true }).fill('정성으로 만드는 제품 소개입니다. '.repeat(20))
      await result(page)
      await page.getByRole('tab', { name: '이미지', exact: true }).click()
      assert.ok((await page.locator('#poster-visible-text').innerText()).includes('…'), 'Long poster alternative should reflect rendered truncation')
      await page.getByRole('button', { name: '크게 보기', exact: true }).click(); await settle(page)
      await page.locator('#result-poster-preview').evaluate(el => { el.scrollLeft = el.scrollWidth; el.scrollTop = el.scrollHeight })
      await capture(page, 'expert-poster-expanded-corner.png')
      await page.getByRole('button', { name: '작게 보기', exact: true }).click()
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.equal(await page.locator('.media-full-copy,.result-publishing-help').count(), 0)
    assert.deepEqual(errors, [])
    reports.push({ ...layout, mode, status: 'passed', field, guide, photoChange, media, corner, speechMocked: true, qaFontInjected: !!process.env.UI_TEST_FONT_ROOT, jobs })
    console.log(`PASS expert regressions ${layout.width}×${layout.height} ${mode}`)
    await page.close()
  }
  await writeFile(join(output, 'expert-verification.json'), JSON.stringify(reports, null, 2))
  console.log(`PASS: ${reports.length} layouts, control visibility and content separation, typography, expanded corners, speech context and export lifecycle.`)
} finally { await browser.close() }
