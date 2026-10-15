import { useSyncExternalStore } from "react"

type View = "auto" | "mobile" | "pc"
export type Layout = "mobile" | "pc"
type DevState = { view: View; width: number; desktopViewport: boolean; layout: Layout }
// v2: earlier visits stored "auto"; a new key lets the new default below apply once.
const VIEW_KEY = "hongboitda-dev-view-v2"
const WIDTH_KEY = "hongboitda-dev-width"
const previewWidths = [360, 375, 390, 430] as const
const DESKTOP_VIEWPORT = "width=1280"
// Below this width the app keeps the phone layout (tablets get the framed phone view).
const PC_MIN_WIDTH = 1024

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
// Temporary default while the PC layout is unfinished: on a computer the menu's developer option
// (phone frame) starts on. Switching it off in the menu is remembered.
const storedView = readStored(VIEW_KEY, Math.min(window.screen.width, window.screen.height) < 768 ? "auto" : "mobile")
let state: DevState = {
  view: storedView === "mobile" || storedView === "pc" ? storedView : "auto",
  width: Number(readStored(WIDTH_KEY, "390")) || 390,
  desktopViewport: false,
  layout: "mobile",
}

const layoutFor = (view: View): Layout =>
  view === "mobile" ? "mobile" : view === "pc" ? "pc" : window.innerWidth >= PC_MIN_WIDTH ? "pc" : "mobile"

function apply() {
  const root = document.documentElement
  root.dataset.view = state.view
  root.dataset.layout = state.layout
  root.style.setProperty("--preview-w", `${state.width}px`)
  if (viewportMeta) viewportMeta.content = state.desktopViewport ? DESKTOP_VIEWPORT : defaultViewport
  store(VIEW_KEY, state.view)
  store(WIDTH_KEY, String(state.width))
}

function setDevState(patch: Partial<DevState>) {
  const next = { ...state, ...patch }
  // The viewport meta change resizes the layout viewport, so apply it before measuring.
  state = next
  apply()
  state = { ...state, layout: layoutFor(state.view) }
  apply()
  listeners.forEach((listener) => listener())
  window.dispatchEvent(new Event("resize"))
}

state = { ...state, layout: layoutFor(state.view) }
apply()
window.addEventListener("resize", () => {
  const layout = layoutFor(state.view)
  if (layout === state.layout) return
  state = { ...state, layout }
  apply()
  listeners.forEach((listener) => listener())
})

export function useDevState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

export const useLayout = () => useDevState().layout

// Phones and small tablets report a short physical screen even when the page is laid out at desktop width.
export const isMobileDevice = () => Math.min(window.screen.width, window.screen.height) < 768

// Developer option in the menu: show the opposite layout (phone → PC page, PC → phone frame).
export const oppositeViewOn = (devState: DevState) => devState.desktopViewport || devState.view === "mobile"
export function setOppositeView(on: boolean) {
  if (isMobileDevice()) setDevState({ desktopViewport: on, view: "auto" })
  else setDevState({ desktopViewport: false, view: on ? "mobile" : "auto" })
}

// Developer-only viewport switcher. Shown in dev builds or with ?dev in the URL.
export function DevToolbar() {
  const enabled = import.meta.env.DEV || new URLSearchParams(window.location.search).has("dev")
  const devState = useDevState()
  if (!enabled) return null
  const options: [View, string, string][] = [
    ["auto", "자동", "화면 너비에 맞춰 보기"],
    ["mobile", "📱 모바일", "휴대폰 화면으로 보기"],
    ["pc", "🖥️ PC", "PC 화면으로 보기"],
  ]
  return (
    <div className="dev-toolbar" role="toolbar" aria-label="개발자 모드 화면 전환">
      <span className="dev-toolbar-title">개발자 모드</span>
      {options.map(([value, label, name]) => (
        <button key={value} type="button" aria-pressed={devState.view === value} aria-label={name} onClick={() => setDevState({ view: value })}>
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
