import { chromium } from "playwright"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import assert from "node:assert/strict"
const root=new URL("../",import.meta.url)
const out=new URL("ui-review/phase4a/",root)
await mkdir(out,{recursive:true})
const report={viewports:[],assets:[],contrast:[],productionPreserved:false}
const browser=await chromium.launch({channel:"msedge",headless:true})
try{
 for(const width of [320,375,390,430,768,1024,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1})
  const errors=[];page.on("pageerror",e=>errors.push(e.message))
  await page.goto("http://127.0.0.1:5173/brand-review/index.html")
  await page.locator(".overview-card").last().waitFor()
  await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>{i.loading="eager";return i.decode()}))})
  assert.equal(await page.locator(".overview-card").count(),5)
  assert.equal(await page.locator(".concept").count(),5)
  const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,columns:getComputedStyle(document.querySelector(".overview-grid")).gridTemplateColumns.split(" ").length,icons:[...document.querySelectorAll('.size-32,.size-96')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),broken:[...document.images].filter(e=>!e.complete||!e.naturalWidth).length}))
  assert.equal(metrics.overflow,false,`${width}px 가로 넘침`)
  assert.equal(metrics.broken,0)
  for(const [i,icon] of metrics.icons.entries()){assert.equal(icon.width,i%2?96:32);assert.equal(icon.height,icon.width)}
  if(width===1440){
   assert.equal(metrics.columns,5)
   await page.locator("#overview").screenshot({path:fileURLToPath(new URL("public/brand-review/comparison.png",root))})
   for(const id of ["a","b","c","d","e"])await page.locator(`#concept-${id}`).screenshot({path:fileURLToPath(new URL(`concept-${id}.png`,out))})
  }
  if([320,390,1440].includes(width))await page.screenshot({path:fileURLToPath(new URL(`comparison-page-${width}.png`,out)),fullPage:true})
  await page.locator('a[href="#concept-d"]').click()
  assert.equal(new URL(page.url()).hash,"#concept-d")
  assert.deepEqual(errors,[])
  report.viewports.push({width,...metrics})
  await page.close()
 }
 const manifest=JSON.parse(await readFile(new URL("public/assets/branding/concepts/manifest.json",root),"utf8"))
 for(const item of manifest){
  const word=await readFile(new URL("public/assets/branding/concepts/"+item.wordmark,root),"utf8")
  const combo=await readFile(new URL("public/assets/branding/concepts/"+item.horizontal,root),"utf8")
  for(const svg of [word,combo]){
   assert(svg.includes("<title id=\"title\">홍보잇다</title>"))
   assert.equal([...svg.matchAll(/data-letter="([^"]+)"/g)].map(x=>x[1]).join(""),"홍보잇다")
   assert(!/<text[\s>]/.test(svg),'워드마크는 외부 글꼴 없는 윤곽 path')
  }
  report.assets.push({id:item.id,bytes:item.webpBytes,brandSpelling:true,outlineWordmark:true,rasterSymbol:true})
 }
 const lum=hex=>{const rgb=[0,2,4].map(n=>parseInt(hex.replace('#','').slice(n,n+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
 for(const [name,fg,bg,isText] of [["본문","#26364A","#FFF8EF",true],["보조 글자","#706D68","#FFF8EF",true],["제안 버튼","#FFFFFF","#AD4A19",true],["강조 글자","#AD4A19","#FFF8EF",true],["심볼 주황","#E88942","#FFF8EF",false]]){
  const a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05)
  if(isText)assert(ratio>=4.5)
  report.contrast.push({name,fg,bg,ratio:Number(ratio.toFixed(2)),textUse:isText})
 }
 const baseline=JSON.parse(await readFile(new URL("design-assets/branding/production-baseline.json",root),"utf8"))
 for(const item of baseline)assert.equal(createHash("sha256").update(await readFile(new URL(item.file,root))).digest("hex"),item.sha256,`기존 파일 변경: ${item.file}`)
 report.productionPreserved=true;report.protectedFileCount=baseline.length
 // 실제 서비스의 주요 흐름과 결과 수·저장 동작을 같은 서버에서 점검한다.
 const app=await browser.newPage({viewport:{width:390,height:844}})
 await app.goto("http://127.0.0.1:5173/")
 await app.getByRole("button",{name:"홍보물 만들기",exact:true}).click()
 await app.locator("input[type=file]").setInputFiles(fileURLToPath(new URL("design-assets/illustrations/step-photo.png",root)))
 await app.getByRole("button",{name:"사진 확인하고 다음",exact:true}).click()
 await app.getByRole("button",{name:"이 내용으로 결과 보기",exact:true}).click()
 await app.locator(".result-grid").waitFor()
 assert.equal(await app.locator(".result-card").count(),3)
 const download=app.waitForEvent("download")
 await app.getByRole("button",{name:"포스터 저장",exact:true}).click()
 assert.match((await download).suggestedFilename(),/\.png$/)
 report.appSmoke={photo:true,details:true,results:3,pngDownload:true}
 await app.close()
 await writeFile(new URL("verification.json",out),JSON.stringify(report,null,2)+"\n")
 console.log("PASS: 5개 로고, 7개 너비, 32/96px 크기, 한글 윤곽, 대비, 기존 31개 파일 보존, 실제 서비스 PNG 저장")
}finally{await browser.close()}
