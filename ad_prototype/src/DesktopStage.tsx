import { useEffect, useState } from "react"

type View = "auto" | "mobile" | "pc"
const VIEW_KEY = "hongboitda-dev-view"
const WIDTH_KEY = "hongboitda-dev-width"
const previewWidths = [360, 375, 390, 430] as const

function readStored<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback
  } catch {
    return fallback
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode); the toolbar still works for this visit.
  }
}

// Brand panel beside the phone frame on wide desktop screens (hidden on mobile and in PC view).
export function DesktopAside() {
  return (
    <aside className="desktop-aside" aria-label="홍보잇다 소개">
      <span className="desktop-aside-logo">
        <svg viewBox="0 0 54 28" aria-hidden="true">
          <path d="M27 14C16-1 3 2 3 14s13 15 24 0S51-1 51 14s-13 15-24 0" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <strong>홍보잇다</strong>
      </span>
      <h2>
        사진 한 장으로
        <br />
        우리 가게 홍보를 시작해요
      </h2>
      <p>포스터·짧은 영상·홍보 글을 한 번에 만들어요. 휴대폰에서 가장 편하게 쓸 수 있도록 만들었어요.</p>
      <ul>
        <li>회원가입 없이 바로 시작</li>
        <li>큰 글씨 간편모드 기본 제공</li>
        <li>읽어주기로 화면 안내</li>
      </ul>
    </aside>
  )
}

// Developer-only viewport switcher. Shown in dev builds or with ?dev in the URL.
export function DevToolbar() {
  const enabled = import.meta.env.DEV || new URLSearchParams(window.location.search).has("dev")
  const [view, setView] = useState<View>(() => readStored<View>(VIEW_KEY, "auto"))
  const [width, setWidth] = useState(() => Number(readStored(WIDTH_KEY, "390")) || 390)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!enabled) return
    const root = document.documentElement
    root.dataset.view = view
    root.style.setProperty("--preview-w", `${width}px`)
    store(VIEW_KEY, view)
    store(WIDTH_KEY, String(width))
    window.dispatchEvent(new Event("resize"))
  }, [enabled, view, width])

  if (!enabled) return null
  const options: [View, string][] = [["auto", "자동"], ["mobile", "모바일"], ["pc", "PC 전체"]]
  return (
    <div className={`dev-toolbar${open ? "" : " is-collapsed"}`} role="toolbar" aria-label="개발자 모드 화면 전환">
      <button type="button" className="dev-toolbar-title" aria-expanded={open} onClick={() => setOpen(!open)}>
        개발자 모드
      </button>
      {open && (
        <>
          {options.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>
              {label}
            </button>
          ))}
          {view === "mobile" && (
            <label className="dev-toolbar-width">
              <span className="sr-only">미리보기 너비</span>
              <select value={width} onChange={(event) => setWidth(Number(event.target.value))}>
                {previewWidths.map((value) => (
                  <option key={value} value={value}>
                    {value}px
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
    </div>
  )
}
