import { readFile, writeFile, mkdir } from "node:fs/promises"
import { createHash } from "node:crypto"
import { chromium } from "playwright"
import * as opentype from "../design-assets/branding/tooling/node_modules/opentype.js/dist/opentype.mjs"

const root=new URL("../",import.meta.url)
const fontBuffer=await readFile(new URL("design-assets/branding/fonts/NotoSansCJKkr-Bold.otf",root))
const font=opentype.parse(fontBuffer.buffer.slice(fontBuffer.byteOffset,fontBuffer.byteOffset+fontBuffer.byteLength))
await writeFile(new URL("design-assets/branding/fonts/font-info.json",root),JSON.stringify({source:"https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/Korean/NotoSansCJKkr-Bold.otf",names:font.names},null,2))
const text="홍보잇다"
for(const letter of text)if(font.charToGlyphIndex(letter)===0)throw Error(`글리프 누락: ${letter}`)
const browser=await chromium.launch({channel:"msedge",headless:true})
const manifest=[]
function wordmark(id){
 const size=100,spacing={a:0,b:5,c:-1,d:4,e:1}[id]
 const advance=size+spacing
 let paths=""
 for(const [i,char] of [...text].entries()) {
  const path=font.getPath(char,12+i*advance,108,size).toPathData(2)
  const fill=id==="d"&&i>=2?"#AD4A19":"#26364A"
  paths+=`<path data-letter="${char}" fill="${fill}" d="${path}"/>`
 }
 // D는 자모 윤곽을 훼손하지 않고 단어를 잇는 완만한 리본 획을 더한다.
 if(id==="d")paths+='<path d="M120 136 C154 154 186 154 216 136 C247 120 278 120 308 136" fill="none" stroke="#E88942" stroke-width="7" stroke-linecap="round"/>'
 const width=24+advance*4-spacing,height=id==="d"?162:130
 return {width,height,paths,svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">홍보잇다</title><desc>Noto Sans CJK KR Bold 기반 윤곽 워드마크 · ${id.toUpperCase()}안</desc>${paths}</svg>`}
}
try{
 const page=await browser.newPage()
 for(const id of ["a","b","c","d","e"]){
  const dir=new URL(`public/assets/branding/concepts/concept-${id}/`,root)
  await mkdir(dir,{recursive:true})
  const original=await readFile(new URL(`design-assets/branding/concept-${id}/selected.png`,root))
  const optimized=await page.evaluate(async data=>{
   const img=new Image();img.src="data:image/png;base64,"+data;await img.decode()
   const c=document.createElement("canvas");c.width=img.width;c.height=img.height
   const ctx=c.getContext("2d");ctx.drawImage(img,0,0)
   const pixels=ctx.getImageData(0,0,c.width,c.height).data
   let x0=c.width,y0=c.height,x1=0,y1=0
   // 원본을 보존하고 투명 여백만 잘라 미리보기의 시각 크기를 맞춘다.
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>24){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
   const width=x1-x0+1,height=y1-y0+1,side=Math.max(width,height)
   const out=document.createElement("canvas");out.width=512;out.height=512
   const scale=448/side;out.getContext("2d").drawImage(img,x0,y0,width,height,(512-width*scale)/2,(512-height*scale)/2,width*scale,height*scale)
   return {base64:out.toDataURL("image/webp",.97).split(",")[1],originalWidth:img.width,originalHeight:img.height,alphaCorner:pixels[3],bounds:{x0,y0,width,height}}
  },original.toString("base64"))
  const bytes=Buffer.from(optimized.base64,"base64")
  await writeFile(new URL("symbol.webp",dir),bytes)
  const w=wordmark(id)
  await writeFile(new URL("wordmark.svg",dir),w.svg)
  const logo=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 180" role="img" aria-labelledby="title"><title id="title">홍보잇다</title><desc>${id.toUpperCase()}안 · 생성 raster 심볼과 벡터 글자의 결합 시안</desc><image href="data:image/webp;base64,${optimized.base64}" x="0" y="0" width="180" height="180"/><g transform="translate(202 ${id==="d"?14:21}) scale(1.06)">${w.paths}</g></svg>`
  await writeFile(new URL("horizontal.svg",dir),logo)
  manifest.push({id,brand:text,original:`design-assets/branding/concept-${id}/selected.png`,symbol:`concept-${id}/symbol.webp`,wordmark:`concept-${id}/wordmark.svg`,horizontal:`concept-${id}/horizontal.svg`,originalWidth:optimized.originalWidth,originalHeight:optimized.originalHeight,originalSha256:createHash("sha256").update(original).digest("hex"),webpWidth:512,webpHeight:512,webpBytes:bytes.length,alphaCorner:optimized.alphaCorner,bounds:optimized.bounds,glyphs:[...text].map(c=>({character:c,glyph:font.charToGlyphIndex(c)})),symbolFormat:"생성 raster",wordmarkFormat:"윤곽 path SVG",combinationFormat:"raster 심볼을 내장한 혼합 SVG"})
 }
 await writeFile(new URL("public/assets/branding/concepts/manifest.json",root),JSON.stringify(manifest,null,2)+"\n")
 console.log(manifest.map(x=>({id:x.id,bytes:x.webpBytes,alphaCorner:x.alphaCorner})))
}finally{await browser.close()}
