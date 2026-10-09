import {
  useState,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react"

import StudioIcon from "./Icon"
import FeedbackSettings from "./FeedbackSettings"
import BrandLogo from "./BrandLogo"
import ServiceArt from "./ServiceArt"

type Page = "login" | "home" | "create" | "records" | "plan"
type CreationType = "all" | "poster" | "video" | "copy"
type Navigation = (page: Page, type?: CreationType) => void
type Speech = {
  easyMode: boolean
  speaking: boolean
  speechPreparing: boolean
  onSpeak: () => void
  speechMessage: string
}

export { default as StudioIcon } from "./Icon"

function ReadButton({
  speaking,
  speechPreparing,
  onSpeak,
}: Pick<Speech, "speaking" | "speechPreparing" | "onSpeak">) {
  return (
    <button
      type="button"
      className="studio-tool studio-read-button"
      onClick={onSpeak}
      aria-pressed={speaking || speechPreparing}
    >
      <StudioIcon name="sound" size={28} />
      <span>
        {speechPreparing
          ? "읽기 준비 취소"
          : speaking
            ? "읽어주기 멈추기"
            : "화면 읽어주기"}
      </span>
    </button>
  )
}

export function StudioLogin({
  onEnter,
  easyMode,
  speaking,
  speechPreparing,
  onSpeak,
  speechMessage,
}: Speech & { onEnter: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [showPassword, setShowPassword] = useState(false)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onEnter()
  }
  return (
    <main
      className={`prototype-app studio-login ${easyMode ? "easy-mode" : ""}`}
    >
      <div className="studio-reading-bar">
        <ReadButton {...{ speaking, speechPreparing, onSpeak }} />
      </div>
      <div className="studio-login-brand">
        <BrandLogo stacked />
      </div>
      <div className="studio-login-layout">
        <section className="studio-login-form">
          <h1 data-screen-heading tabIndex={-1}>
            {mode === "login" ? "로그인" : "회원가입"}
          </h1>
          <p>
            {mode === "login"
              ? "우리 가게 홍보를 시작해 보세요."
              : "이메일과 비밀번호를 입력해 주세요."}
          </p>
          <form onSubmit={submit}>
            <label>
              이메일
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
              />
            </label>
            <label>
              비밀번호
              <div className="studio-password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={4}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder="4자 이상 입력"
                />
                <button
                  type="button"
                  aria-label={
                    showPassword ? "비밀번호 숨기기" : "비밀번호 보기"
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "숨기기" : "보기"}
                </button>
              </div>
            </label>
            <button type="submit" className="studio-primary">
              {mode === "login" ? "로그인" : "가입하고 시작하기"}
            </button>
          </form>
          <button
            className="studio-text-button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login"
              ? "처음이신가요? 회원가입"
              : "이미 계정이 있나요? 로그인"}
          </button>
          <div className="studio-divider">
            <span>먼저 둘러보고 싶다면</span>
          </div>
          <button className="studio-secondary" onClick={onEnter}>
            바로 시작하기 <StudioIcon name="arrow" />
          </button>
          {speechMessage && <p role="status">{speechMessage}</p>}
          <p className="studio-login-note">
            현재는 화면과 기능을 확인하는 체험용 서비스예요.
          </p>
        </section>
      </div>
    </main>
  )
}

const pages: {
  label: string
  page: Page
  type?: CreationType
  icon: "home" | "plus" | "folder"
}[] = [
  { label: "홈", page: "home", icon: "home" },
  { label: "만들기", page: "create", type: "all", icon: "plus" },
  { label: "내 홍보물", page: "records", icon: "folder" },
]

