import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
const output = process.env.FEEDBACK_REVIEW_OUTPUT
if (!output) throw Error('FEEDBACK_REVIEW_OUTPUT is required')
await mkdir(output,{recursive:true})
const browser = await chromium.launch({channel:'msedge',headless:true})
const findings=[]
async function inspect(page,name,width) {
  await page.evaluate(()=>scrollTo(0,0))
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(img=>img.getBoundingClientRect().height>0 && img.getBoundingClientRect().top<innerHeight).map(img=>img.decode().catch(()=>{})))})
  await page.mouse.move(0,0)
  await page.screenshot({path:join(output,`${name}-${width}.png`),fullPage:true})
  const data=await page.evaluate(()=>{
    const visible=el=>el.checkVisibility() && !el.closest('[inert]')
    const controls=[...document.querySelectorAll('button,summary,input:not([type=file]),textarea,select')].filter(visible)
    const target=el=>el.matches('input[type=radio],input[type=checkbox]') ? el.closest('label') ?? el : el
    const luminance=c=>{const a=c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return a[0]*.2126+a[1]*.7152+a[2]*.0722}
    const rgb=value=>value.match(/[\d.]+/g)?.map(Number)
    const contrast=[]
    for(const el of document.querySelectorAll('main *,aside *,header *,nav *, .studio-reading-bar *')) {
      if(!visible(el) || ![...el.childNodes].some(n=>n.nodeType===3 && n.textContent.trim()) || el.closest(':disabled')) continue
      const style=getComputedStyle(el),fg=rgb(style.color)
      let bg=[255,255,255],ancestor=el,skip=false
      while(ancestor) {const s=getComputedStyle(ancestor);if(s.backgroundImage!=='none' || Number(s.opacity)<1){skip=true;break}const c=rgb(s.backgroundColor);if(c && (c[3]??1)===1){bg=c;break}if(c && c[3]>0){skip=true;break}ancestor=ancestor.parentElement}
      if(skip || !fg) continue
      const l=[luminance(fg),luminance(bg)].sort((a,b)=>b-a),ratio=(l[0]+.05)/(l[1]+.05)
      const large=parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.66 && Number(style.fontWeight)>=700)
      if(ratio<(large?3:4.5)) contrast.push({text:el.textContent.trim().slice(0,60),class:el.className,foreground:style.color,background:bg,ratio:Math.round(ratio*100)/100})
    }
    return {overflow:document.documentElement.scrollWidth>innerWidth, contrast, smallControls:controls.filter(el=>{const r=target(el).getBoundingClientRect();return r.height<44 || r.width<44}).map(el=>({text:el.textContent?.trim().slice(0,70),class:el.className,height:target(el).getBoundingClientRect().height,width:target(el).getBoundingClientRect().width})), brokenImages:[...document.images].filter(img=>visible(img) && img.complete && !img.naturalWidth).map(img=>img.getAttribute('src'))}
  })
  findings.push({name,width,...data})
}
try {
  for (const width of [320,375,390,430,768,1024,1440]) {
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'})
    await page.goto('http://127.0.0.1:5173/')
    await inspect(page,'home-full',width)
    await page.getByRole('button',{name:'메뉴 열기',exact:true}).click()
    await inspect(page,'menu-full',width)
    await page.getByRole('dialog').getByRole('button',{name:'구독 관리',exact:true}).click()
    await inspect(page,'plan-full',width)
    const nav=page.locator(width<1024?'.studio-bottom-nav':'.studio-desktop-nav')
    await nav.getByRole('button',{name:'내 홍보물',exact:true}).click()
    await inspect(page,'empty-records',width)
    await nav.getByRole('button',{name:'만들기',exact:true}).click()
    await page.getByRole('dialog').getByRole('button',{name:'한 번에 완성',exact:true}).click()
    await inspect(page,'photo-full',width)
    await page.getByLabel('제품 사진 올리기',{exact:true}).focus()
    const focus=await page.locator('.upload-target strong').evaluate(el=>getComputedStyle(el).outlineWidth)
    if (focus !== '3px') throw Error('File selection keyboard focus is not visible')
    await page.screenshot({path:join(output,`photo-keyboard-${width}.png`)})
    await page.locator('.photo-format-settings > summary').click()
    await inspect(page,'photo-settings',width)
    await page.locator('.photo-format-settings > summary').click()
    await page.locator('.destination-settings > summary').click()
    await page.locator('.destination-settings > summary').getByText('접기',{exact:true}).waitFor()
    await inspect(page,'platform-selection',width)
    await page.getByRole('radio',{name:'인스타그램',exact:true}).check()
    await page.getByRole('radio',{name:'파일만 저장하기',exact:true}).check()
    await page.locator('.destination-settings > summary').click()
    await page.locator('.destination-settings > summary').getByText('펼치기',{exact:true}).waitFor()
    await page.getByLabel('제품 사진 올리기',{exact:true}).setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')})
    await page.getByText('사진 파일을 선택해 주세요.',{exact:true}).waitFor()
    await inspect(page,'upload-error',width)
    assert.equal(await page.getByRole('button',{name:'사진 확인하고 다음',exact:true}).isDisabled(),true)
    assert.equal(await page.locator('#upload-feedback').getAttribute('aria-atomic'),'true')
    await page.evaluate(()=>{
      const read=FileReader.prototype.readAsDataURL
      window.__holdFileRead=true
      FileReader.prototype.readAsDataURL=function(file){if(window.__holdFileRead) window.__releaseFileRead=()=>{window.__holdFileRead=false;read.call(this,file)};else read.call(this,file)}
    })
    await page.getByLabel('제품 사진 올리기',{exact:true}).setInputFiles(fileURLToPath(new URL('../public/assets/samples/product-example.png',import.meta.url)))
    await page.getByText('사진을 확인하고 있어요.',{exact:true}).waitFor()
    assert.equal(await page.locator('.photo-upload').getAttribute('aria-busy'),'true')
    assert.equal(await page.locator('.activity-dot').evaluate(el=>getComputedStyle(el).animationName),'none')
    await inspect(page,'upload-loading',width)
    await page.evaluate(()=>window.__releaseFileRead())
    await page.getByRole('button',{name:'사진 확인하고 다음',exact:true}).click()
    for(const label of ['제품 설명','강조할 특징']) assert.equal(await page.getByLabel(label,{exact:true}).getAttribute('aria-required'),'true')
    await page.getByLabel('제품 설명',{exact:true}).fill('')
    assert.equal(await page.getByRole('button',{name:'이 내용으로 결과 보기',exact:true}).isDisabled(),true)
    await inspect(page,'information-error',width)
    await page.getByLabel('가게·제품 이름',{exact:true}).fill('행복한 카페')
    await page.getByLabel('제품 설명',{exact:true}).fill('매일 아침 직접 구운 빵과 신선한 커피를 판매합니다.')
    await page.getByLabel('강조할 특징',{exact:true}).fill('동네에서 편안하게 쉬어갈 수 있는 따뜻한 공간입니다.')
    await page.evaluate(()=>scrollTo(0,0))
    await inspect(page,'information',width)
    await page.getByRole('button',{name:'이 내용으로 결과 보기',exact:true}).click()
    await page.locator('#result-poster img[src^="blob:"]').waitFor()
    for(const [tab,name] of [['이미지','result-image'],['영상','result-video'],['문구','result-copy']]) {
      await page.getByRole('tab',{name:tab,exact:true}).click()
      await page.evaluate(()=>scrollTo(0,0))
      await inspect(page,name,width)
      if(tab==='영상' && width===390) {
        await page.getByRole('button',{name:'영상 저장하기',exact:true}).click()
        await page.getByRole('button',{name:'영상 준비 취소',exact:true}).waitFor()
        await page.screenshot({path:join(output,'video-loading-390.png')})
        await page.getByRole('button',{name:'영상 준비 취소',exact:true}).click()
        await page.getByRole('button',{name:'영상 저장하기',exact:true}).waitFor()
      }
    }
    await page.getByRole('button',{name:width<1024?'전체 메뉴 열기':'메뉴 열기',exact:true}).click()
    await page.getByRole('dialog').getByRole('button',{name:'로그인 화면 보기',exact:true}).click()
    await inspect(page,'login',width)
    const placeholder=await page.locator('input[placeholder]').first().evaluate(el=>({color:getComputedStyle(el,'::placeholder').color,opacity:getComputedStyle(el,'::placeholder').opacity}))
    assert.equal(placeholder.color,'rgb(98, 94, 89)')
    assert.equal(placeholder.opacity,'1')
    await page.close()
  }
  await writeFile(join(output,'inspection.json'),JSON.stringify(findings,null,2))
  assert.ok(findings.every(row=>!row.overflow && !row.smallControls.length && !row.brokenImages.length && !row.contrast.length), 'Review inspection.json for unresolved findings')
  console.log(JSON.stringify(findings,null,2))
} finally {await browser.close()}
