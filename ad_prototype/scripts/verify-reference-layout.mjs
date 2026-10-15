import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
const out=process.env.FEEDBACK_REVIEW_OUTPUT
if(!out) throw Error('FEEDBACK_REVIEW_OUTPUT required')
await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const reports=[]
async function inspect(page,name,width){
  await page.evaluate(()=>scrollTo(0,0))
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
  await page.screenshot({path:join(out,`${name}-${width}.png`)})
  const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,expectedBottom:innerWidth>=1024?document.querySelector('.studio-shell').getBoundingClientRect().bottom:innerHeight,frame:(()=>{const r=document.querySelector('.studio-shell').getBoundingClientRect();return {width:r.width,height:r.height}})(),errors:[...document.images].filter(i=>i.checkVisibility()&&i.complete&&!i.naturalWidth).map(i=>i.src),nav:[...document.querySelectorAll('.studio-bottom-nav')].filter(n=>!n.inert&&n.checkVisibility()).map(n=>({position:getComputedStyle(n).position,bottom:n.getBoundingClientRect().bottom})),title:document.querySelector('h1')?.getBoundingClientRect().top}))
  assert.equal(state.overflow,false)
  assert.deepEqual(state.errors,[])
  for(const n of state.nav){assert.equal(n.position,'fixed');assert.ok(Math.abs(n.bottom-state.expectedBottom)<2)}
  if(width>=1024) assert.ok(Math.abs(state.frame.width/state.frame.height-9/16)<.002)
  reports.push({name,width,...state})
}
try{
for(const width of [320,375,390,430,768,1024,1440]){
 const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']})
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:5173/')
 await inspect(page,'home',width)
 await page.getByRole('button',{name:'홍보물 만들기',exact:true}).click()
 await inspect(page,'chooser',width)
 const options=page.getByRole('dialog').locator('.studio-menu-row')
 assert.equal(await options.count(),4)
 for(const option of await options.all()) assert.ok(await option.locator('small').isVisible())
 await page.getByRole('dialog').getByRole('button',{name:'한 번에 완성',exact:true}).click()
 await inspect(page,'photo',width)
 assert.ok(await page.getByRole('heading',{name:'사진 예시',exact:true}).isVisible())
 await page.locator('#product-photo').setInputFiles(fileURLToPath(new URL('../public/assets/samples/latte-product-sample.png',import.meta.url)))
 await page.getByRole('button',{name:'다음으로',exact:true}).click()
 assert.ok(await page.getByRole('button',{name:'홍보물 만들기',exact:true}).isDisabled())
 await page.getByLabel('가게 이름',{exact:true}).fill('행복한 카페')
 await page.getByLabel('제품 설명',{exact:true}).fill('직접 내린 크림 커피')
 await page.getByLabel('알리고 싶은 점',{exact:true}).fill('신선한 재료와 아늑한 분위기')
 await inspect(page,'information',width)
 await page.getByRole('button',{name:'홍보물 만들기',exact:true}).click()
 await page.locator('#result-poster-preview img').waitFor()
 for(const label of ['이미지','영상','문구']){
   await page.getByRole('tab',{name:label,exact:true}).click()
   await inspect(page,'result-'+label,width)
 }
 const text=await page.getByRole('region',{name:'홍보 문구 원문',exact:true}).innerText()
 for(const expected of ['행복한 카페','직접 내린 크림 커피','신선한 재료와 아늑한 분위기']) assert.ok(text.includes(expected))
 await page.getByRole('button',{name:'문구 전체 복사하기',exact:true}).click()
 assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n'),text)
 await page.getByRole('button',{name:'내용 다시 수정하기',exact:true}).click()
 assert.equal(await page.getByLabel('제품 설명',{exact:true}).inputValue(),'직접 내린 크림 커피')
 assert.equal(await page.getByLabel('알리고 싶은 점',{exact:true}).inputValue(),'신선한 재료와 아늑한 분위기')
 await page.getByLabel('제품 설명',{exact:true}).fill(' ')
 assert.ok(await page.getByRole('button',{name:'홍보물 만들기',exact:true}).isDisabled())
 await page.getByRole('navigation',{name:'모바일 빠른 메뉴',exact:true}).getByRole('button',{name:'내 홍보물',exact:true}).click()
 await inspect(page,'records',width)
 assert.equal(await page.locator('.record-item').count(),3)
 assert.deepEqual(errors,[])
 await page.close()
}
await writeFile(join(out,'checks.json'),JSON.stringify(reports,null,2))
console.log(`PASS ${reports.length} screens, seven widths, validation, clipboard, input retention and records`)
}finally{await browser.close()}
