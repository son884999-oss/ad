import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react"
import Icon from "./Icon"
import { uiText } from "./easyText"
import { useLayout } from "./DesktopStage"
import type { PhotoCheck } from "./ai"
import { checkPhotoQuality, type PhotoIssue } from "./photoQuality"

// Warning per problem: [headline, what to do]. Calm, plain words; the reason comes first.
const ISSUE_TEXT: Record<PhotoIssue, string> = {
  blurry: "사진이 흐려요. 흔들리지 않게 다시 찍어 주세요.",
  dark: "사진이 너무 어두워요. 밝은 곳에서 다시 찍어 주세요.",
  bright: "사진이 너무 밝아요. 빛이 덜 센 곳에서 다시 찍어 주세요.",
  small: "사진이 너무 작아요. 더 크게 찍은 사진을 골라 주세요.",
  notPhoto: "실제 사진이 아니에요. 가게나 제품을 직접 찍은 사진이 좋아요.",
}

// "이 사진 그대로 쓰기" is remembered for the photo while the page is open (coming back to this
// step does not warn again).
let acceptedImage = ""

const EXAMPLES = [["coffee", "커피"], ["cake", "케이크"], ["store", "가게"]] as const

/** Phones and tablets (coarse pointer) get a camera button; PC and mouse devices only the file picker. */
function useCameraChoice(isPc: boolean) {
  const query = "(pointer: coarse)"
  const [coarse, setCoarse] = useState(() => typeof matchMedia === "function" && matchMedia(query).matches)
  useEffect(() => {
    if (typeof matchMedia !== "function") return
    const list = matchMedia(query)
    const update = () => setCoarse(list.matches)
    update()
    list.addEventListener?.("change", update)
    return () => list.removeEventListener?.("change", update)
  }, [])
  return !isPc && coarse
}

