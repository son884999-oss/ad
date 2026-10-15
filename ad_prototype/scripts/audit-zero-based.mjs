import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const output=process.env.FEEDBACK_REVIEW_OUTPUT
if(!output) throw Error('FEEDBACK_REVIEW_OUTPUT required')
const base=process.env.AUDIT_BASE_URL || 'http://127.0.0.1:4173'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const photo=fileURLToPath(new URL('../public/assets/samples/product-example.png',import.meta.url))
const results={base,screens:[],edgeCases:{},errors:[],requests:[]}
async function open(width=390) {
  const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']})
  page.on('pageerror',e=>results.errors.push({width,message:e.message}))
  page.on('console',m=>{if(m.type()==='error') results.errors.push({width,message:m.text()})})
  page.on('request',r=>{if(['fetch','xhr'].includes(r.resourceType())) results.requests.push({url:r.url(),method:r.method()})})
  await page.goto(base)
  return page
}
async function capture(page,name,width) {
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))})
  await page.screenshot({path:join(output,`${name}-${width}.png`)})
  results.screens.push({name,width,...await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,images:[...document.images].filter(i=>i.checkVisibility()).map(i=>({src:i.currentSrc,width:i.naturalWidth,height:i.naturalHeight,displayWidth:i.getBoundingClientRect().width})),nav:[...document.querySelectorAll('.studio-bottom-nav')].filter(n=>n.checkVisibility()&&!n.inert).map(n=>({position:getComputedStyle(n).position,bottom:n.getBoundingClientRect().bottom,height:innerHeight})),headings:[...document.querySelectorAll('[data-screen-heading]')].map(e=>e.textContent)}))})
}
async function create(page) {
  await page.getByRole('button',{name:'홍보물 만들기',exact:true}).click()
  await page.getByRole('dialog').getByRole('button',{name:'한 번에 완성',exact:true}).click()
  await page.locator('#product-photo').setInputFiles(photo)
  await page.getByRole('button',{name:'사진 확인하고 다음',exact:true}).click()
  await page.getByLabel('가게·제품 이름',{exact:true}).fill('독립 검토 가게')
  await page.getByLabel('제품 설명',{exact:true}).fill('사진과 설명을 직접 입력한 검토용 상품')
  await page.getByLabel('강조할 특징',{exact:true}).fill('신선한 제품을 매일 준비해요')
  await page.getByRole('button',{name:'이 내용으로 결과 보기',exact:true}).click()
  await page.locator('#result-poster img[src^="blob:"]').waitFor()
}
try {
  for(const width of [320,375,390,430,768,1024,1440]) {
    const page=await open(width)
    const cta=await page.getByRole('button',{name:'홍보물 만들기',exact:true}).boundingBox()
    results.screens.push({name:'home-cta',width,cta,withinInitialViewport:cta.y+cta.height<844-(width<1024?81:0)})
    await capture(page,'home',width)
    await create(page)
    for(const [tab,name] of [['이미지','poster'],['영상','video'],['문구','copy']]) {
      await page.getByRole('tab',{name:tab,exact:true}).click()
      await page.evaluate(()=>scrollTo(0,0))
      await capture(page,name,width)
    }
    const nav=page.locator(width<1024?'.studio-bottom-nav':'.studio-desktop-nav')
    await nav.getByRole('button',{name:'내 홍보물',exact:true}).click()
    await capture(page,'records',width)
    await page.close()
  }

  const page=await open()
  await create(page)
  await page.getByRole('tab',{name:'문구',exact:true}).click()
  await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}});document.execCommand=()=>true})
  const copy=page.getByRole('button',{name:'문구 전체 복사하기',exact:true})
  await copy.focus();await page.keyboard.press('Space')
  await page.getByText(/복사했어요/).waitFor()
  results.edgeCases.fallbackFocus=await copy.evaluate(el=>({retained:document.activeElement===el,active:document.activeElement.tagName}))
  await page.evaluate(()=>{document.execCommand=()=>{throw Error('blocked')}})
  await copy.click();await page.getByText(/복사하지 못했어요/).waitFor()
  results.edgeCases.fallbackFailure=await page.evaluate(()=>({temporaryTextareas:document.querySelectorAll('body > textarea').length,active:document.activeElement.tagName}))
  await capture(page,'clipboard-failure',390)
  await page.close()

  const videoPage=await open()
  await create(videoPage)
  await videoPage.getByRole('tab',{name:'영상',exact:true}).click()
  await capture(videoPage,'video-preview-before-download',390)
  const downloadPromise=videoPage.waitForEvent('download')
  await videoPage.getByRole('button',{name:'영상 저장하기',exact:true}).click()
  const download=await downloadPromise
  const file=join(output,download.suggestedFilename())
  await download.saveAs(file)
  const bytes=await readFile(file)
  await videoPage.route('**/__audit_video',route=>route.fulfill({body:bytes,contentType:file.endsWith('.mp4')?'video/mp4':'video/webm'}))
  results.edgeCases.video=await videoPage.evaluate(async()=>{
    const video=document.createElement('video');video.muted=true;video.src='/__audit_video';video.preload='auto';document.body.append(video)
    await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(Error('video decode failed'))})
    const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight
    const ctx=canvas.getContext('2d');const frames=[]
    for(const time of [0,1]) {
      if(time>0){video.currentTime=time;await new Promise(resolve=>video.onseeked=resolve)}
      ctx.drawImage(video,0,0)
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data
      let lit=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]+pixels[i+1]+pixels[i+2]>30)lit++}
      frames.push({time,nonBlackRatio:lit/(pixels.length/4),png:canvas.toDataURL('image/png')})
    }
    const result={duration:video.duration,width:video.videoWidth,height:video.videoHeight,frames};video.remove();return result
  })
  for(const frame of results.edgeCases.video.frames){await writeFile(join(output,`video-frame-${frame.time}.png`),Buffer.from(frame.png.split(',')[1],'base64'));delete frame.png}
  let lateDownloads=0
  videoPage.on('download',()=>lateDownloads++)
  await videoPage.getByRole('button',{name:'영상 저장하기',exact:true}).click()
  await videoPage.getByRole('button',{name:'영상 준비 취소',exact:true}).waitFor()
  await videoPage.locator('.studio-bottom-nav').getByRole('button',{name:'홈',exact:true}).click()
  await videoPage.waitForTimeout(3700)
  results.edgeCases.leaveDuringVideo={lateDownloads}
  await videoPage.close()

  const errorsPage=await open()
  await create(errorsPage)
  await errorsPage.getByRole('button',{name:'내용 다시 수정하기',exact:true}).click()
  const upload=errorsPage.getByLabel('정보 입력에서 사진 바꾸기',{exact:true})
  const previous=await errorsPage.locator('.information-photo img').getAttribute('src')
  for(const [name,mimeType,buffer] of [['corrupt.png','image/png',Buffer.from('not an image')],['large.png','image/png',Buffer.alloc(20*1024*1024+1)]]) {
    await upload.setInputFiles({name,mimeType,buffer})
    await errorsPage.getByText(/기존 사진은 그대로예요/).waitFor()
    results.edgeCases[name]={preserved:await errorsPage.locator('.information-photo img').getAttribute('src')===previous,message:await errorsPage.getByText(/기존 사진은 그대로예요/).textContent()}
  }
  await errorsPage.getByLabel('제품 설명',{exact:true}).fill(' ')
  results.edgeCases.blankRequired={disabled:await errorsPage.getByRole('button',{name:'이 내용으로 결과 보기',exact:true}).isDisabled()}
  await errorsPage.reload()
  await errorsPage.locator('.studio-bottom-nav').getByRole('button',{name:'내 홍보물',exact:true}).click()
  results.edgeCases.refresh={records:await errorsPage.locator('.record-item').count(),notice:await errorsPage.locator('.records-retention-note').textContent()}
  await errorsPage.close()

  await writeFile(join(output,'audit.json'),JSON.stringify(results,null,2))
  if(process.env.ASSERT_SAFE_FIXES==='1') {
    assert.equal(results.edgeCases.fallbackFocus.retained,true)
    assert.equal(results.edgeCases.fallbackFailure.temporaryTextareas,0)
    assert.equal(results.edgeCases.leaveDuringVideo.lateDownloads,0)
    assert.ok(results.edgeCases.video.frames[0].nonBlackRatio>.1)
  }
  console.log(JSON.stringify({screens:results.screens.length,errors:results.errors,edgeCases:results.edgeCases},null,2))
} finally {await browser.close()}