export function StudioShell({
  page,
  title,
  creationType,
  mobileOpen,
  setMobileOpen,
  navigate,
  onLogout,
  easyMode,
  setEasyMode,
  speaking,
  speechPreparing,
  onSpeak,
  speechMessage,
  children,
}: Speech & {
  page: Page
  title: string
  creationType: CreationType
  mobileOpen: boolean
  setMobileOpen: (value: boolean) => void
  navigate: Navigation
  onLogout: () => void
  setEasyMode: (value: boolean) => void
  children: ReactNode
}) {
  const menuRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const header = headerRef.current
    const shell = header?.closest<HTMLElement>(".studio-shell")
    if (!header || !shell) return
    const measure = () =>
      shell.style.setProperty(
        "--studio-header-height",
        `${header.getBoundingClientRect().height}px`,
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    menuRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setMobileOpen(false)
        return
      }
      if (event.key !== "Tab") return
      const buttons = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ) ?? [],
      )
      const first = buttons[0],
        last = buttons.at(-1)
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === menuRef.current)
      ) {
        event.preventDefault()
        last?.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === menuRef.current)
      ) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKey)
      if (previous?.isConnected) previous.focus()
    }
  }, [mobileOpen, setMobileOpen])
  return (
    <div
      className={`prototype-app studio-shell ${easyMode ? "easy-mode" : ""}`}
    >
      <div className="studio-reading-bar" inert={mobileOpen}>
        <ReadButton {...{ speaking, speechPreparing, onSpeak }} />
      </div>
      <header ref={headerRef} className="studio-header" inert={mobileOpen}>
        <div className="studio-header-inner">
          <button
            className="studio-brand-button"
            onClick={() => navigate("home")}
            aria-label="홍보잇다 홈"
          >
            <BrandLogo />
          </button>
          <nav className="studio-desktop-nav" aria-label="주요 메뉴">
            {pages.map((item) => (
              <button
                key={item.page}
                onClick={() => navigate(item.page, item.type)}
                className={item.page === page ? "is-active" : ""}
                aria-current={item.page === page ? "page" : undefined}
              >
                <StudioIcon name={item.icon} />
                {item.label}
              </button>
            ))}
          </nav>
          <button
            className="studio-menu-button"
            onClick={() => setMobileOpen(true)}
            aria-label="메뉴 열기"
            aria-expanded={mobileOpen}
          >
            <StudioIcon name="menu" />
            <span>메뉴</span>
          </button>
        </div>
      </header>
      <details className="studio-accessibility" inert={mobileOpen}>
        <summary>
          <StudioIcon name="settings" size={20} />
          글씨·알림 설정
        </summary>
        <div>
          <span className="studio-current-page">{title}</span>
          <button
            className="studio-mode-switch"
            role="switch"
            aria-label="간편모드"
            onClick={() => setEasyMode(!easyMode)}
            aria-checked={easyMode}
          >
            <span>간편모드</span>
            <span
              className={`studio-switch-track ${easyMode ? "is-on" : ""}`}
              aria-hidden="true"
            >
              <i />
            </span>
            <span>{easyMode ? "켜짐" : "꺼짐"}</span>
          </button>
        </div>
        <FeedbackSettings />
      </details>
      {mobileOpen && (
        <div className="studio-menu-layer">
          <button
            className="studio-menu-backdrop"
            onClick={() => setMobileOpen(false)}
            aria-label="메뉴 닫기"
          />
          <aside
            ref={menuRef}
            tabIndex={-1}
            className="studio-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-label="전체 메뉴"
          >
            <div className="studio-menu-heading">
              <BrandLogo />
              <button
                onClick={() => setMobileOpen(false)}
                className="studio-tool"
                aria-label="메뉴 닫기"
              >
                닫기 ×
              </button>
            </div>
            <p>어떤 홍보물을 만들까요?</p>
            {[
              {
                label: "한 번에 완성",
                type: "all" as CreationType,
                icon: "plus" as const,
              },
              {
                label: "이미지 만들기",
                type: "poster" as CreationType,
                icon: "picture" as const,
              },
              {
                label: "동영상 만들기",
                type: "video" as CreationType,
                icon: "video" as const,
              },
              {
                label: "홍보 글 만들기",
                type: "copy" as CreationType,
                icon: "copy" as const,
              },
            ].map((item) => (
              <button
                key={item.type}
                className={`studio-menu-row ${
                  creationType === item.type && page === "create"
                    ? "is-active"
                    : ""
                }`}
                onClick={() => navigate("create", item.type)}
              >
                <StudioIcon name={item.icon} />
                {item.label}
                <StudioIcon name="arrow" />
              </button>
            ))}
            <div className="studio-menu-footer">
              <button onClick={() => navigate("records")}>
                내 홍보물 보기
              </button>
              <button onClick={() => navigate("plan")}>구독·건당 플랜</button>
              <button onClick={onLogout}>로그인 화면 보기</button>
            </div>
          </aside>
        </div>
      )}
      <main
        className="studio-main"
        data-app-scroll-container
        inert={mobileOpen}
      >
        {speechMessage && (
          <p className="studio-status" role="status">
            {speechMessage}
          </p>
        )}
        {children}
      </main>
      <nav
        inert={mobileOpen}
        className="mobile-navigation studio-bottom-nav"
        aria-label="모바일 빠른 메뉴"
      >
        {pages.map((item) => (
          <button
            key={item.page}
            onClick={() => navigate(item.page, item.type)}
            className={item.page === page ? "is-active" : ""}
            aria-current={item.page === page ? "page" : undefined}
          >
            <StudioIcon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <footer className="studio-footer">
        <img
          src="/assets/branding/selected/wordmark.svg"
          width="421"
          height="130"
          alt="홍보잇다"
        />
        <span>우리 가게의 이야기를 잇다.</span>
      </footer>
    </div>
  )
}

export function StudioHome({
  navigate,
}: {
  navigate: Navigation
  easyMode: boolean
}) {
  return (
    <div className="studio-home">
      <section
        className="studio-start-guide"
        aria-labelledby="start-guide-title"
      >
        <div className="studio-hero-copy">
          <p className="studio-eyebrow">우리 가게의 쉬운 홍보 도우미</p>
          <h1 id="start-guide-title" data-screen-heading tabIndex={-1}>
            <span className="hero-brand">홍보잇다</span>
            사진 한 장으로
            <br />
            <em>우리 가게를 알려요.</em>
          </h1>
          <p className="studio-hero-description">
            포스터·짧은 영상·홍보 글을
            <br />
            차근차근 함께 만들어요.
          </p>
          <div className="studio-guide-action">
            <button
              className="studio-primary"
              onClick={() => navigate("create", "all")}
            >
              홍보물 만들기 <StudioIcon name="arrow" />
            </button>
            <p>가입 없이 시작 · 제품 사진 한 장이면 돼요</p>
          </div>
        </div>
      </section>
      <section className="studio-how" aria-labelledby="how-title">
        <div className="studio-section-title">
          <p className="studio-eyebrow">처음이어도 괜찮아요</p>
          <h2 id="how-title">이렇게 세 단계면 돼요</h2>
        </div>
        <ol className="studio-guide-steps">
          {[
            {
              image: "workflow-photo" as const,
              title: "사진을 넣어요",
              text: "제품이나 가게 사진 한 장",
            },
            {
              image: "workflow-details" as const,
              title: "설명을 적어요",
              text: "제품의 특징을 짧게 적어요",
            },
            {
              image: "workflow-results" as const,
              title: "결과를 확인해요",
              text: "만든 결과를 저장해요",
            },
          ].map((step, index) => (
            <li key={step.image}>
              <ServiceArt name={step.image} />
              <div>
                <span className="studio-step-number">{index + 1}단계</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="studio-example" aria-labelledby="example-title">
        <div className="studio-section-title">
          <h2 id="example-title">사진 한 장으로 이런 홍보물을 만들어요</h2>
          <p className="studio-demo-note">
            사진과 설명으로 예시 결과를 만드는 체험 서비스예요.
          </p>
        </div>
        <div className="studio-hero-art">
          <ServiceArt
            name="service-hero"
            alt="제품 사진에서 포스터·짧은 영상·홍보 글로 이어지는 결과 화면과 작은 가게"
          />
          <span className="studio-art-caption">
            포스터 · 짧은 영상 · 홍보 글
          </span>
        </div>
      </section>
      <section className="studio-shortcuts">
        <div className="studio-section-title">
          <span className="studio-eyebrow">필요한 것만 골라도 좋아요</span>
          <h2>하나씩 만들어 보기</h2>
        </div>
        <div>
          {[
            {
              type: "poster" as CreationType,
              title: "이미지 만들기",
              note: "사진과 글을 담은 포스터",
              icon: "picture" as const,
              art: "service-poster" as const,
            },
            {
              type: "video" as CreationType,
              title: "동영상 만들기",
              note: "움직이는 짧은 홍보 영상",
              icon: "video" as const,
              art: "service-video" as const,
            },
            {
              type: "copy" as CreationType,
              title: "홍보 글 만들기",
              note: "홍보할 곳에 어울리는 말투",
              icon: "copy" as const,
              art: "service-copy" as const,
            },
          ].map((item) => (
            <button
              key={item.type}
              onClick={() => navigate("create", item.type)}
            >
              <ServiceArt name={item.art} className="shortcut-art" />
              <span>
                <strong>{item.title}</strong>
                <small>{item.note}</small>
              </span>
              <StudioIcon name="arrow" />
            </button>
          ))}
        </div>
      </section>
      <section className="studio-record-banner">
        <div>
          <StudioIcon name="folder" size={32} />
          <span>
            <h2>만든 홍보물 다시 보기</h2>
            <p>이 창에서 만든 결과를 한곳에서 다시 볼 수 있어요.</p>
          </span>
        </div>
        <button
          className="studio-secondary"
          onClick={() => navigate("records")}
        >
          내 홍보물 보기 <StudioIcon name="arrow" />
        </button>
      </section>
    </div>
  )
}
