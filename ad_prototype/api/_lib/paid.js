// Guards for the paid endpoints (scene-start, video-start) on a public deployment.
// - PREMIUM_ACCESS_CODE (optional): when set, a paid job starts only with the header x-premium-code equal to it.
//   The presenter opens the demo once with ?demo=<code> (src/premiumAccess.ts keeps it); everyone else gets the
//   free fallback, exactly as when paid generation is switched off (503 VIDEO_NOT_CONFIGURED).
// - DAILY_PAID_LIMIT (default 5, owner's rule 2026-10-18): paid jobs of each kind per Korean day. 0 turns paid
//   jobs off. The count lives in this function instance's memory, so it is a soft cap across instances: the
//   prepaid Higgsfield credit stays the hard one (see docs/배포_체크리스트.md for a shared counter).
import { timingSafeEqual } from "node:crypto"
import { ApiError } from "./http.js"

const DEFAULT_DAILY_LIMIT = 5

export function checkPremiumAccess(req) {
  const code = process.env.PREMIUM_ACCESS_CODE?.trim()
  if (!code) return
  const raw = req.headers?.["x-premium-code"]
  const sent = Buffer.from(String(Array.isArray(raw) ? raw[0] : raw ?? "").trim())
  const expected = Buffer.from(code)
  if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) throw new ApiError(503, "VIDEO_NOT_CONFIGURED")
}

export function dailyPaidLimit() {
  const value = Number(process.env.DAILY_PAID_LIMIT?.trim() || DEFAULT_DAILY_LIMIT)
  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_DAILY_LIMIT
}

const used = new Map()
const koreanDay = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })

/** Takes one of today's paid jobs of `kind`, or throws 429 VIDEO_DAILY_LIMIT. Returns a function that gives it back. */
export function reserveDailyPaid(kind) {
  const key = `${kind}:${koreanDay()}`
  for (const old of used.keys()) if (!old.endsWith(koreanDay())) used.delete(old)
  const count = used.get(key) ?? 0
  if (count >= dailyPaidLimit()) throw new ApiError(429, "VIDEO_DAILY_LIMIT")
  used.set(key, count + 1)
  let given = false
  return () => {
    if (given) return
    given = true
    used.set(key, Math.max(0, (used.get(key) ?? 1) - 1))
  }
}

/** Runs one paid start under today's cap; a start that fails (nothing charged) gives its place back. */
export async function withDailyPaid(kind, start) {
  const giveBack = reserveDailyPaid(kind)
  try {
    return await start()
  } catch (error) {
    giveBack()
    throw error
  }
}

/** For the checks only. */
export function resetPaidCounters() {
  used.clear()
}
