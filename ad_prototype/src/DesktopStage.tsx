// Mobile web app only (decided 2026-10-17). Phones get the full-screen mobile layout; tablets and
// computers show the same mobile app inside a phone frame. The developer viewport switcher and the
// PC layout were removed (see docs/나중에_할일.md [PC화면]).

export type Layout = "mobile"

// Phones and small tablets report a short physical screen even when the page is laid out at desktop width.
export const isMobileDevice = () => Math.min(window.screen.width, window.screen.height) < 768

const root = document.documentElement
root.dataset.layout = "mobile"
// html[data-view=mobile] draws the phone frame on screens 768px and wider (see reference-ui.css).
root.dataset.view = isMobileDevice() ? "auto" : "mobile"
root.style.setProperty("--preview-w", "390px")

export const useLayout = (): Layout => "mobile"
