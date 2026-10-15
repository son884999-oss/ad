import {chromium} from 'playwright'
import {fileURLToPath} from 'node:url'
import {mkdir,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import assert from 'node:assert/strict'
const output=process.env.FEEDBACK_REVIEW_OUTPUT
if(!output)throw Error('FEEDBACK_REVIEW_OUTPUT required')
await mkdir(output,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const report=[]
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'})
  await page.addInitScript(()=>{
   window.__shares=[]
   Object.defineProperty(navigator,'share',{configurable:true,writable:true,value:async data=>{window.__shares.push({title:data.title,text:data.text,files:data.files?.map(f=>({name:f.name,size:f.size,type:f.type}))})}})
   Object.defineProperty(navigator,'canShare',{configurable:true,writable:true,value:()=>true})
  })
  await page.goto('http://127.0.0.1:5173/')
  const normal=await page.locator('.studio-hero-description').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))
  assert.equal(await page.locator('.easy-mode').count(),0)
  await page.getByRole('navigation',{name:'모바일 빠른 메뉴',exact:true}).getByRole('button',{name:'메뉴',exact:true}).click()
  const menu=page.getByRole('dialog')
  await menu.getByText('설정·도움말',{exact:true}).click()
  await menu.getByText('글씨 크기·간편모드',{exact:true}).click()
  await menu.getByRole('switch',{name:'간편모드',exact:true}).click()
  await page.keyboard.press('Escape')
  const easy=await page.locator('.studio-hero-description').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))
  assert.equal(normal,18);assert.equal(easy,24)
  await page.screenshot({path:join(output,`easy-home-${width}.png`)})
  await page.getByRole('button',{name:'홍보물 만들기',exact:true}).click()
  await page.getByRole('dialog').getByRole('button',{name:'한 번에 완성',exact:true}).click()
  await page.locator('#product-photo').setInputFiles(fileURLToPath(new URL('../public/assets/samples/latte-product-sample.png',import.meta.url)))
  await page.getByRole('button',{name:'다음으로',exact:true}).click()
  await page.getByLabel('제품 설명',{exact:true}).fill('검토용 커피')
  const easyInput=await page.getByLabel('제품 설명',{exact:true}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize))
  assert.equal(easyInput,24)
  await page.getByRole('button',{name:'홍보물 만들기',exact:true}).click()
  await page.locator('#result-poster-preview img').waitFor()
  await page.getByRole('button',{name:'공유하기',exact:true}).click()
  await page.getByText('공유 요청을 전달했어요.',{exact:true}).waitFor()
  let shares=await page.evaluate(()=>window.__shares)
  assert.equal(shares[0].files[0].type,'image/png');assert.ok(shares[0].files[0].size>1000)
  await page.getByRole('tab',{name:'문구',exact:true}).click()
  const text=await page.getByRole('region',{name:'홍보 문구 원문',exact:true}).innerText()
  await page.getByRole('button',{name:'공유하기',exact:true}).click()
  shares=await page.evaluate(()=>window.__shares)
  assert.equal(shares[1].text,text)
  await page.evaluate(()=>navigator.share=async()=>{throw new DOMException('cancelled','AbortError')})
  await page.getByRole('button',{name:'공유하기',exact:true}).click()
  await page.getByText('공유를 취소했어요. 결과는 그대로 있어요.',{exact:true}).waitFor()
  await page.evaluate(()=>navigator.share=undefined)
  await page.getByRole('button',{name:'공유하기',exact:true}).click()
  await page.getByText(/이 브라우저는 공유창을 지원하지 않아요/).waitFor()
  await page.evaluate(()=>navigator.share=async data=>window.__shares.push({files:data.files?.map(f=>({size:f.size,type:f.type}))}))
  await page.getByRole('tab',{name:'영상',exact:true}).click()
  await page.getByRole('button',{name:'공유하기',exact:true}).click()
  await page.getByText('파일이 준비됐어요. 공유하기를 다시 눌러 주세요.',{exact:true}).waitFor()
  await page.getByRole('button',{name:'공유하기',exact:true}).click()
  shares=await page.evaluate(()=>window.__shares)
  assert.match(shares[2].files[0].type,/^video\//);assert.ok(shares[2].files[0].size>1000)
  await page.screenshot({path:join(output,`easy-video-${width}.png`)})
  report.push({width,normal,easy,easyInput,shares,cancellation:true,unsupportedGuidance:true,videoTwoStep:true})
  await page.close()
 }
 await writeFile(join(output,'sharing-mode.json'),JSON.stringify(report,null,2))
 console.log('PASS: 18→24px, image/video file payload, full text, cancellation and unsupported guidance; native sharing mocked only in test pages')
}finally{await browser.close()}
