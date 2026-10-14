import { useSyncExternalStore } from "react"

type View = "auto" | "mobile" | "pc"
type DevState = { view: View; width: number; desktopViewport: boolean }
const VIEW_KEY = "hongboitda-dev-view"
const WIDTH_KEY = "hongboitda-dev-width"
const previewWidths = [360, 375, 390, 430] as const
const DESKTOP_VIEWPORT = "width=1280"

function readStored(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode); the setting still works for this visit.
  }
}

const viewportMeta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
const defaultViewport = viewportMeta?.content ?? "width=device-width, initial-scale=1.0"
const listeners = new Set<() => void>()
let state: DevState = {
  view: readStored(VIEW_KEY, "auto") as View,
  width: Number(readStored(WIDTH_KEY, "390")) || 390,
  desktopViewport: false,
}

function apply() {
  const root = document.documentElement
  root.dataset.view = state.view
  root.style.setProperty("--preview-w", `${state.width}px`)
  if (viewportMeta) viewportMeta.content = state.desktopViewport ? DESKTOP_VIEWPORT : defaultViewport
  store(VIEW_KEY, state.view)
  store(WIDTH_KEY, String(state.width))
  window.dispatchEvent(new Event("resize"))
}
apply()

function setDevState(patch: Partial<DevState>) {
  state = { ...state, ...patch }
  apply()
  listeners.forEach((listener) => listener())
}

export function useDevState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

// Phones and small tablets report a short physical screen even when the page is laid out at desktop width.
export const isMobileDevice = () => Math.min(window.screen.width, window.screen.height) < 768

// Developer option in the menu: show the opposite layout (phone → PC page, PC → phone frame).
export const oppositeViewOn = (devState: DevState) => devState.desktopViewport || devState.view === "mobile"
export function setOppositeView(on: boolean) {
  if (isMobileDevice()) setDevState({ desktopViewport: on, view: "auto" })
  else setDevState({ desktopViewport: false, view: on ? "mobile" : "auto" })
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
  const devState = useDevState()
  if (!enabled) return null
  const options: [View, string][] = [["auto", "자동"], ["mobile", "모바일"], ["pc", "PC 전체"]]
  return (
    <div className="dev-toolbar" role="toolbar" aria-label="개발자 모드 화면 전환">
      <span className="dev-toolbar-title">개발자 모드</span>
      {options.map(([value, label]) => (
        <button key={value} type="button" aria-pressed={devState.view === value} onClick={() => setDevState({ view: value })}>
          {label}
        </button>
      ))}
      {devState.view === "mobile" && (
        <label className="dev-toolbar-width">
          <span className="sr-only">미리보기 너비</span>
          <select value={devState.width} onChange={(event) => setDevState({ width: Number(event.target.value) })}>
            {previewWidths.map((value) => (
              <option key={value} value={value}>
                {value}px
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
