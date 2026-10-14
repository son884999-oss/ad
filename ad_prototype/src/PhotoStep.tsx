import { useRef, type ChangeEvent } from "react"
import Icon from "./Icon"
export default function PhotoStep({imageUrl,pending,message,onUpload,onNext}:{imageUrl:string;outputFormat?:"both"|"poster"|"video";onOutputFormatChange?:(format:"both"|"poster"|"video")=>void;pending:boolean;message:string;onUpload:(event:ChangeEvent<HTMLInputElement>)=>void;onNext:()=>void}) {
 const inputRef=useRef<HTMLInputElement>(null)
 return <div className={`photo-step ${imageUrl?'is-ready':''}`}>
  <input ref={inputRef} id="product-photo" type="file" hidden accept="image/*" aria-label="제품 사진 올리기" onChange={onUpload}/>
  {imageUrl?<><div className="reference-selected-photo"><img src={imageUrl} alt="선택한 제품 사진"/><button className="studio-secondary" disabled={pending} onClick={()=>inputRef.current?.click()}>사진 변경</button></div><button className="studio-primary photo-next-action" disabled={pending} onClick={onNext}>다음으로 <Icon name="arrow"/></button></>:<><div className="reference-upload-box" aria-busy={pending}><button className="reference-upload-icon" aria-label="사진 선택창 열기" disabled={pending} onClick={()=>inputRef.current?.click()}><span className="reference-upload-badge"><Icon name="camera" size={40}/></span></button><p>제품이나 가게 사진을<br/>올려주세요.</p><button className="studio-primary" disabled={pending} onClick={()=>inputRef.current?.click()}>{pending?'사진 확인 중':'사진 선택하기'}</button></div><section className="reference-photo-examples"><h3>사진 예시</h3><div>{[['coffee','커피 제품 사진'],['cake','케이크 제품 사진'],['store','가게 사진']].map(([name,alt])=><img key={name} src={`/assets/reference-fresh/${name}.webp`} alt={alt}/>)}</div><p>※ 밝고 선명한 사진이 더 좋은 결과를 만들어요.</p></section></>}
  {message&&message!=='사진이 준비됐어요.'&&<p className="upload-feedback" role={pending?'status':'alert'}>{message}</p>}
 </div>
}