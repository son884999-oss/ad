import { chromium } from 'playwright'
import { mkdir,writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
const output=process.env.FEEDBACK_REVIEW_OUTPUT
if(!output) throw Error('FEEDBACK_REVIEW_OUTPUT is required')
await mkdir(output,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const results=[]
async function capture(page,name,width){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(output,`${name}-${width}.png`)})}
try {
  for(const width of [390,1440]) {
    const page=await browser.newPage({viewport:{width,height:900},permissions:['clipboard-read','clipboard-write'],reducedMotion:'reduce'})
    await page.goto('http://127.0.0.1:5173/')
    await page.getByRole('button',{name:'메뉴 열기',exact:true}).click()
    await page.getByRole('dialog').getByRole('button',{name:'로그인 화면 보기',exact:true}).click()
    await capture(page,'login',width)
    assert.equal(await page.locator('form').evaluate(form=>form.checkValidity()),false)
    await page.getByRole('button',{name:'처음이신가요? 회원가입',exact:true}).click()
    await capture(page,'signup',width)
    await page.getByRole('button',{name:'이미 계정이 있나요? 로그인',exact:true}).click()
    await page.getByRole('textbox',{name:'이메일',exact:true}).fill('review@example.com')
    await page.locator('input[autocomplete="current-password"]').fill('review-only')
    assert.equal(await page.locator('form').evaluate(form=>form.checkValidity()),true)
    await page.getByRole('button',{name:'로그인',exact:true}).click()
    await page.getByRole('heading',{name:'이렇게 세 단계면 돼요',exact:true}).waitFor()
    await capture(page,'after-login',width)
    const bottomCta=await page.getByRole('button',{name:'만들러 가기',exact:true}).count()
    const nav=page.locator(width<1024?'.studio-bottom-nav':'.studio-desktop-nav')
    const bottomNavigation=width<1024 ? await nav.evaluate(el=>{scrollTo(0,document.body.scrollHeight);const r=el.getBoundingClientRect();return {position:getComputedStyle(el).position,bottom:r.bottom,height:innerHeight,names:[...el.querySelectorAll('button')].map(b=>b.textContent.trim()),active:el.querySelector('[aria-current=page]')?.textContent.trim()}}) : null
    if(bottomNavigation){assert.equal(bottomNavigation.position,'fixed');assert.ok(Math.abs(bottomNavigation.bottom-bottomNavigation.height)<1)}
    await page.evaluate(()=>scrollTo(0,0))
    await page.evaluate(()=>{
      window.__speechObserved=[]
      const speak=speechSynthesis.speak.bind(speechSynthesis)
      speechSynthesis.speak=utterance=>{
        const start=utterance.onstart,error=utterance.onerror
        utterance.onstart=event=>{window.__speechObserved.push('start');start?.call(utterance,event)}
        utterance.onerror=event=>{window.__speechObserved.push(event.error);error?.call(utterance,event)}
        window.__speechObserved.push('requested');speak(utterance)
      }
    })
    await page.getByRole('button',{name:'화면 읽어주기',exact:true}).click()
    await page.waitForFunction(()=>window.__speechObserved.includes('start'),{},{timeout:12000}).catch(()=>{})
    const speech=await page.evaluate(()=>({voices:speechSynthesis.getVoices().map(v=>({name:v.name,lang:v.lang})),events:window.__speechObserved,pressed:document.querySelector('.studio-read-button').getAttribute('aria-pressed')}))
    await page.screenshot({path:join(output,`speech-${width}.png`)})
    if(await page.locator('.studio-read-button[aria-pressed=true]').count()) await page.locator('.studio-read-button[aria-pressed=true]').click()
    await page.getByRole('button',{name:'메뉴 열기',exact:true}).click()
    await page.getByRole('dialog').getByRole('button',{name:'구독 관리',exact:true}).click()
    const plans=page.locator('main[data-app-scroll-container] button[aria-pressed]')
    await plans.nth(1).click();assert.equal(await plans.nth(1).getAttribute('aria-pressed'),'true')
    await capture(page,'single-plan',width)
    await plans.nth(0).click();assert.equal(await plans.nth(0).getAttribute('aria-pressed'),'true')
    await capture(page,'subscription-plan',width)
    const channels=[]
    for(const channel of ['파일만 저장하기','인스타그램']) {
      await nav.getByRole('button',{name:'만들기',exact:true}).click()
      await page.getByRole('dialog').getByRole('button',{name:'한 번에 완성',exact:true}).click()
      await page.locator('.destination-settings > summary').click()
      await page.getByRole('radio',{name:channel,exact:true}).check()
      await capture(page,channel==='인스타그램'?'instagram-selection':'download-selection',width)
      await page.locator('#product-photo').setInputFiles(fileURLToPath(new URL('../public/assets/samples/product-example.png',import.meta.url)))
      await page.getByRole('button',{name:'사진 확인하고 다음',exact:true}).click()
      await page.getByLabel('가게·제품 이름',{exact:true}).fill('우리동네 빵집')
      await page.getByLabel('제품 설명',{exact:true}).fill('매일 아침 직접 만든 빵을 판매해요.')
      await page.getByLabel('강조할 특징',{exact:true}).fill('신선한 재료와 따뜻한 분위기')
      await page.getByRole('button',{name:'이 내용으로 결과 보기',exact:true}).click()
      await page.getByRole('tab',{name:'이미지',exact:true}).click()
      await page.locator('#result-poster img[src^="blob:"]').waitFor()
      const pngHash=await page.locator('#result-poster img').evaluate(async img=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch(img.src)).arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join(''))
      await capture(page,channel==='인스타그램'?'instagram-image':'download-image',width)
      await page.getByRole('tab',{name:'영상',exact:true}).click()
      await capture(page,channel==='인스타그램'?'instagram-video':'download-video',width)
      await page.getByRole('tab',{name:'문구',exact:true}).click()
      const copy=await page.getByLabel('홍보 문구 원문',{exact:true}).inputValue()
      await capture(page,channel==='인스타그램'?'instagram-copy':'download-copy',width)
      channels.push({channel,copy,pngHash})
    }
    assert.notEqual(channels[0].copy,channels[1].copy)
    assert.notEqual(channels[0].pngHash,channels[1].pngHash)
    results.push({width,bottomCta,bottomNavigation,login:'prototype-only',plans:'selection-without-price-or-payment',speech,channels})
    await page.close()
  }
  await writeFile(join(output,'checklist-evidence.json'),JSON.stringify(results,null,2))
  console.log(JSON.stringify(results.map(r=>({width:r.width,bottomCta:r.bottomCta,bottomNavigation:r.bottomNavigation,speechEvents:r.speech.events,voiceCount:r.speech.voices.length,channels:r.channels.map(c=>c.channel)})),null,2))
} finally {await browser.close()}
