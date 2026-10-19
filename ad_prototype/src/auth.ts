// 회원가입·로그인 (Supabase Auth, 2026-10-19): 카카오, Google, 이메일+비밀번호. Without VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY the app behaves as before (login buttons say 준비 중, 바로 시작하기 works). The anon key is
// public by design; every table and file is protected by row-level security (docs/supabase/schema.sql).
import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } }) : null
export const authConfigured = Boolean(supabase)

export type AuthState = { session: Session | null; user: User | null; ready: boolean }

/** The signed-in user (null when signed out or when sign-in is not set up). `ready` once the first check is done. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ session: null, user: null, ready: !supabase })
  useEffect(() => {
    if (!supabase) return
    let live = true
    void supabase.auth.getSession().then(({ data }) => {
      if (live) setState({ session: data.session, user: data.session?.user ?? null, ready: true })
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, user: session?.user ?? null, ready: true })
    })
    return () => {
      live = false
      data.subscription.unsubscribe()
    }
  }, [])
  return state
}

/** Plain Korean for the errors an owner can act on; anything else is a general retry message. */
export function authErrorMessage(error: unknown) {
  const text = String((error as { message?: string })?.message ?? error ?? "")
  if (/Invalid login credentials/i.test(text)) return "이메일이나 비밀번호가 맞지 않아요."
  if (/Email not confirmed/i.test(text)) return "가입 확인 메일의 링크를 먼저 눌러 주세요."
  if (/already registered|already been registered/i.test(text)) return "이미 가입된 이메일이에요. 로그인해 주세요."
  if (/Password should be at least|weak password/i.test(text)) return "비밀번호는 8자 이상으로 정해 주세요."
  if (/rate limit|too many/i.test(text)) return "잠시 뒤에 다시 해 주세요."
  if (/invalid.*email|Unable to validate email/i.test(text)) return "이메일 주소를 다시 확인해 주세요."
  return "잠시 문제가 있어요. 다시 해 주세요."
}

export type SocialProvider = "kakao" | "google"

/** Leaves for the provider's page and comes back to this address signed in. */
export async function signInWithProvider(provider: SocialProvider) {
  if (!supabase) throw new Error("not-configured")
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}${location.pathname}` } })
  if (error) throw error
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error("not-configured")
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/** Returns "signed-in" when the project does not ask for an e-mail check, else "check-email". */
export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) throw new Error("not-configured")
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}${location.pathname}` } })
  if (error) throw error
  return data.session ? "signed-in" : "check-email"
}

export async function signOut() {
  await supabase?.auth.signOut()
}

/** Deletes the account and everything saved for it (api/account-delete.js, with the user's own token). */
export async function deleteAccount() {
  if (!supabase) throw new Error("not-configured")
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("signed-out")
  const response = await fetch("/api/account-delete", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}" })
  if (!response.ok) throw new Error(`HTTP_${response.status}`)
  await supabase.auth.signOut()
}
