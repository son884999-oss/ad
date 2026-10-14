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

function keepFocusedControlVisible() {
  const field = document.activeElement
  if (!(field instanceof HTMLElement) || !field.matches("input, textarea, select, button, summary, a[href]")) return
  const shell = field.closest<HTMLElement>(".studio-shell")
  if (!shell || field.closest("[inert]")) return
  const menu = field.closest<HTMLElement>(".studio-menu-panel")
  if (menu) {
    if (field.closest(".studio-menu-bottom-nav")) return
    const box = field.getBoundingClientRect()
    const top = menu.getBoundingClientRect().top + 12
    const bottom = (menu.querySelector(".studio-menu-bottom-nav")?.getBoundingClientRect().top ?? window.innerHeight) - 12
    const delta = box.top < top
      ? box.top - top
      : box.height <= bottom - top && box.bottom > bottom
        ? box.bottom - bottom
        : 0
    if (Math.abs(delta) > 1) menu.scrollBy({ top: delta, behavior: "instant" })
    return
  }
  if (!field.closest("main[data-app-scroll-container]")) return
  const viewport = window.visualViewport
  const reading = (shell.querySelector(".studio-reading-bar") ?? shell.querySelector(".studio-header"))?.getBoundingClientRect()
  const nav = shell.querySelector(".studio-bottom-nav")?.getBoundingClientRect()
  const tabs = shell.querySelector(".result-tabs-bar")?.getBoundingClientRect()
  const actions = field.closest(".compact-information") && !field.closest(".details-actions")
    ? shell.querySelector<HTMLElement>(".details-actions") : null
  const actionBox = actions && getComputedStyle(actions).position === "sticky"
    ? actions.getBoundingClientRect() : null
  const stickyTabsBottom = field.closest(".result-tab-panels") && tabs && tabs.top <= (reading?.bottom ?? 0) + 1 ? tabs.bottom : 0
  const top = Math.max(viewport?.offsetTop ?? 0, reading?.bottom ?? 0, stickyTabsBottom) + 12
  const bottom = Math.min(
    (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight),
    nav && nav.height > 0 ? nav.top : window.innerHeight,
    actionBox && actionBox.top > top ? actionBox.top : window.innerHeight,
  ) - 12
  const box = field.getBoundingClientRect()
  if (bottom <= top) return
  // Keep a large, manually resized textarea's top visible without repeatedly jumping.
  const delta = box.top < top
    ? box.top - top
    : box.height <= bottom - top && box.bottom > bottom
      ? box.bottom - bottom
      : 0
  if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: "instant" })
}

