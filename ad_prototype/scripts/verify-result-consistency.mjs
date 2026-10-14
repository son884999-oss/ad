import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const output=process.env.RESULT_REVIEW_OUTPUT || fileURLToPath(new URL('../ui-review/result-consistency/',import.meta.url))
await mkdir(output,{recursive:true})
const base=process.env.UI_BASE_URL||'http://127.0.0.1:5173/'
for(let attempt=0;attempt<50;attempt++){try{await fetch(base);break}catch{if(attempt===49)throw new Error('Preview server is unavailable: '+base);await new Promise(resolve=>setTimeout(resolve,200))}}
const browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage']}:process.env.UI_BROWSER_CHANNEL?{channel:process.env.UI_BROWSER_CHANNEL}:{})})
const reports=[]
const photo=fileURLToPath(new URL('../public/assets/samples/product-example.png',import.meta.url))
const sampleName='데일리 샴푸'
async function openResult(page,mode){
 await page.goto(base)
 if(process.env.UI_TEST_FONT_ROOT){
  const root=process.env.UI_TEST_FONT_ROOT
  await page.route('**/test-fonts/*',route=>route.fulfill({path:join(root,'files',route.request().url().split('/').pop()),contentType:'font/woff2'}))
  const css=(await readFile(join(root,'index.css'),'utf8')).replaceAll('Noto Sans KR Variable','Noto Sans KR').replaceAll('./files/','/test-fonts/')
  await page.addStyleTag({content:css})
 }
 if(mode==='regular'){
  await page.getByRole('button',{name:'상단 전체 메뉴 열기',exact:true}).click()
  const menu=page.getByRole('dialog',{name:'전체 메뉴'})
  const toggle=menu.getByRole('switch',{name:'간편모드',exact:true})
  if(await toggle.getAttribute('aria-checked')==='true'){await toggle.focus();await page.keyboard.press('Space')}
  await page.keyboard.press('Escape')
 }
 await page.getByRole('button',{name:'홍보물 만들기',exact:true}).click()
 await page.getByLabel('제품 사진 올리기',{exact:true}).setInputFiles(photo)
 await page.getByRole('button',{name:'다음으로',exact:true}).click()
 await page.getByLabel('상품명',{exact:true}).fill(sampleName)
 await page.getByRole('button',{name:'결과 보기',exact:true}).click()
 await page.locator('#result-poster-preview img').waitFor()
 await page.evaluate(()=>document.fonts.ready)
}
async function metrics(panel){
 return panel.evaluate(el=>{
  const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height}}
  const action=el.querySelector('.result-primary-action')
  const preview=el.querySelector('.result-preview')
  const style=getComputedStyle(action)
  return {preview:rect(preview),action:rect(action),font:style.fontSize,padding:style.padding,radius:style.borderRadius,background:style.backgroundColor}
 })
}
function equalGeometry(actual,expected,label){
 for(const key of ['preview','action'])for(const dimension of ['x','y','width','height'])assert.ok(Math.abs(actual[key][dimension]-expected[key][dimension])<1,`${label} ${key}.${dimension}: ${actual[key][dimension]} != ${expected[key][dimension]}`)
 for(const key of ['font','padding','radius','background'])assert.equal(actual[key],expected[key],label+' '+key)
}
async function checkExport(page,kind){
 const promise=page.waitForEvent('download',{timeout:45000})
 await page.getByRole('button',{name:kind==='poster'?'이미지 저장하기':'영상 저장하기',exact:true}).click()
 const download=await promise
 assert.match(download.suggestedFilename(),kind==='poster'?/\.png$/:/\.(mp4|webm)$/)
 assert.ok((await stat(await download.path())).size>1000)
 return download.suggestedFilename()
}
try{
 for(const width of [320,375,390,430,768,1024,1440])for(const mode of ['easy','regular']){
  const page=await browser.newPage({viewport:{width,height:844},permissions:['clipboard-read','clipboard-write'],reducedMotion:'reduce'})
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await openResult(page,mode)
  const measurements={}
  for(const [kind,label] of [['poster','이미지'],['video','영상'],['copy','문구']]){
   await page.getByRole('tab',{name:label,exact:true}).click()
   const panel=page.locator('#result-'+kind)
   measurements[kind]=await metrics(panel)
   assert.ok(measurements[kind].action.height>=44)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   assert.equal(await page.locator('.media-full-copy,.result-publishing-help').count(),0)
   assert.equal(await panel.locator('.result-primary-action').count(),1)
   assert.equal(await panel.locator('.result-preview-toolbar').count(),0)
   assert.equal(await panel.getByText('기본 홍보 문구',{exact:true}).count(),0)
   if(kind!=='copy'){
    const control=panel.locator('.result-preview-action')
    const bounds=await control.boundingBox()
    assert.ok(bounds.width>=120&&bounds.height>=48,'Preview controls must remain prominent')
    const frame=await panel.locator('.result-preview').boundingBox()
    assert.ok(bounds.y+bounds.height<=frame.y+1,'Media control must not cover result content')
    assert.equal(await control.locator('svg').count(),1)
    const colors=await control.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,text:s.color}})
    const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)
    const bg=luminance(colors.background),fg=luminance(colors.text)
    assert.ok((Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)>=4.5,'Preview control contrast must remain readable')
   }
   if(kind!=='poster')equalGeometry(measurements[kind],measurements.poster,`${width} ${mode} ${kind}`)
   await panel.locator('.result-primary-action').scrollIntoViewIfNeeded()
   const usable=await panel.locator('.result-primary-action').evaluate(el=>{const r=el.getBoundingClientRect();const p=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return p&&el.contains(p)})
   assert.ok(usable,`${width} ${mode} ${kind}: primary action is covered`)
   if(width===390&&mode==='easy')await page.screenshot({path:join(output,`result-${kind}-390.png`),fullPage:true})
  }
  await page.getByRole('tab',{name:'이미지',exact:true}).click()
  const before=await metrics(page.locator('#result-poster'))
  await page.getByRole('button',{name:'크게 보기',exact:true}).click()
  equalGeometry(await metrics(page.locator('#result-poster')),before,'image enlargement')
  assert.equal(await page.getByRole('button',{name:'작게 보기',exact:true}).getAttribute('aria-pressed'),'true')
  await page.getByRole('button',{name:'작게 보기',exact:true}).click()
  const imageControl=await page.locator('#result-poster .result-preview-action').boundingBox()
  await page.getByRole('tab',{name:'영상',exact:true}).click()
  const videoControl=await page.locator('#result-video .result-preview-action').boundingBox()
  assert.equal(imageControl.width,videoControl.width)
  assert.equal(imageControl.height,videoControl.height)
  assert.equal(imageControl.x,videoControl.x)
  await page.getByRole('button',{name:'재생하기',exact:true}).click()
  assert.equal(await page.getByRole('button',{name:'일시 정지',exact:true}).getAttribute('aria-pressed'),'true')
  await page.getByRole('tab',{name:'문구',exact:true}).click()
  await page.getByRole('tab',{name:'영상',exact:true}).click()
  assert.equal(await page.getByRole('button',{name:'재생하기',exact:true}).getAttribute('aria-pressed'),'false')
  await page.getByRole('tab',{name:'이미지',exact:true}).focus()
  await page.keyboard.press('ArrowRight')
  assert.equal(await page.getByRole('tab',{name:'영상',exact:true}).getAttribute('aria-selected'),'true')
  await page.keyboard.press('End')
  assert.equal(await page.getByRole('tab',{name:'문구',exact:true}).getAttribute('aria-selected'),'true')
  const text=await page.getByRole('region',{name:'홍보 문구 원문',exact:true}).innerText()
  await page.getByRole('button',{name:'문구 전체 복사하기',exact:true}).click()
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),text)
  await page.locator('#result-copy .result-inline-status[role="status"]').waitFor()
  if(width===390&&mode==='easy'){
   await page.evaluate(()=>{
    window.resultClipboardWrite=navigator.clipboard.writeText.bind(navigator.clipboard)
    window.resultExecCommand=document.execCommand.bind(document)
    navigator.clipboard.writeText=()=>Promise.reject(new Error('test denied'))
    document.execCommand=()=>false
   })
   await page.getByRole('button',{name:'문구 전체 복사하기',exact:true}).click()
   await page.locator('#result-copy .result-inline-status[role="alert"]').waitFor()
   assert.match(await page.locator('#result-copy .result-inline-status').innerText(),/다시 시도/)
   await page.evaluate(()=>{navigator.clipboard.writeText=window.resultClipboardWrite;document.execCommand=window.resultExecCommand})
   await page.getByRole('button',{name:'문구 전체 복사하기',exact:true}).click()
   await page.locator('#result-copy .result-inline-status[role="status"]').waitFor()
   await page.getByRole('tab',{name:'이미지',exact:true}).click()
   await checkExport(page,'poster')
   await page.getByRole('tab',{name:'영상',exact:true}).click()
   // A preparation can still be cancelled at the common primary action position.
   await page.getByRole('button',{name:'영상 저장하기',exact:true}).click()
   await page.getByRole('button',{name:'영상 준비 취소',exact:true}).click()
   await page.getByRole('button',{name:'영상 저장하기',exact:true}).waitFor()
   await checkExport(page,'video')
  }
  await page.getByRole('button',{name:'내용 다시 수정하기',exact:true}).click()
  assert.equal(await page.getByLabel('상품명',{exact:true}).inputValue(),sampleName)
  assert.deepEqual(errors,[])
  reports.push({width,mode,status:'passed',measurements})
  console.log(`PASS ${width}px ${mode}`)
  await page.close()
 }
 await writeFile(join(output,'verification.json'),JSON.stringify(reports,null,2))
 console.log('PASS: 14 layouts, shared action geometry, enlargement, playback, keyboard tabs, clipboard failure/retry, image/video exports and video cancellation.')
}finally{await browser.close()}
