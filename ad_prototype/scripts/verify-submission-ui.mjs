import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5173/'
const output = process.env.SUBMISSION_REVIEW_OUTPUT || fileURLToPath(new URL('../ui-review/submission/', import.meta.url))
const photo = fileURLToPath(new URL('../public/assets/samples/product-example.png', import.meta.url))
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, ...(process.env.UI_BROWSER_EXECUTABLE ? {
  executablePath: process.env.UI_BROWSER_EXECUTABLE, args: ['--no-sandbox', '--no-zygote', '--disable-dev-shm-usage'],
} : {}) })
const reports = []
const intro = '매일 사용하는 샴푸입니다. 초록색 펌프 용기로 편리하게 사용할 수 있어요.'
const features = '제품 사진과 설명을 함께 확인해 주세요.'
const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
const fieldMetrics = el => ({ height: el.clientHeight, content: el.scrollHeight, top: el.scrollTop })
async function capture(page, name) {
  await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0) })
  await settle(page)
  await page.screenshot({ path: join(output, name + '.png') })
}
try {
  for (const [width, height] of [[320, 568], [360, 640], [390, 693], [390, 844], [844, 390], [1440, 844]]) for (const mode of ['easy', 'regular']) {
    const page = await browser.newPage({ viewport: { width, height }, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base)
    if (process.env.UI_TEST_FONT_ROOT) {
      const root = process.env.UI_TEST_FONT_ROOT
      await page.route('**/test-fonts/*', r => r.fulfill({ path: join(root, 'files', r.request().url().split('/').pop()), contentType: 'font/woff2' }))
      await page.addStyleTag({ content: (await readFile(join(root, 'index.css'), 'utf8')).replaceAll('Noto Sans KR Variable', 'Noto Sans KR').replaceAll('./files/', '/test-fonts/') })
      await page.evaluate(() => document.fonts.ready)
    }
    if (mode === 'regular') {
      await page.getByRole('button', { name: '상단 전체 메뉴 열기', exact: true }).click()
      await page.getByRole('dialog').getByRole('switch', { name: '간편모드' }).click()
      await page.keyboard.press('Escape')
    }
    await page.getByRole('button', { name: '홍보물 만들기', exact: true }).click()
    assert.equal(await page.getByRole('heading', { name: '사진을 올려 주세요', exact: true }).count(), 1)
    assert.equal(await page.getByRole('heading', { name: '가게·제품 사진을 골라 주세요', exact: true }).count(), 0)
    if (width === 320) {
      await page.evaluate(() => scrollTo(0, 0)); await settle(page)
      const button = await page.getByRole('button', { name: '제품 사진 올리기', exact: true }).boundingBox()
      const nav = await page.getByRole('navigation', { name: '모바일 빠른 메뉴', exact: true }).boundingBox()
      assert.ok(button.y + button.height <= nav.y + 1, 'Upload action should be visible on the short phone')
    }
    if (width === 390 && mode === 'easy') await capture(page, 'photo-390')
    const chooserEvent = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: mode === 'easy' ? '사진 선택창 열기' : '제품 사진 올리기', exact: true }).click()
    await (await chooserEvent).setFiles(photo)
    assert.equal(await page.getByRole('radio', { name: '둘 다', exact: true }).isChecked(), true)
    if (width <= 390) {
      await page.evaluate(() => scrollTo(0, 0)); await settle(page)
      const items = [
        page.getByRole('navigation', { name: '홍보물 만들기 진행 단계', exact: true }),
        page.getByRole('img', { name: '넣은 제품 사진 미리보기', exact: true }),
        page.getByRole('group', { name: /^만들 결과/ }),
        page.getByRole('button', { name: '다음 단계', exact: true }),
      ]
      const boxes = await Promise.all(items.map(item => item.boundingBox()))
      const nav = await page.getByRole('navigation', { name: '모바일 빠른 메뉴', exact: true }).boundingBox()
      for (let i = 0; i < boxes.length; i++) {
        assert.ok(boxes[i].y >= 0 && boxes[i].y + boxes[i].height <= nav.y - 8, 'Guide/photo/format/next must fit one screen: ' + JSON.stringify(boxes))
        if (i) assert.ok(boxes[i].y >= boxes[i - 1].y + boxes[i - 1].height)
      }
      if (height === 693 && mode === 'easy') await capture(page, 'photo-selected-390x693')
      if (width === 360 && mode === 'easy') await capture(page, 'photo-selected-360x640')
    }
    await page.getByRole('button', { name: '다음 단계', exact: true }).click()
    await page.getByLabel('상품명', { exact: true }).fill('초이셀 데일리 샴푸')
    assert.equal(await page.getByRole('button', { name: '결과 보기', exact: true }).isEnabled(), true, 'Only product name is required')
    await page.getByLabel('소개', { exact: true }).fill(intro)
    await page.getByLabel('알리고 싶은 점', { exact: true }).fill(features)
    await page.getByLabel('상품명', { exact: true }).focus(); await settle(page)
    const fields = {}
    for (const label of ['소개', '알리고 싶은 점']) {
      fields[label] = await page.getByLabel(label, { exact: true }).evaluate(fieldMetrics)
      assert.ok(fields[label].height >= fields[label].content - 1, label + ': content is clipped')
      assert.equal(fields[label].top, 0)
    }
    const secondary = el => { const s = getComputedStyle(el); return { border: s.border, color: s.color, radius: s.borderRadius } }
    assert.deepEqual(await page.getByRole('button', { name: '이전으로', exact: true }).evaluate(secondary), await page.getByRole('button', { name: '사진 바꾸기', exact: true }).evaluate(secondary))
    if ([390, 1440].includes(width) && mode === 'easy') await capture(page, 'input-' + width)
    await page.getByRole('button', { name: '결과 보기', exact: true }).click()
    await page.getByRole('img', { name: '초이셀 데일리 샴푸 홍보 이미지', exact: true }).waitFor()
    const media = {}
    for (const [kind, label] of [['poster', '이미지'], ['video', '영상']]) {
      await page.getByRole('tab', { name: label, exact: true }).click()
      const panel = page.getByRole('tabpanel', { name: label, exact: true })
      const control = panel.getByRole('button', { name: kind === 'poster' ? '크게 보기' : '재생하기', exact: true })
      media[kind] = await control.evaluate(el => {
        const r = el.getBoundingClientRect(), frame = el.closest('[role="tabpanel"]').querySelector('.result-preview').getBoundingClientRect()
        return { width: r.width, height: r.height, left: r.left, bottom: r.bottom + scrollY, frameTop: frame.top + scrollY, frameWidth: frame.width, frameHeight: frame.height }
      })
      assert.ok(media[kind].height >= 48 && media[kind].width >= 120)
      assert.ok(media[kind].bottom <= media[kind].frameTop + 1, 'Control covers result content')
      if ([390, 1440].includes(width) && mode === 'easy') await capture(page, 'result-' + kind + '-' + width)
    }
    for (const key of ['width', 'height', 'left', 'frameWidth', 'frameHeight']) assert.equal(media.poster[key], media.video[key], 'Media presentation mismatch: ' + key)
    await page.getByRole('tab', { name: '문구', exact: true }).click()
    const copy = page.getByRole('region', { name: '홍보 문구 원문', exact: true })
    const text = await copy.innerText()
    assert.ok(!/#사용하(?:\s|$)/u.test(text), 'Broken recommendation remained')
    assert.ok((await copy.evaluate(fieldMetrics)).height >= (await copy.evaluate(fieldMetrics)).content - 1, 'Copy requires a second scroll')
    await page.getByRole('button', { name: '문구 전체 복사하기', exact: true }).click()
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), text)
    if (width === 390 && mode === 'easy') await capture(page, 'result-copy-390')
    await page.getByRole('button', { name: '내용 다시 수정하기', exact: true }).click()
    assert.equal(await page.getByLabel('소개', { exact: true }).inputValue(), intro)
    await page.getByLabel('소개', { exact: true }).fill(intro.repeat(3)); await page.getByLabel('상품명', { exact: true }).focus(); await settle(page)
    const longer = await page.getByLabel('소개', { exact: true }).evaluate(fieldMetrics)
    assert.ok(longer.height >= longer.content - 1)
    await page.getByRole('button', { name: '결과 보기', exact: true }).click()
    await page.getByRole('tab', { name: '문구', exact: true }).click()
    const longCopy = await page.getByRole('region', { name: '홍보 문구 원문', exact: true }).evaluate(fieldMetrics)
    assert.ok(longCopy.height >= longCopy.content - 1)
    if (width === 390 && mode === 'easy') {
      for (const [label, action] of [['이미지', '이미지 저장하기'], ['영상', '영상 저장하기']]) {
        await page.getByRole('tab', { name: label, exact: true }).click()
        const event = page.waitForEvent('download')
        await page.getByRole('button', { name: action, exact: true }).click()
        const download = await event
        assert.equal(await download.failure(), null)
        assert.ok((await stat(await download.path())).size > 1000)
      }
    }
    if ((width === 390 && height === 693) || width === 1440) {
      for (const [choice, expected] of [['포스터', ['이미지', '문구']], ['영상', ['영상', '문구']], ['둘 다', ['이미지', '영상', '문구']]]) {
        await page.getByRole('button', { name: '내용 다시 수정하기', exact: true }).click()
        await page.getByRole('button', { name: '이전으로', exact: true }).click()
        await page.getByRole('radio', { name: choice, exact: true }).locator('..').click()
        assert.equal(await page.getByRole('radio', { name: choice, exact: true }).isChecked(), true)
        await page.getByRole('button', { name: '다음 단계', exact: true }).click()
        await page.getByRole('button', { name: '결과 보기', exact: true }).click()
        assert.deepEqual((await page.getByRole('tab').allTextContents()).map(x => x.trim()), expected)
        assert.equal((await page.getByRole('tab', { selected: true }).innerText()).trim(), expected[0], 'Media should open before copy')
        assert.equal(expected.at(-1), '문구')
        await page.getByRole('tab', { name: '문구', exact: true }).click()
      }
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.deepEqual(errors, [])
    reports.push({ width, height, mode, fields, media, longCopy, status: 'passed' })
    console.log(`PASS submission ${width}×${height} ${mode}`)
    await page.close()
  }
  await writeFile(join(output, 'verification.json'), JSON.stringify(reports, null, 2))
} finally { await browser.close() }