export default function PhotoStep({imageUrl,pending,message,onUpload,onDropFile,onNext,aiCheck=null,easyMode=false}:{easyMode?:boolean;imageUrl:string;onDropFile?:(file:File)=>void;outputFormat?:"both"|"poster"|"video";onOutputFormatChange?:(format:"both"|"poster"|"video")=>void;pending:boolean;message:string;onUpload:(event:ChangeEvent<HTMLInputElement>)=>void;onNext:()=>void;aiCheck?:PhotoCheck|null}) {
 const t=(text:string)=>uiText(text,easyMode)
 const isPc=useLayout()==="pc"
 const camera=useCameraChoice(isPc)
 const inputRef=useRef<HTMLInputElement>(null),cameraRef=useRef<HTMLInputElement>(null),nextRef=useRef<HTMLButtonElement>(null),choiceRef=useRef<HTMLDivElement>(null)
 const [dragging,setDragging]=useState(false)
 const [choosing,setChoosing]=useState(false)
 const [local,setLocal]=useState<{image:string;issue:PhotoIssue|null}|null>(null)
 const [accepted,setAccepted]=useState(()=>acceptedImage)
 function issueOf():PhotoIssue|null{
  if(!imageUrl||accepted===imageUrl)return null
  const localIssue=local?.image===imageUrl?local.issue:null
  const aiIssue=aiCheck?(!aiCheck.isRealPhoto?"notPhoto":aiCheck.isBlurry?"blurry":null):null
  return localIssue??aiIssue
 }
 const drop=(event:DragEvent)=>{event.preventDefault();setDragging(false);const file=event.dataTransfer.files?.[0];if(file&&!pending)onDropFile?.(file)}
 const dragProps={onDragEnter:(event:DragEvent)=>{event.preventDefault();setDragging(true)},onDragOver:(event:DragEvent)=>event.preventDefault(),onDragLeave:()=>setDragging(false),onDrop:drop}
 useEffect(()=>{if(imageUrl&&(document.activeElement===document.body||!document.activeElement))nextRef.current?.focus({preventScroll:true})},[imageUrl])
 // Instant local check (blur / dark / bright / small) for each new photo.
 useEffect(()=>{
  setChoosing(false)
  if(!imageUrl)return
  let live=true
  void checkPhotoQuality(imageUrl).then(result=>{if(live)setLocal({image:imageUrl,issue:result?.issue??null})})
  return()=>{live=false}
 },[imageUrl])
 const warningRef=useRef<HTMLDivElement>(null)
 // 사진 예시: shown under the upload box when the whole step fits the phone scroll area without
 // scrolling; otherwise collapsed behind ▸ 사진 예시 보기. Measured on the real scroll area (framed
 // phone included) by trying the open layout before paint; data-fit is not managed by React.
 const slotRef=useRef<HTMLDivElement>(null)
 const fitExamples=()=>{
  const slot=slotRef.current,main=slot?.closest<HTMLElement>(".studio-main")
  if(!slot)return
  slot.dataset.fit="inline"
  if(!main||document.documentElement.dataset.layout==="pc")return
  if(main.scrollHeight>main.clientHeight+1)slot.dataset.fit="collapsed"
 }
 useLayoutEffect(fitExamples)
 useEffect(()=>{
  const main=slotRef.current?.closest(".studio-main")
  if(!main||typeof ResizeObserver!=="function")return
  let frame=0
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fitExamples)})
  observer.observe(main)
  void document.fonts?.ready.then(()=>fitExamples())
  return()=>{cancelAnimationFrame(frame);observer.disconnect()}
 },[imageUrl]) // eslint-disable-line react-hooks/exhaustive-deps
 const hasIssue=Boolean(issueOf())
 // The warning replaces 다음으로; if focus was lost with it, move it to 다시 찍기.
 useEffect(()=>{if(hasIssue&&(document.activeElement===document.body||!document.activeElement))warningRef.current?.querySelector<HTMLButtonElement>("button")?.focus({preventScroll:true})},[hasIssue])
 useEffect(()=>{if(choosing)choiceRef.current?.querySelector<HTMLButtonElement>("button")?.focus()},[choosing])
 const issue=issueOf()
 const openGallery=()=>{setChoosing(false);inputRef.current?.click()}
 const openCamera=()=>{setChoosing(false);cameraRef.current?.click()}
 // 다시 찍기 / 사진 변경: on a phone show the camera/album choice; otherwise open the file picker.
 const retake=()=>camera?setChoosing(true):openGallery()
 const useAnyway=()=>{acceptedImage=imageUrl;setAccepted(imageUrl);onNext()}
 const pickers=(primary:boolean):ReactNode=><div className={`photo-pickers${camera?" has-camera":""}`}>
  {camera&&<button type="button" className="studio-primary photo-camera-button" disabled={pending} onClick={openCamera}>{!easyMode&&<Icon name="camera" size={22}/>}{t("카메라로 찍기")}</button>}
  <button type="button" className={`${primary&&!camera?"studio-primary":"studio-secondary"} photo-gallery-button`} disabled={pending} onClick={openGallery}>{!easyMode&&camera&&<Icon name="picture" size={22}/>}{camera?t("앨범에서 고르기"):t(pending?"사진 확인 중":"사진 선택하기")}</button>
 </div>
 const examples=<><div className="photo-examples-grid">{EXAMPLES.map(([name,label])=><figure key={name}><img src={`/assets/reference-fresh/${name}.webp`} alt={easyMode?`${label} 사진`:`${label} 사진 예시`}/><figcaption>{label}</figcaption></figure>)}</div><p className="photo-examples-note">{t("※ 밝고 선명한 사진이 더 좋은 결과를 만들어요.")}</p></>
 return <div className={`photo-step ${imageUrl?'is-ready':''}${issue?' has-photo-warning':''}`}>
  <input ref={inputRef} id="product-photo" type="file" hidden accept="image/*" aria-label={t("제품 사진 올리기")} onChange={onUpload}/>
  {camera&&<input ref={cameraRef} id="product-photo-camera" type="file" hidden accept="image/*" capture="environment" aria-label={t("카메라로 사진 찍기")} onChange={onUpload}/>}
  {imageUrl?<><div className={`reference-selected-photo${dragging?" is-dragging":""}`} {...dragProps}>
    <img src={imageUrl} alt={t("선택한 제품 사진")}/>
    {!issue&&(choosing?<div ref={choiceRef} className="photo-choice">{pickers(false)}</div>:<button className="studio-secondary" disabled={pending} onClick={retake}>{t("사진 변경")}</button>)}
   </div>
   <div className="photo-check" aria-live="polite" aria-atomic="true">
    {issue&&<div ref={warningRef} className="photo-check-warning">
     <p><span className="photo-check-mark" aria-hidden="true">!</span><span id="photo-issue-text">{t(ISSUE_TEXT[issue])}</span></p>
     {choosing?<div ref={choiceRef} className="photo-choice">{pickers(false)}</div>:<div className="photo-check-actions">
      <button type="button" className="studio-primary" aria-describedby="photo-issue-text" disabled={pending} onClick={retake}>{camera?t("다시 찍기"):t("다른 사진 고르기")}</button>
      <button type="button" className="studio-secondary" aria-describedby="photo-issue-text" disabled={pending} onClick={useAnyway}>{t("이 사진 그대로 쓰기")}</button>
     </div>}
    </div>}
   </div>
   {!issue&&<button ref={nextRef} className="studio-primary photo-next-action" disabled={pending} onClick={onNext}>다음으로 <Icon name="arrow"/></button>}
  </>:<><div className={`reference-upload-box${dragging?" is-dragging":""}`} aria-busy={pending} {...dragProps}>
    <button className="reference-upload-icon" tabIndex={-1} aria-hidden="true" disabled={pending} onClick={camera?openCamera:openGallery}><span className="reference-upload-badge"><Icon name="camera" size={40}/></span></button>
    {/* Upfront guide = the box headline: a real photo you took yourself, no drawings or screenshots. */}
    <p className="photo-guide" id="photo-guide"><strong>{t("가게나 제품을 직접 찍은 실사 사진을 넣어 주세요")}</strong><span>{t("그림, 캡처 화면, 글자만 있는 이미지는 피해 주세요")}</span></p>
    {!easyMode&&<small className="upload-hint">{camera?t("바로 찍거나 앨범에서 골라 주세요."):<>JPG · PNG · WebP / 최대 10MB<span className="upload-drag-hint"> · 끌어다 놓아도 돼요</span></>}</small>}
    {pickers(true)}
   </div>
   <div ref={slotRef} className="photo-examples-slot">
    <section className="reference-photo-examples photo-examples-inline"><h3>{t('사진 예시')}</h3>{examples}</section>
    <details className="photo-examples-disclosure" onToggle={event=>{const details=event.currentTarget;if(details.open)requestAnimationFrame(()=>details.scrollIntoView({block:"nearest"}))}}><summary><span className="photo-examples-triangle" aria-hidden="true"/>{t("사진 예시 보기")}</summary>{examples}</details>
   </div>
  </>}
  {message&&message!=='사진이 준비됐어요.'&&<p className="upload-feedback" role={pending?'status':'alert'}>{t(message)}</p>}
 </div>
}
