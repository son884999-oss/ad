// The demo access code for paid 고급형 jobs (api/_lib/paid.js, PREMIUM_ACCESS_CODE). The presenter opens the app
// once with ?demo=<code>; it is kept on this device and taken out of the address bar so a shared link or a
// screenshot does not carry it. Without a code the server answers as if paid generation were off.

const STORAGE_KEY = "hongboitda-premium-code"

function readCode(): string {
  if (typeof window === "undefined") return ""
  try {
    const url = new URL(window.location.href)
    const fromUrl = url.searchParams.get("demo")?.trim() ?? ""
    if (fromUrl) {
      try {
        window.localStorage.setItem(STORAGE_KEY, fromUrl)
      } catch {
        // Private mode: the code still works for this page.
      }
      url.searchParams.delete("demo")
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
      return fromUrl
    }
  } catch {
    // An odd address: fall back to what is stored.
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY)?.trim() ?? ""
  } catch {
    return ""
  }
}

const code = readCode()

/** Headers for /api/scene-start and /api/video-start. */
export function premiumHeaders(): Record<string, string> {
  return code ? { "x-premium-code": code } : {}
}
