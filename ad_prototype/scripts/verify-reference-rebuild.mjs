import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
// Plan C: 다음으로 on the photo step asks "배경을 광고 사진처럼 바꿀까요?"; these checks keep the photo. Registered
// once per page after the first photo: whenever the popup shows, 그대로 쓰기 is pressed before the next action.
const keptPages = new WeakSet()
const keepPhoto = async (page) => {
  if (keptPages.has(page)) return
  keptPages.add(page)
  await page.addLocatorHandler(page.getByRole("dialog", { name: /배경을 광고 사진처럼/ }), async (dialog) => {
    await dialog.getByRole("button", { name: /그대로/ }).click()
  })
}

const out=process.env.REFERENCE_REBUILD_OUTPUT
if(!out)throw new Error('REFERENCE_REBUILD_OUTPUT required')
await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const reports=[]
async function capture(page,name,width,selectors){
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r})));document.getAnimations().forEach(a=>a.finish())})
 const geometry=await page.evaluate(selectors=>{const navEl=document.querySelector('.studio-bottom-nav'),nav=navEl.getBoundingClientRect();const main=document.querySelector('.studio-main');return {navTop:navEl.classList.contains('is-top')?innerHeight:nav.top,mainScroll:main.scrollHeight-main.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth,targets:selectors.map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect();return {selector,top:r.top,bottom:r.bottom}})}},selectors)
 assert.equal(geometry.overflow,false)
 for(const t of geometry.targets)assert.ok(t.bottom<=geometry.navTop+2,`${name} ${width}: ${t.selector} is covered by bottom nav (${t.bottom}>${geometry.navTop})`)
 await page.screenshot({path:join(out,`${name}-${width}.png`)})
 reports.push({name,width,...geometry})
}
try{
for(const [width,height] of [[320,640],[360,740],[390,844],[430,932],[768,1024],[1024,844],[1440,900]]){
 const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']})
 // Keep this layout check deterministic and off the free AI quota: answer /api/* as if no key is set.
 if(!process.env.REFERENCE_REBUILD_ALLOW_AI)await page.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"AI_NOT_CONFIGURED"}'}))
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:5173/')
 await capture(page,'home',width,['.reference-home-create','.reference-home-steps'])
 await page.getByRole('button',{name:'전체 메뉴 열기',exact:true}).click()
 await capture(page,'menu',width,['.menu-creation-options','.reference-menu-links'])
 await page.getByRole('button',{name:'메뉴 닫기',exact:true}).click()
 await page.getByRole('button',{name:'홍보물 만들기',exact:true}).click()
 assert.equal(await page.getByRole('dialog').count(),0)
 await capture(page,'photo',width,['.reference-upload-box','.reference-photo-examples'])
 await page.locator('#product-photo').setInputFiles(resolve('public/assets/reference-fresh/coffee.webp'))
 await page.getByRole('button',{name:'다음으로',exact:true}).click()
 await page.getByRole('dialog').getByRole('button',{name:/그대로/}).click()
 await page.getByLabel('가게 이름',{exact:true}).fill('행복한 카페')
 await page.getByLabel('제품 이름',{exact:true}).fill('수제 크림과 커피')
 if(!(await page.locator('.details-more').getAttribute('open')))await page.locator('.details-more > summary').click();await page.getByLabel('어떤 점을 알려주고 싶나요?',{exact:true}).fill('신선한 재료, 직접 만든 디저트, 아늑한 분위기')
 await page.getByLabel('제품 이름',{exact:true}).blur()
 if(await page.locator('.details-more').getAttribute('open')!==null)await page.locator('.details-more > summary').click()
 await capture(page,'information',width,['.information-photo','.details-actions'])
 await page.getByRole('button',{name:'홍보물 만들기',exact:true}).click()
 await page.locator('#result-poster-preview img').waitFor()
 await capture(page,'result',width,['.result-action-buttons','.result-followup-actions'])
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'이미지 다운로드',exact:true}).click();const download=await downloadEvent;assert.match(download.suggestedFilename(),/\.png$/)
 await page.getByRole('tab',{name:'홍보 글',exact:true}).click()
 await page.getByRole('button',{name:'홍보 글 복사하기',exact:true}).click()
 assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).includes('수제 크림과 커피'))
 await page.getByRole('button',{name:'홈으로',exact:true}).click()
 assert.equal(await page.getByRole('button',{name:'홍보물 이어 만들기',exact:true}).count(),0)
 await page.getByRole('button',{name:'홍보물 만들기',exact:true}).click()
 assert.ok(await page.getByRole('button',{name:'사진 선택하기',exact:true}).isVisible())
 await page.locator('#product-photo').setInputFiles(resolve('public/assets/reference-fresh/cake.webp'))
 await page.getByRole('button',{name:'다음으로',exact:true}).click()
 await page.getByRole('dialog').getByRole('button',{name:/그대로/}).click()
 assert.equal(await page.getByLabel('가게 이름',{exact:true}).inputValue(),'')
 assert.equal(await page.getByLabel('제품 이름',{exact:true}).inputValue(),'')
 assert.ok(await page.getByRole('button',{name:'홍보물 만들기',exact:true}).isDisabled())
 assert.deepEqual(errors,[])
 await page.close()
 console.log('PASS',width,height)
}
await writeFile(join(out,'verified.json'),JSON.stringify(reports,null,2))
console.log('PASS: 35 screens, 7 viewports; no nav overlap; new creation resets; PNG export and clipboard')
}finally{await browser.close()}