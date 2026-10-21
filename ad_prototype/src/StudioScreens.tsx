import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import Icon from "./Icon"

import { uiText } from "./easyText"
import PrivacyPolicy from "./PrivacyPolicy"
type Page = "login" | "home" | "create" | "records" | "plan"
type CreationType = "all" | "poster" | "video" | "copy"
type Navigation = (page: Page, type?: CreationType) => void
type Speech = { easyMode: boolean; speaking: boolean; speechPreparing: boolean; onSpeak: () => void; speechMessage: string }
export { default as StudioIcon } from "./Icon"
function Logo() {
  return <span className="reference-logo"><svg viewBox="0 0 54 28" aria-hidden="true"><path d="M27 14C16-1 3 2 3 14s13 15 24 0S51-1 51 14s-13 15-24 0" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg><strong>홍보잇다</strong></span>
}
// icon: the small [듣기] in the easy screen header (text, since the easy screen shows no icons) (owner, 2026-10-20: the full-width button took about 100px of every
// easy screen). Its name is still read out, and switching to the easy screen says where it is.
function ReadButton({speaking,speechPreparing,onSpeak,wide=false,easy=false,icon=false}: Pick<Speech,"speaking"|"speechPreparing"|"onSpeak">&{wide?:boolean;easy?:boolean;icon?:boolean}) {
 const active=speaking||speechPreparing,label=wide?"화면 설명 듣기":"설명 듣기"
 return <button className={`reference-read${active?" is-active":""}${wide?" is-wide":""}${icon?" is-icon":""}`} onClick={onSpeak} aria-label={active?`${label} 멈추기`:easy?`${label}: 이 화면을 소리로 알려 드려요`:`${label}: 이 화면 사용법을 소리로 알려드려요`}>{active?<span className="sound-wave" aria-hidden="true"><i/><i/><i/></span>:<Icon name="sound" size={icon?24:18}/>}{icon?(active?"멈추기":"듣기"):active?(easy?"멈추기":"■ 멈추기"):label}</button>
}
function ModeSwitch({easyMode,onChange}:{easyMode:boolean;onChange:(value:boolean)=>void}) {
 return <div className="mode-switch" role="radiogroup" aria-label="화면 종류">{([[false,"기본","기본 화면"],[true,"쉬운","쉬운 화면"]] as const).map(([value,label,name])=><button key={label} type="button" role="radio" aria-checked={easyMode===value} aria-label={name} onClick={()=>onChange(value)}>{label}</button>)}</div>
}
export type ShellAccount = { email: string; onSignOut: () => void; onDelete: () => void } | null
export function StudioShell({account=null,generating=false,page,title,mobileOpen,setMobileOpen,navigate,onBack,onLogout,easyMode,setEasyMode,speaking,speechPreparing,onSpeak,speechMessage,resultView,children}: Speech & {account?:ShellAccount;page:Page;title:string;creationType:CreationType;mobileOpen:boolean;setMobileOpen:(value:boolean)=>void;resultView:boolean;generating?:boolean;creationView:boolean;navigate:Navigation;onBack:()=>void;onLogout:()=>void;setEasyMode:(value:boolean)=>void;children:ReactNode}) {
 const isPc=false // mobile web app only (2026-10-17)
 const shellRef=useRef<HTMLDivElement>(null),mainRef=useRef<HTMLElement>(null),menuRef=useRef<HTMLDivElement>(null),menuButtonRef=useRef<HTMLButtonElement>(null),wasOpen=useRef(false)
 const [modeNotice,setModeNotice]=useState("")
 // First visit: point at the 기본/쉬운 switch once (a speech bubble, so the home layout does not move).
 const [easyAsked,setEasyAsked]=useState(()=>{try{return localStorage.getItem("hongboitda-easy-asked")==="1"}catch{return true}})
 const markEasyAsked=()=>{try{localStorage.setItem("hongboitda-easy-asked","1")}catch{/* private mode: ask again next visit */}setEasyAsked(true)}
 const changeMode=(value:boolean)=>{markEasyAsked();if(value===easyMode)return;setEasyMode(value);setModeNotice(value?"쉬운 화면으로 바꿨어요. 글씨가 커지고 말이 쉬워져요":"기본 화면으로 바꿨어요")}
 useEffect(()=>{if(!modeNotice)return;const timer=window.setTimeout(()=>setModeNotice(""),2200);return()=>window.clearTimeout(timer)},[modeNotice])
 // 쉬운 화면: 듣기 sits in the header next to the switch (QA 2026-10-20: the full-width bar took a row on every screen).
 const headerAction=<div className="reference-header-actions">{easyMode&&<ReadButton icon easy {...{speaking,speechPreparing,onSpeak}}/>}<ModeSwitch easyMode={easyMode} onChange={changeMode}/></div>
 const t=(text:string)=>uiText(text,easyMode)
 useEffect(()=>{if(wasOpen.current&&!mobileOpen&&(document.activeElement===document.body||!document.activeElement))menuButtonRef.current?.focus();wasOpen.current=mobileOpen},[mobileOpen])
 useEffect(()=>{const shell=shellRef.current;if(!shell)return;const measure=()=>{const r=shell.getBoundingClientRect();shell.style.setProperty('--s',isPc?'1':String(Math.max(0.96,Math.min(r.width/375,r.height/812,1.1))));};measure();const observer=new ResizeObserver(measure);observer.observe(shell);return()=>observer.disconnect()},[isPc])
 useEffect(()=>{mainRef.current?.scrollTo(0,0)},[page,resultView])
 useEffect(()=>{if(!mobileOpen)return;menuRef.current?.focus();const handle=(e:KeyboardEvent)=>{if(e.key==='Escape')setMobileOpen(false);if(e.key!=='Tab')return;const items=Array.from(menuRef.current?.querySelectorAll<HTMLElement>('button,summary')??[]).filter(e=>e.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}};document.addEventListener('keydown',handle);return()=>document.removeEventListener('keydown',handle)},[mobileOpen,setMobileOpen])
 const nav=<nav className={`studio-bottom-nav${isPc?" is-top":""}`} aria-label={t(isPc?"주 메뉴":"모바일 빠른 메뉴")}>{([{label:'홈',icon:'home',page:'home'},{label:'만들기',icon:'plus',page:'create'},{label:'내 홍보물',icon:'folder',page:'records'}] as const).map(item=><button key={item.page} aria-current={!mobileOpen&&page===item.page?'page':undefined} className={`${!mobileOpen&&page===item.page?'is-active':''} nav-${item.page}`} onClick={()=>item.page==='create'?navigate('create','all'):navigate(item.page)}>{item.page==='create'?<svg className="nav-create-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>:<Icon name={item.icon}/>}<span>{t(item.label)}</span></button>)}<button ref={menuButtonRef} className={mobileOpen?'is-active':''} aria-label={mobileOpen?'전체 메뉴 닫기':'전체 메뉴 열기'} aria-expanded={mobileOpen} onClick={()=>setMobileOpen(!mobileOpen)}><Icon name="menu"/><span>메뉴</span></button></nav>
 return <div ref={shellRef} className={`prototype-app studio-shell reference-app ${page==='home'?'is-home':''} ${page==='create'?'has-creation-view':''} ${resultView?'has-result-view':''} ${easyMode?'easy-mode':''}`}>
  <a className="skip-link" href="#app-main">{t("본문 바로가기")}</a><header className="reference-header" inert={mobileOpen}>{page==='home'?<><button className="reference-brand" aria-label="홍보잇다 홈" onClick={()=>navigate('home')}><Logo/></button>{headerAction}</>:<><button className="reference-back" aria-label="뒤로가기" onClick={onBack}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg></button><strong>{t(generating?'만드는 중':resultView?'결과 보기':title)}</strong>{headerAction}</>}</header>
  {page==='home'&&!easyMode&&!easyAsked&&!mobileOpen&&<section className="easy-offer" aria-label="글씨 크게 보기 제안"><p>글씨를 크게, 말을 쉽게 볼까요?</p><div><button type="button" className="studio-secondary easy-offer-yes" onClick={()=>{changeMode(true);requestAnimationFrame(()=>document.querySelector<HTMLElement>(".mode-switch [aria-checked=true]")?.focus())}}>쉬운 화면으로</button><button type="button" className="studio-secondary" onClick={()=>{markEasyAsked();requestAnimationFrame(()=>document.querySelector<HTMLElement>(".mode-switch [aria-checked=true]")?.focus())}}>괜찮아요</button></div></section>}<p className={`mode-notice${modeNotice?" is-visible":""}`} role="status" aria-live="polite">{modeNotice}</p><main ref={mainRef} id="app-main" tabIndex={-1} className="studio-main" data-app-scroll-container inert={mobileOpen}>{speechMessage&&<p className="studio-status" role="status">{speechMessage}</p>}{children}</main>
  {mobileOpen&&<div ref={menuRef} className="reference-menu" role="dialog" aria-modal="true" aria-label="전체 메뉴" tabIndex={-1}><div className="reference-menu-header"><Logo/><button aria-label="메뉴 닫기" onClick={()=>setMobileOpen(false)}><Icon name="close" size={20}/>닫기</button></div><div className="reference-menu-content"><h2>{t('어떤 홍보물을 만들까요?')}</h2><div className="menu-creation-options">{([{label:'한 번에 완성',type:'all',icon:'camera',description:<>사진 등록부터 홍보물까지<br/>한 번에 만들어요.</>,easy:'포스터·영상·글을 다 만들어요.'},{label:'이미지 만들기',type:'poster',icon:'picture',description:<>포스터, 카드뉴스, 배너 등<br/>이미지를 만들어요.</>,easy:'가게 알림 그림을 만들어요.'},{label:'동영상 만들기',type:'video',icon:'video',description:<>짧은 홍보 영상을 만들어<br/>가게를 소개해요.</>,easy:'짧은 가게 영상을 만들어요.'},{label:'홍보 글 만들기',type:'copy',icon:'copy',description:<>SNS 글, 블로그 글,<br/>홍보 문구를 만들어요.</>,easy:'인터넷에 올릴 글을 써요.'}] as const).map(item=><button className="studio-menu-row" key={item.type} aria-label={t(item.label)} onClick={()=>navigate('create',item.type)}><Icon name={item.icon}/><span className="studio-menu-copy"><strong>{t(item.label)}</strong><small>{easyMode?item.easy:item.description}</small></span></button>)}</div>{easyMode&&<h2 className="menu-more-heading">더 보기</h2>}{account&&<p className="reference-menu-account"><Icon name="user" size={20}/><span>{account.email}<small>{t('로그인 중 · 내 홍보물이 서버에 저장돼요')}</small></span></p>}<div className="reference-menu-links">{([{label:'내 홍보물 보기',icon:'folder',onClick:()=>navigate('records')},{label:'구독·건당 플랜',icon:'card',onClick:()=>navigate('plan')},...(account?[{label:'로그아웃',icon:'user' as const,onClick:account.onSignOut},{label:'회원 탈퇴',icon:'close' as const,onClick:account.onDelete}]:[{label:'로그인 · 회원가입',icon:'user' as const,onClick:onLogout}])] as const).map(link=><button key={link.label} onClick={link.onClick}><Icon name={link.icon} size={22}/><span>{t(link.label)}</span><Icon name="chevron" size={20}/></button>)}</div><button className="reference-toggle-row" role="switch" aria-checked={easyMode} onClick={()=>changeMode(!easyMode)}><Icon name="text-size" size={22}/><span>쉬운 화면<small>{t(easyMode?"지금 켜져 있어요":"지금 꺼져 있어요")}</small></span><i aria-hidden="true"/></button></div></div>}
  
  {!isPc&&nav}
 </div>
}
export function StudioHome({onChooseCreation,easyMode}: {navigate:Navigation;easyMode:boolean;onChooseCreation:()=>void;hasDraft:boolean}) {
 const t=(text:string)=>uiText(text,easyMode)
 return <div className="reference-home"><div className="reference-home-copy">{easyMode?<><h1 data-screen-heading tabIndex={-1}>사진 한 장이면<br/><em>홍보물이 돼요.</em></h1><p>포스터, 영상, 글을<br/>AI가 자동으로 만들어 드려요.</p></>:<><h1 data-screen-heading tabIndex={-1}>사진 한 장으로<br/><em>우리 가게를 알려요.</em></h1><p>포스터·짧은 영상·홍보 글을<br/>AI가 쉽고 빠르게 만들어 드려요.</p></>}<button className="studio-primary reference-home-create" onClick={onChooseCreation}><Icon name="camera"/>홍보물 만들기 <Icon name="arrow"/></button><small>{t('회원가입·결제 없이 무료로 써 볼 수 있어요.')}</small></div><div className="home-samples" role="img" aria-label={easyMode?"만든 예시: 상품 포스터, 인터넷에 올릴 글, 짧은 영상, 가격 안내, 해시태그":"홍보잇다로 만든 상품 포스터, SNS 홍보 글, 짧은 상품 영상, 가격·할인 문구, 해시태그 예시"}><div className="home-samples-track" aria-hidden="true"><img className="home-sample" src="/assets/reference-fresh/poster-coffee.webp" alt="" decoding="async"/><div className="home-sample is-copy"><div className="home-copy-head"><span className="home-copy-avatar">행</span><strong>행복한 카페</strong></div><p>오늘도 따뜻한 라떼 한 잔 어때요?</p><p className="home-copy-tags"><span>#행복한카페</span> <span>#하트라떼</span></p><div className="home-copy-foot">{easyMode?<span>좋아요 128</span>:<><span>♥ 128</span><span>댓글 24</span></>}</div></div><div className="home-sample is-video"><img src="/assets/reference-fresh/latte.webp" alt="" decoding="async"/><span className="home-video-play"/><small>0:15</small></div><div className="home-sample is-price"><img src="/assets/reference-fresh/cake.webp" alt="" decoding="async"/><div className="home-price-tag"><b>수제 초코 케이크</b><s>6,500원</s><strong>5,500원</strong><em>오늘만 15% 할인</em></div></div><img className="home-sample" src="/assets/reference-fresh/poster-example.webp" alt="" decoding="async"/><div className="home-sample is-photo"><img src="/assets/reference-fresh/shampoo.webp" alt="" decoding="async"/><span className="home-photo-label">초록숲 샴푸</span></div><div className="home-sample is-copy is-tags"><strong className="home-tags-title">해시태그</strong><p className="home-copy-tags"><span>#천연샴푸</span> <span>#두피케어</span> <span>#초록숲</span> <span>#선물추천</span> <span>#동네가게</span></p></div><div className="home-sample is-copy is-blog"><div className="home-copy-head"><span className="home-copy-avatar">초</span><strong>초록숲 상점</strong></div><p>머리 감을 때마다 숲 향기가 나요. 두 병 사면 한 병 더!</p><div className="home-copy-foot"><span>{easyMode?'1+1 행사':'1+1 행사 중'}</span></div></div><div className="home-sample is-video"><img src="/assets/reference-fresh/cake-ad.webp" alt="" decoding="async"/><span className="home-video-play"/><small>0:12</small></div></div></div><section className="reference-home-steps"><h2>{t('이렇게 세 단계면 돼요')}</h2><ol>{(easyMode?[['사진 넣기'],['내용 쓰기'],['보고 저장']]:[['사진 등록'],['정보 입력'],['결과 확인']]).map(([a,b],i)=><li key={a}><span>{i+1}</span><strong>{b?<>{a} <br/>{b}</>:a}</strong>{!easyMode&&i<2&&<i aria-hidden="true">→</i>}</li>)}</ol></section></div>
}
export type LoginActions = {
 /** False when Supabase is not set up: the buttons say 준비 중 as before. */
 configured: boolean
 onEmail: (mode: "login" | "signup", email: string, password: string) => Promise<"signed-in" | "check-email">
 onSocial: (provider: "kakao" | "google") => Promise<void>
 errorText: (error: unknown) => string
}
// 로그인 / 회원가입 (Supabase Auth, 2026-10-19): e-mail + password, 카카오, Google (네이버 button removed, QA 2026-10-20). Sign-up asks
// for the password twice, 만 14세 이상 and the 개인정보 수집·이용 consent (required), with the policy readable here.
export function StudioLogin({onEnter,speaking,speechPreparing,onSpeak,easyMode,auth}:Speech&{onEnter:()=>void;auth?:LoginActions}) {
 const [notice,setNotice]=useState('')
 const [mode,setMode]=useState<"login"|"signup">("login")
 const [busy,setBusy]=useState(false)
 const t=(text:string)=>uiText(text,easyMode)
 const configured=Boolean(auth?.configured)
 const pending=(name:string)=>setNotice(easyMode?'아직 준비 중이에요. 아래 ‘바로 시작하기’를 눌러 주세요.':name+' 로그인은 준비 중이에요. 아래 바로 시작하기로 먼저 체험해 보세요.')
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault()
  if(!configured||!auth){pending('이메일');return}
  const form=new FormData(event.currentTarget)
  const email=String(form.get('email')??'').trim(),password=String(form.get('password')??'')
  if(!email||!password){setNotice('이메일과 비밀번호를 적어 주세요.');return}
  if(mode==='signup'){
   if(password.length<8){setNotice('비밀번호는 8자 이상으로 정해 주세요.');return}
   if(password!==String(form.get('password2')??'')){setNotice('비밀번호가 서로 달라요. 다시 적어 주세요.');return}
   if(!form.get('age')||!form.get('privacy')){setNotice('필수 항목에 동의해 주세요.');return}
  }
  setBusy(true);setNotice(mode==='signup'?'가입하고 있어요…':'로그인하고 있어요…')
  try{
   const result=await auth.onEmail(mode,email,password)
   if(result==='check-email'){setNotice('가입 확인 메일을 보냈어요. 메일의 링크를 누르면 로그인돼요.');return}
   setNotice('');onEnter()
  }catch(error){setNotice(auth.errorText(error))}finally{setBusy(false)}
 }
 const social=async(provider:"kakao"|"google",name:string)=>{
  if(!configured||!auth){pending(name);return}
  setBusy(true);setNotice(name+'로 이동하고 있어요…')
  try{await auth.onSocial(provider)}catch(error){setNotice(auth.errorText(error));setBusy(false)}
 }
 const signup=mode==='signup'
 return <main className={`reference-login${easyMode?" easy-mode":""}`}>
  <div className="reference-login-top"><Logo/><ReadButton easy={easyMode} {...{speaking,speechPreparing,onSpeak}}/></div>
  <h1 data-screen-heading tabIndex={-1}>{signup?'회원가입':'로그인'}</h1>
  <p className="reference-login-lead">{t(signup?"이메일로 가입하면 내 홍보물을 다른 기기에서도 볼 수 있어요.":"홍보잇다에 오신 것을 환영해요.")}</p>
  <form className="reference-login-form" onSubmit={submit} noValidate>
   <label>이메일<input type="email" name="email" id="login-email" autoComplete={signup?"email":"username"} placeholder={t("이메일 주소")} disabled={busy}/></label>
   <label>비밀번호<input type="password" name="password" id="login-password" autoComplete={signup?"new-password":"current-password"} placeholder={signup?"8자 이상":"비밀번호"} disabled={busy}/></label>
   {signup&&<>
    <label>비밀번호 확인<input type="password" name="password2" id="login-password2" autoComplete="new-password" placeholder="한 번 더" disabled={busy}/></label>
    <label className="reference-login-check"><input type="checkbox" name="age" id="login-age" disabled={busy}/><span>{t("[필수] 만 14세 이상이에요")}</span></label>
    <label className="reference-login-check"><input type="checkbox" name="privacy" id="login-privacy" disabled={busy}/><span>{t("[필수] 개인정보 수집·이용에 동의해요")}</span></label>
    <details className="reference-login-policy"><summary>{t("개인정보 처리방침 보기")}</summary><PrivacyPolicy/></details>
   </>}
   <button type="submit" className="studio-primary" disabled={busy}>{signup?'가입하기':'로그인'}</button>
  </form>
  <p className="reference-login-signup">{t(signup?"이미 계정이 있나요?":"아직 계정이 없나요?")}<button type="button" onClick={()=>{setMode(signup?'login':'signup');setNotice('')}}>{t(signup?"로그인":"회원가입")}</button></p>
  <p className="reference-login-divider"><span>{t("간편 로그인")}</span></p>
  <div className="reference-social">
   <button type="button" className="social-kakao" disabled={busy} onClick={()=>void social('kakao','카카오')}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 6l-1 3.7c-.1.3.3.6.6.4l4.4-2.9h.8c5 0 9-3.1 9-7s-4-7.2-9-7.2"/></svg>카카오로 시작하기</button>
   <button type="button" className="social-google" disabled={busy} onClick={()=>void social('google','Google')}><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>{t('Google로 시작하기')}</button>
  </div>
  <p className="reference-login-notice" role="status">{notice}</p>
  <button type="button" className="reference-login-guest" onClick={onEnter}>바로 시작하기 <Icon name="arrow" size={22}/></button>
  <small className="reference-login-note">{t("회원가입 없이 바로 체험할 수 있어요.")}</small>
 </main>
}
