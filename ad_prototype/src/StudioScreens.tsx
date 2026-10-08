import {
  useState,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react"

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

export function StudioIcon({
  name,
  size = 24,
}: {
  name: "home" | "plus" | "folder" | "picture" | "video" | "copy" | "arrow" | "menu"
  size?: number
}) {
  const paths = {
    home: "M3 10 12 3l9 7v10H3Zm5 10v-7h8v7",
    plus: "M12 5v14M5 12h14",
    folder: "M3 7V5h6l3 3h9v12H3Z",
    picture: "M3 4h18v16H3ZM3 16l5-5 5 5 4-4 4 4M16 8h.01",
    video: "M3 6h12v12H3Zm12 4 6-3v10l-6-3",
    copy: "M7 3h14v14M3 7h14v14H3Z",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    menu: "M4 6h16M4 12h16M4 18h16",
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}

function Wordmark() {
  return (
    <span className="studio-wordmark">
      <span className="studio-mark" aria-hidden="true">
        ∞
      </span>
      홍보잇다<span className="studio-brand-note">우리 가게의 작은 작업실</span>
    </span>
  )
}

function ReadButton({
  speaking,
  speechPreparing,
  onSpeak,
}: Pick<Speech, "speaking" | "speechPreparing" | "onSpeak">) {
  return (
    <button
      type="button"
      className="studio-tool"
      onClick={onSpeak}
      aria-pressed={speaking || speechPreparing}
    >
      {speechPreparing
        ? "읽기 준비 취소"
        : speaking
          ? "읽어주기 멈추기"
          : "화면 읽어주기"}
    </button>
  )
}

function SampleComposition() {
  return (
    <div className="studio-composition" aria-hidden="true">
      <div className="composition-label">사진 한 장이, 세 가지 홍보물로</div>
      <div className="composition-poster">
        <div className="composition-photo">
          <svg viewBox="0 0 220 170" fill="none">
            <path
              d="M34 136h152M68 136V77h84v59M58 78h104l-10-35H68Z"
              fill="#f5d6bd"
              stroke="#465e49"
              strokeWidth="3"
            />
            <path
              d="M81 78v58m28-58v58m28-58v58"
              stroke="#fff8ed"
              strokeWidth="9"
            />
            <path d="M99 106h27v30H99Z" fill="#496954" />
            <path d="M59 43h104" stroke="#465e49" strokeWidth="3" />
            <path
              d="M29 137v-31m0 12-12-10m12-1 12-9m145 39v-37m0 11-12-10m12 0 12-13"
              stroke="#748b64"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="173" cy="32" r="15" fill="#ebc985" />
          </svg>
        </div>
        <div className="composition-poster-text">
          우리 가게의 이야기를
          <br />
          <b>더 많은 사람에게.</b>
        </div>
        <span>포스터</span>
      </div>
      <div className="composition-copy">
        <span>홍보 글</span>
        <b>오늘도 정성껏 준비했어요.</b>
        <div className="composition-lines">
          <i />
          <i />
          <i />
        </div>
        <small>#우리동네 #오늘의추천</small>
      </div>
      <div className="composition-video">
        <StudioIcon name="video" size={32} />
        <span>짧은 영상</span>
        <i>▶</i>
      </div>
    </div>
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
      <div className="studio-login-brand">
        <Wordmark />
      </div>
      <div className="studio-login-layout">
        <section className="studio-login-form">
          <h1>{mode === "login" ? "로그인" : "회원가입"}</h1>
          <p>{mode === "login" ? "우리 가게 홍보를 시작해 보세요." : "이메일과 비밀번호를 입력해 주세요."}</p>
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
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
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
          <div className="studio-divider"><span>먼저 둘러보고 싶다면</span></div>
          <button className="studio-secondary" onClick={onEnter}>바로 시작하기 <StudioIcon name="arrow"/></button>
          {easyMode && (
            <ReadButton {...{ speaking, speechPreparing, onSpeak }} />
          )}
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
  const isActive = (item: typeof pages[number]) =>
    item.page === page && (item.page !== "create" || creationType === "all")
  const menuRef = useRef<HTMLElement>(null)
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
      <header className="studio-header" inert={mobileOpen}>
        <div className="studio-header-inner">
          <button
            className="studio-brand-button"
            onClick={() => navigate("home")}
            aria-label="홍보잇다 홈"
          >
            <Wordmark />
          </button>
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
      <aside
        className="studio-quickbar"
        aria-label="컴퓨터 빠른 메뉴"
        inert={mobileOpen}
      >
        <p>우리 가게 작업실</p>
        {pages.map((item) => (
          <button
            key={item.page}
            onClick={() => navigate(item.page, item.type)}
            className={isActive(item) ? "is-active" : ""}
            aria-current={isActive(item) ? "page" : undefined}
          >
            <StudioIcon name={item.icon} />
            {item.label}
          </button>
        ))}
        <p>필요한 것만 만들기</p>
        {[
          {
            type: "poster" as CreationType,
            label: "이미지 만들기",
            icon: "picture" as const,
          },
          {
            type: "video" as CreationType,
            label: "동영상 만들기",
            icon: "video" as const,
          },
          {
            type: "copy" as CreationType,
            label: "홍보 글 만들기",
            icon: "copy" as const,
          },
        ].map((item) => (
          <button
            key={item.type}
            onClick={() => navigate("create", item.type)}
            className={
              page === "create" && creationType === item.type ? "is-active" : ""
            }
          >
            <StudioIcon name={item.icon} />
            {item.label}
          </button>
        ))}
        <p>이용하기</p>
        <button onClick={() => navigate("plan")}>
          <StudioIcon name="folder" />
          구독·건당 플랜
        </button>
      </aside>
      <div className="studio-accessibility" inert={mobileOpen}>
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
          {easyMode && (
            <ReadButton {...{ speaking, speechPreparing, onSpeak }} />
          )}
        </div>
      </div>
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
              <Wordmark />
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
              <button onClick={onLogout}>로그아웃</button>
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
        홍보잇다 <span>우리 가게의 이야기를 잇다.</span>
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
        <div className="studio-guide-intro">
          <p className="studio-eyebrow">반가워요, 사장님 · 이렇게 진행해요</p>
          <h1 id="start-guide-title">
            사진 한 장에서
            <br />
            <em>우리 가게 홍보물까지.</em>
          </h1>
          <p>
            처음부터 잘 만들 필요 없어요.
            <br />
            아래 세 단계에 따라 함께 시작해요.
          </p>
        </div>
        <ol className="studio-guide-steps">
          <li>
            <span>1</span>
            <div>
              <h2>사진을 넣어요</h2>
              <p>제품 사진을 넣고, 만들 종류와 홍보할 곳을 골라요.</p>
            </div>
            <StudioIcon name="picture" size={30} />
          </li>
          <li>
            <span>2</span>
            <div>
              <h2>설명을 확인해요</h2>
              <p>제품 설명을 고치고, 함께 사용할 검색어(#)를 확인해요.</p>
            </div>
            <StudioIcon name="copy" size={30} />
          </li>
          <li>
            <span>3</span>
            <div>
              <h2>홍보물을 저장해요</h2>
              <p>
                완성된 이미지를 저장하고, 영상을 내려받거나 홍보 글을 복사해요.
              </p>
            </div>
            <StudioIcon name="folder" size={30} />
          </li>
        </ol>
        <div className="studio-guide-action">
          <div>
            <strong>준비물은 제품 사진 한 장이에요.</strong>
            <p>지금은 예시 결과로 사용 방법을 체험할 수 있어요.</p>
          </div>
          <button
            className="studio-primary"
            onClick={() => navigate("create", "all")}
          >
            만들러 가기 <StudioIcon name="arrow" />
          </button>
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
            },
            {
              type: "video" as CreationType,
              title: "동영상 만들기",
              note: "움직이는 짧은 홍보 영상",
              icon: "video" as const,
            },
            {
              type: "copy" as CreationType,
              title: "홍보 글 만들기",
              note: "홍보할 곳에 어울리는 말투",
              icon: "copy" as const,
            },
          ].map((item) => (
            <button
              key={item.type}
              onClick={() => navigate("create", item.type)}
            >
              <span className="studio-shortcut-icon">
                <StudioIcon name={item.icon} />
              </span>
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
