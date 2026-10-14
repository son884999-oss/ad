import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const output = process.env.USABILITY_REVIEW_OUTPUT || fileURLToPath(new URL('../ui-review/integrated-usability/', import.meta.url))
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5173/'
const photo = fileURLToPath(new URL('../public/assets/samples/product-example.png', import.meta.url))
const name = '데일리 샴푸'
const layouts = [320, 375, 390, 430, 768, 1024, 1440].map(width => ({ width, height: 844 }))
layouts.push({ width: 320, height: 568 }, { width: 390, height: 450 }, { width: 844, height: 390 })
const selectedLayouts = process.env.UI_LAYOUT_FILTER ? layouts.filter(layout => `${layout.width}x${layout.height}` === process.env.UI_LAYOUT_FILTER) : layouts
const modes = process.env.UI_MODE_FILTER ? [process.env.UI_MODE_FILTER] : ['easy', 'regular']
await mkdir(output, { recursive: true })
for (let attempt = 0; attempt < 50; attempt++) {
  try { await fetch(base); break } catch {
    if (attempt === 49) throw new Error('Preview server unavailable: ' + base)
    await new Promise(resolve => setTimeout(resolve, 200))
  }
}
const browser = await chromium.launch({ headless: true, ...(process.env.UI_BROWSER_EXECUTABLE
  ? { executablePath: process.env.UI_BROWSER_EXECUTABLE, args: ['--no-sandbox', '--no-zygote', '--disable-dev-shm-usage'] }
  : process.env.UI_BROWSER_CHANNEL ? { channel: process.env.UI_BROWSER_CHANNEL } : {}) })