function ReadButton({
  speaking,
  speechPreparing,
  onSpeak,
  compact = false,
}: Pick<Speech, "speaking" | "speechPreparing" | "onSpeak"> & { compact?: boolean }) {
  const label = speechPreparing ? "읽기 준비 취소" : speaking ? "읽기 멈추기" : compact ? "읽어주기" : "화면 읽어주기"
  return (
    <button
      type="button"
      className="studio-tool studio-read-button"
      onClick={onSpeak}
      aria-pressed={speaking || speechPreparing}
      aria-label={label}
    >
      <StudioIcon name="sound" size={28} />
      <span>{label}</span>
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
                  id="login-password"
                  aria-label="비밀번호"
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
                  aria-controls="login-password"
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
  icon: "home" | "plus" | "folder"
}[] = [
  { label: "홈", page: "home", icon: "home" },
  { label: "만들기", page: "create", icon: "plus" },
  { label: "내 홍보물", page: "records", icon: "folder" },
]

export function StudioShell({
  page,
  title,
  creationType,
  mobileOpen,
  setMobileOpen,
  resultView,
  creationView,
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
  resultView: boolean
  creationView: boolean
  navigate: Navigation
  onLogout: () => void
  setEasyMode: (value: boolean) => void
  children: ReactNode
}) {
  const menuRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const readingRef = useRef<HTMLDivElement>(null)
  const openMenu = () => setMobileOpen(true)
  const bottomNavigation = (insideMenu = false) => (
    <nav
      inert={mobileOpen && !insideMenu}
      className={`mobile-navigation studio-bottom-nav ${
        insideMenu ? "studio-menu-bottom-nav" : ""
      }`}
      aria-label="모바일 빠른 메뉴"
    >
      {pages.map((item) => {
        const active = !mobileOpen && item.page === page
        return (
          <button
            key={item.page}
            type="button"
            onClick={() =>
              navigate(item.page)
            }
            className={active ? "is-active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <StudioIcon name={item.icon} />
            <span>{item.label}</span>
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className={mobileOpen ? "is-active" : ""}
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? "전체 메뉴 닫기" : "전체 메뉴 열기"}
      >
        <StudioIcon name="menu" />
        <span>메뉴</span>
      </button>
    </nav>
  )
  useEffect(() => {
    const header = headerRef.current
    const shell = header?.closest<HTMLElement>(".studio-shell")
    if (!header || !shell) return
    const measure = () => {
      shell.style.setProperty(
        "--studio-header-height",
        `${header.getBoundingClientRect().height}px`,
      )
      shell.style.setProperty(
        "--studio-reading-height",
        `${page === "home" ? header.getBoundingClientRect().height : readingRef.current?.getBoundingClientRect().height ?? 64}px`,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    if (readingRef.current) observer.observe(readingRef.current)
    return () => observer.disconnect()
  }, [page])
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
        menuRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter(
        (element) =>
          element.getClientRects().length > 0 && !element.closest("[inert]"),
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
  useEffect(() => {
    if (mobileOpen) menuRef.current?.focus()
  }, [mobileOpen])
  useEffect(() => {
    let frame = 0
    const schedule = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(keepFocusedControlVisible)
    }
    document.addEventListener("focusin", schedule)
    window.addEventListener("resize", schedule)
    window.visualViewport?.addEventListener("resize", schedule)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener("focusin", schedule)
      window.removeEventListener("resize", schedule)
      window.visualViewport?.removeEventListener("resize", schedule)
    }
  }, [])
  return (
    <div
      className={`prototype-app studio-shell ${page === "home" ? "is-home" : ""} ${easyMode ? "easy-mode" : ""} ${
        resultView ? "has-result-view" : ""
      } ${creationView ? "has-creation-view" : ""}`}
    >
      {page !== "home" && (
        <div ref={readingRef} className="studio-reading-bar" inert={mobileOpen}>
          <span className="studio-reading-context">{resultView ? "결과 보기" : title}</span>
          <div className="studio-header-tools">
            <ReadButton compact {...{ speaking, speechPreparing, onSpeak }} />
            <button className="studio-menu-button" onClick={openMenu} aria-label="상단 전체 메뉴 열기" aria-expanded={mobileOpen}>
              <StudioIcon name="menu" size={22} />
            </button>
          </div>
        </div>
      )}
      <header ref={headerRef} className="studio-header" inert={mobileOpen}>
        <div className="studio-header-inner">
          <button
            className="studio-brand-button"
            onClick={() => navigate("home")}
            aria-label="홍보잇다 홈"
          >
            <BrandLogo />
          </button>
          {page === "home" && <ReadButton compact {...{ speaking, speechPreparing, onSpeak }} />}
          <button
            className="studio-menu-button"
            onClick={() => openMenu()}
            aria-label="상단 전체 메뉴 열기"
            aria-expanded={mobileOpen}
          >
            <StudioIcon name="menu" />
          </button>
        </div>
      </header>
      {page !== "home" && <details className="studio-accessibility" inert={mobileOpen}>
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
      </details>}
      {mobileOpen && (
        <div
          className="studio-menu-layer"
        >
          <button
            className="studio-menu-backdrop"
            onClick={() => setMobileOpen(false)}
            aria-label="메뉴 닫기"
          />
          <aside
            ref={menuRef}
            tabIndex={-1}
            className="studio-menu-panel unified-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-label="전체 메뉴"
          >
            <div className="studio-menu-heading">
              <BrandLogo />
              <button
                onClick={() => setMobileOpen(false)}
                className="studio-secondary"
                aria-label="메뉴 닫기"
              >
                닫기 ×
              </button>
            </div>
            <h2 className="studio-panel-title">어떤 홍보물을 만들까요?</h2>
            <p className="studio-panel-intro">만들기 버튼은 세 가지 홍보물을 한 번에 만들어요.</p>
                {[
                  {
                    label: "한 번에 만들기",
                    type: "all" as CreationType,
                    icon: "plus" as const,
                    description:
                      "사진 한 장으로 이미지·영상·문구를 함께 만들어요.",
                  },
                  {
                    label: "이미지 만들기",
                    type: "poster" as CreationType,
                    icon: "picture" as const,
                    description: "사진과 글을 담은 포스터를 만들어요.",
                  },
                  {
                    label: "영상 만들기",
                    type: "video" as CreationType,
                    icon: "video" as const,
                    description: "사진을 활용한 짧은 영상 예시를 만들어요.",
                  },
                  {
                    label: "문구 만들기",
                    type: "copy" as CreationType,
                    icon: "copy" as const,
                    description: "복사해서 사용할 홍보 문구를 만들어요.",
                  },
                ].map((item) => (
                  <button
                    key={item.type}
                    aria-label={item.label}
                    aria-describedby={`creation-option-${item.type}`}
                    className={`studio-menu-row ${
                      creationType === item.type && page === "create"
                        ? "is-active"
                        : ""
                    }`}
                    onClick={() => navigate("create", item.type)}
                  >
                    <StudioIcon name={item.icon} />
                    <span className="studio-menu-copy">
                      <strong>{item.label}</strong>
                      <small id={`creation-option-${item.type}`}>
                        {item.description}
                      </small>
                    </span>
                    <StudioIcon name="arrow" />
                  </button>
                ))}
                <div className="studio-menu-footer">
                  <button onClick={() => navigate("records")}>내 홍보물 보기</button>
                </div>
                <details className="service-menu-section" open>
                  <summary>글씨 크기·간편모드</summary>
                  <p>간편모드에서는 글씨와 버튼을 더 크게 보여줘요.</p>
                  <button
                    className="studio-mode-switch"
                    role="switch"
                    aria-label="간편모드"
                    aria-checked={easyMode}
                    onClick={() => setEasyMode(!easyMode)}
                  >
                    <span>간편모드</span>
                    <strong>{easyMode ? "켜짐" : "꺼짐"}</strong>
                  </button>
                </details>
                <details className="service-menu-section">
                  <summary>읽어주기·완료 알림</summary>
                  <p>
                    메뉴를 닫은 뒤 화면 상단의 읽어주기로 내용을 들을 수 있어요.
                  </p>
                  <FeedbackSettings />
                </details>
                <details className="service-menu-section">
                  <summary>사용 방법</summary>
                  <ol>
                    <li>만들기를 누르면 사진 등록으로 이동해요.</li>
                    <li>사진을 넣고 제품 정보를 적어요.</li>
                    <li>이미지·영상·문구를 확인하고 저장하거나 복사해요.</li>
                  </ol>
                </details>
                <div className="studio-menu-footer">
                  <button onClick={() => navigate("plan")}>
                    구독·건당 플랜
                  </button>
                  <button onClick={onLogout}>로그인 화면 보기</button>
                </div>
            {bottomNavigation(true)}
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
      {bottomNavigation()}
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
  onChooseCreation,
  hasDraft,
}: {
  navigate: Navigation
  easyMode: boolean
  onChooseCreation: () => void
  hasDraft: boolean
}) {
  return (
    <div className="studio-home studio-home-simple">
      <section
        className="studio-start-guide"
        aria-labelledby="start-guide-title"
      >
        <div className="studio-hero-copy">
          <h1 id="start-guide-title" data-screen-heading tabIndex={-1}>
            사진 한 장으로
            <br />
            <em>우리 가게를 알려요.</em>
          </h1>
          <p className="studio-hero-description">
            이미지·영상·문구를 쉽게 만들어요.
          </p>
          <div className="studio-guide-action">
            <button className="studio-primary" onClick={onChooseCreation}>
              {hasDraft ? "홍보물 이어 만들기" : "홍보물 만들기"} <StudioIcon name="arrow" />
            </button>
            <p>가입 없이 체험할 수 있어요.</p>
          </div>
          <figure className="home-sample-art">
            <ServiceArt name="service-hero" alt="사진에서 이미지·영상·문구로 이어지는 체험 예시" priority />
          </figure>
        </div>
      </section>
      <section className="studio-how" aria-labelledby="how-title">
        <div className="studio-section-title">
          <h2 id="how-title">이렇게 세 단계면 돼요</h2>
        </div>
        <ol className="studio-guide-steps">
          {[
            ["사진을", "넣어요"],
            ["설명을", "적어요"],
            ["결과를", "확인해요"],
          ].map(([first, second], index) => (
            <li key={first}>
              <span className="studio-step-number">{index + 1}</span>
              <h3>{first}<br />{second}</h3>
              {index < 2 && (
                <span className="studio-guide-arrow" aria-hidden="true">
                  <StudioIcon name="arrow" size={24} />
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