const reports = []
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
const bottom = page => page.locator('.studio-bottom-nav:not(.studio-menu-bottom-nav)')
async function visibleTarget(target, label) {
  const box = await target.evaluate(el => {
    const r = el.getBoundingClientRect()
    const menu = el.closest('.studio-menu-panel')
    const nav = (menu || document).querySelector('.studio-bottom-nav')?.getBoundingClientRect()
    const reading = menu ? null : document.querySelector('.studio-reading-bar')?.getBoundingClientRect()
    const point = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return { top: r.top, bottom: r.bottom, width: r.width, height: r.height,
      topBoundary: reading?.bottom || 0, bottomBoundary: nav?.top ?? innerHeight,
      hit: !!point && el.contains(point) }
  })
  assert.ok(box.hit, label + ': target is covered')
  assert.ok(box.top >= box.topBoundary - 1 && box.bottom <= box.bottomBoundary + 1, label + ': target is partially obscured ' + JSON.stringify(box))
  assert.ok(box.width >= 44 && box.height >= 44, label + ': target is too small')
  return box
}
async function capture(page, filename) {
  await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0) })
  await settle(page)
  await page.screenshot({ path: join(output, filename) })
}
async function chooser(page, trigger, id) {
  const opened = page.waitForEvent('filechooser')
  await trigger()
  const file = await opened
  assert.equal(await file.element().getAttribute('id'), id)
  return file
}
async function font(page) {
  const root = process.env.UI_TEST_FONT_ROOT
  if (!root) return
  await page.route('**/test-fonts/*', route => route.fulfill({ path: join(root, 'files', route.request().url().split('/').pop()), contentType: 'font/woff2' }))
  const css = (await readFile(join(root, 'index.css'), 'utf8')).replaceAll('Noto Sans KR Variable', 'Noto Sans KR').replaceAll('./files/', '/test-fonts/')
  await page.addStyleTag({ content: css })
  await page.evaluate(() => document.fonts.ready)
}
try {
  for (const layout of selectedLayouts) for (const mode of modes) {
    const page = await browser.newPage({ viewport: layout, reducedMotion: 'reduce' })
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.goto(base); await font(page)
    const captureMobile = layout.width === 390 && layout.height === 844 && mode === 'easy'
    if (captureMobile) await capture(page, 'after-home.png')

    // A menu keeps the same four destinations fixed during scrolling and keyboard focus.
    await page.getByRole('button', { name: '상단 전체 메뉴 열기', exact: true }).click()
    const menu = page.getByRole('dialog', { name: '전체 메뉴' })
    const menuNav = menu.locator('.studio-menu-bottom-nav')
    const navTop = (await menuNav.boundingBox()).y
    await menu.evaluate(el => el.scrollTop = el.scrollHeight)
    await settle(page)
    assert.ok(Math.abs((await menuNav.boundingBox()).y - navTop) < 1, 'Menu navigation moved while scrolling')
    assert.equal(await page.locator('.studio-main').getAttribute('inert'), '')
    const toggle = menu.getByRole('switch', { name: '간편모드', exact: true })
    await toggle.focus(); await settle(page)
    const menuTarget = await visibleTarget(toggle, 'Focused menu setting')
    const enabled = await toggle.getAttribute('aria-checked') === 'true'
    if (enabled !== (mode === 'easy')) await toggle.click()
    assert.equal(await toggle.getAttribute('aria-checked'), String(mode === 'easy'))
    // Exercise a real pointer toggle and restore; keyboard-only success is insufficient.
    await toggle.click(); await toggle.click(); await settle(page)
    if (layout.width === 320 && layout.height === 844 && mode === 'easy') await page.screenshot({ path: join(output, 'after-menu-320.png') })
    await menuNav.getByRole('button', { name: '전체 메뉴 닫기', exact: true }).click()
    assert.equal(await menu.count(), 0)

    await page.getByRole('button', { name: '홍보물 만들기', exact: true }).click()
    if (captureMobile) await capture(page, 'after-photo.png')
    const cameraPicker = await chooser(page, () => page.getByRole('button', { name: '사진 선택창 열기', exact: true }).click(), 'product-photo')
    await cameraPicker.setFiles([])
    const picked = await chooser(page, () => page.locator('.photo-upload-text-button').click(), 'product-photo')
    await picked.setFiles(photo)
    await page.locator('.photo-step.is-ready').waitFor()
    const selectedChange = page.getByRole('button', { name: '사진 바꾸기', exact: true })
    await selectedChange.focus(); await settle(page)
    await visibleTarget(selectedChange, 'Photo-step replacement')
    const replacePicker = await chooser(page, () => selectedChange.press('Enter'), 'product-photo')
    await replacePicker.setFiles([])
    const changeStyle = await selectedChange.evaluate(el => ({ font: getComputedStyle(el).fontSize, padding: getComputedStyle(el).padding, radius: getComputedStyle(el).borderRadius }))
    await page.getByRole('button', { name: '다음으로', exact: true }).click()
    const product = page.getByLabel('상품명', { exact: true })
    const intro = page.getByLabel('소개', { exact: true })
    const features = page.getByLabel('알리고 싶은 점', { exact: true })
    assert.equal(await product.getAttribute('aria-invalid'), null, 'A pristine field is announced as an error')
    assert.equal(await product.getAttribute('aria-required'), 'true')
    for (const field of [intro, features]) {
      assert.equal(await field.getAttribute('aria-required'), 'false')
      assert.equal(await field.inputValue(), '')
      assert.equal(await field.evaluate(el => el.required), false)
      assert.ok(!/선택|필수/.test(await field.locator('..').innerText()))
    }
    await product.fill('   ')
    assert.equal(await page.getByRole('button', { name: '결과 보기', exact: true }).isDisabled(), true)
    await product.fill(name)
    assert.equal(await page.getByRole('button', { name: '결과 보기', exact: true }).isEnabled(), true)
    const inputChange = page.getByRole('button', { name: '사진 바꾸기', exact: true })
    await inputChange.focus(); await settle(page)
    await visibleTarget(inputChange, 'Information-step replacement')
    const inputStyle = await inputChange.evaluate(el => ({ font: getComputedStyle(el).fontSize, padding: getComputedStyle(el).padding, radius: getComputedStyle(el).borderRadius }))
    assert.deepEqual(inputStyle, changeStyle, 'Same photo action has inconsistent styling')
    const informationPicker = await chooser(page, () => inputChange.press('Space'), 'details-photo')
    await informationPicker.setFiles([])
    const original = await page.locator('.information-photo img').getAttribute('src')
    if (captureMobile) {
      await page.getByLabel('정보 입력에서 사진 바꾸기').setInputFiles({ name: 'wrong.txt', mimeType: 'text/plain', buffer: Buffer.from('wrong file') })
      await page.getByText(/기존 사진은 그대로예요/).waitFor()
      assert.equal(await page.locator('.information-photo img').getAttribute('src'), original)
      assert.equal(await product.inputValue(), name)
      await page.getByLabel('정보 입력에서 사진 바꾸기').setInputFiles(photo)
      await page.getByText('사진이 준비됐어요.', { exact: true }).waitFor()
    }
    for (const field of [product, intro, features, page.getByRole('button', { name: '결과 보기', exact: true })]) {
      await field.focus(); await settle(page); await visibleTarget(field, 'Information focus')
    }
    if (captureMobile || (layout.width === 1440 && mode === 'easy')) await capture(page, captureMobile ? 'after-input.png' : 'after-input-desktop.png')

    await intro.fill('매일 쓰는 순한 샴푸 소개')
    await features.fill('순한 사용감')
    await bottom(page).getByRole('button', { name: '만들기', exact: true }).click()
    assert.equal(await product.inputValue(), name, 'Active create tab erased the draft')
    assert.equal(await intro.inputValue(), '매일 쓰는 순한 샴푸 소개')
    await bottom(page).getByRole('button', { name: '홈', exact: true }).click()
    await page.getByRole('button', { name: '홍보물 이어 만들기', exact: true }).click()
    assert.equal(await product.inputValue(), name, 'Home resume erased the draft')
    assert.equal(await page.locator('.information-photo img').getAttribute('src'), original)
    await intro.fill(''); await features.fill('')
    await page.getByRole('button', { name: '결과 보기', exact: true }).click()
    await page.locator('#result-poster-preview img').waitFor()
    const resultTabs = ['이미지', '영상', '문구']
    for (const label of resultTabs) await page.getByRole('tab', { name: label, exact: true }).click()
    const text = await page.getByRole('region', { name: '홍보 문구 원문', exact: true }).innerText()
    assert.ok(text.includes(name))
    const visibleCopy = await page.locator('.results-step').innerText()
    for (const deleted of ['사진 움직임 미리보기예요. 저장 파일에는 홍보 문구도 들어가요.', '문구와 검색어를 함께 복사해요.', '기본 홍보 문구']) assert.ok(!visibleCopy.includes(deleted))
    assert.equal(await page.locator('.media-full-copy,.result-publishing-help').count(), 0)
    if (captureMobile) {
      // Verify the visible motion itself pauses; a changed label alone does not prove playback.
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.getByRole('tab', { name: '영상', exact: true }).click()
      const motion = page.locator('.result-motion-preview img')
      const scale = () => motion.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)
      const still = await scale()
      await page.getByRole('button', { name: '재생하기', exact: true }).click()
      await page.waitForTimeout(700)
      assert.ok(Math.abs(await scale() - still) > .001, 'Playback did not move the photo')
      await page.getByRole('button', { name: '일시 정지', exact: true }).click()
      await settle(page)
      const paused = await scale()
      await page.waitForTimeout(400)
      assert.ok(Math.abs(await scale() - paused) < .0001, 'Photo moved after pause')
      await page.getByRole('button', { name: '재생하기', exact: true }).click()
      await page.waitForTimeout(400)
      assert.ok(Math.abs(await scale() - paused) > .001, 'Playback did not resume')
      await page.getByRole('tab', { name: '문구', exact: true }).click()
      assert.equal(await motion.evaluate(el => getComputedStyle(el).animationPlayState), 'paused')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.getByRole('tab', { name: '영상', exact: true }).click()
      assert.equal(await motion.evaluate(el => getComputedStyle(el).animationName), 'none')
      for (const [kind, label] of [['poster', '이미지'], ['video', '영상'], ['copy', '문구']]) {
        await page.getByRole('tab', { name: label, exact: true }).click()
        await capture(page, 'after-result-' + kind + '.png')
      }
    }
    await bottom(page).getByRole('button', { name: '만들기', exact: true }).click()
    assert.equal(await page.getByRole('tablist').count(), 1, 'Create destination reset a completed result')
    await bottom(page).getByRole('button', { name: '내 홍보물', exact: true }).click()
    await page.getByRole('button', { name: '문구', exact: true }).click()
    assert.equal(await page.locator('.record-item').count(), 1)
    await page.locator('.record-item').click()
    assert.equal(await page.getByRole('tab', { name: '문구', exact: true }).getAttribute('aria-selected'), 'true')
    assert.equal(await page.getByRole('region', { name: '홍보 문구 원문', exact: true }).innerText(), text)
    await page.getByRole('button', { name: '내용 다시 수정하기', exact: true }).click()
    assert.equal(await product.inputValue(), name)

    // Explicitly switching output kinds retains the photo and text for review.
    for (const [choice, tab] of [['문구 만들기', '문구'], ['영상 만들기', '영상'], ['이미지 만들기', '이미지']]) {
      await page.getByRole('button', { name: '상단 전체 메뉴 열기', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: choice, exact: true }).click()
      assert.equal(await page.getByText('진행하던 작업을 이어서 사용해요.', { exact: true }).count(), 1)
      assert.equal(await page.getByRole('img', { name: '넣은 제품 사진 미리보기', exact: true }).count(), 1, 'Creation re-entry must preserve the actual photo')
      assert.equal(await page.locator('.selected-photo').getAttribute('src'), original)
      await page.getByRole('button', { name: '다음으로', exact: true }).click()
      assert.equal(await product.inputValue(), name)
      await page.getByRole('button', { name: '결과 보기', exact: true }).click()
      assert.equal(await page.getByRole('tab').count(), 1)
      assert.equal(await page.getByRole('tab', { name: tab, exact: true }).getAttribute('aria-selected'), 'true')
    }
    await page.getByRole('button', { name: '새 홍보물 만들기', exact: true }).click()
    assert.equal(await page.locator('.photo-step:not(.is-ready)').count(), 1, 'Explicit new action did not clear the draft')
    await page.getByLabel('제품 사진 올리기', { exact: true }).setInputFiles(photo)
    await page.getByRole('button', { name: '다음으로', exact: true }).click()
    assert.equal(await product.inputValue(), '')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.deepEqual(errors, [])
    reports.push({ ...layout, mode, status: 'passed', menuTarget, scenarios: ['fixed menu', 'photo picker', 'keyboard replacement', 'required/optional', 'focus visibility', 'draft resume', 'minimal input', 'result tabs', 'records reopen', 'individual outputs', 'explicit new'] })
    console.log(`PASS ${layout.width}×${layout.height} ${mode}`)
    await page.close()
  }
  await writeFile(join(output, 'integration.json'), JSON.stringify(reports, null, 2))
  console.log(`PASS: ${reports.length} layouts; end-to-end tasks, consistent controls, focus and safe resume.`)
} finally { await browser.close() }
