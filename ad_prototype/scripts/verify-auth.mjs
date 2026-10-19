// Verifies 회원가입·로그인 and 내 홍보물 on the server without a real Supabase project: account deletion with a
// stubbed admin client, then the app on its own dev server (port 5176) built with a fake Supabase address whose
// auth, database and storage calls are answered here. Usage: node scripts/verify-auth.mjs
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { Readable } from "node:stream"
import { resolve } from "node:path"
import { chromium } from "playwright"
import accountDelete, { deleteAccountFor } from "../api/account-delete.js"

const results = []
async function check(name, fn) {
  await fn()
  results.push(name)
  console.log("ok -", name)
}

// ---------- Part 1: 회원 탈퇴 on the server ----------
function fakeAdmin({ validToken = "owner-token", userId = "user-1" } = {}) {
  const calls = []
  const files = { [userId]: [{ name: "rec-1" }, { name: "rec-2" }], [`${userId}/rec-1`]: [{ name: "photo.jpg" }, { name: "poster.png" }], [`${userId}/rec-2`]: [{ name: "video.mp4" }] }
  return {
    calls,
    auth: {
      getUser: async (token) => (token === validToken ? { data: { user: { id: userId } }, error: null } : { data: { user: null }, error: new Error("bad") }),
      admin: { deleteUser: async (id) => { calls.push(["deleteUser", id]); return { error: null } } },
    },
    storage: { from: () => ({ list: async (prefix) => ({ data: files[prefix] ?? [] }), remove: async (paths) => { calls.push(["remove", ...paths]); return { error: null } } }) },
    from: () => ({ delete: () => ({ eq: async (column, value) => { calls.push(["deleteRows", column, value]); return { error: null } } }) }),
  }
}
function request(headers = {}) {
  const req = Readable.from([Buffer.from("{}")])
  req.method = "POST"
  req.headers = { "content-type": "application/json", "content-length": "2", ...headers }
  return req
}
async function call(handler, req) {
  const res = { statusCode: 200, headers: {}, body: "", setHeader(k, v) { this.headers[k.toLowerCase()] = v }, end(b) { this.body = b ?? "" } }
  await handler(req, res)
  return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null }
}

await check("탈퇴: the owner's own token removes their files, rows and account — nobody else's", async () => {
  const admin = fakeAdmin()
  assert.deepEqual(await deleteAccountFor("owner-token", admin), { deleted: true })
  assert.deepEqual(admin.calls, [
    ["remove", "user-1/rec-1/photo.jpg", "user-1/rec-1/poster.png", "user-1/rec-2/video.mp4"],
    ["deleteRows", "user_id", "user-1"],
    ["deleteUser", "user-1"],
  ])
  const other = fakeAdmin()
  await assert.rejects(deleteAccountFor("someone-else", other), (e) => e.status === 401)
  assert.deepEqual(other.calls, [], "a wrong token deletes nothing")
})

await check("탈퇴 handler: not set up → 503 AUTH_NOT_CONFIGURED; no token → 401", async () => {
  delete process.env.SUPABASE_URL
  delete process.env.VITE_SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  assert.deepEqual((await call(accountDelete, request({ authorization: "Bearer x" }))).json, { error: "AUTH_NOT_CONFIGURED" })
  process.env.SUPABASE_URL = "https://fake-project.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
  assert.deepEqual((await call(accountDelete, request())).json, { error: "SIGNED_OUT" })
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
})

// ---------- Part 2: the app with a fake Supabase ----------
const SUPABASE = "https://fake-project.supabase.co"
// Two dev servers of our own: one with a fake Supabase, one with sign-in switched off (empty values win over
// .env.local, so the owner's real keys never matter here).
async function devServer(port, env) {
  const child = spawn(process.execPath, [resolve("node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { env: { ...process.env, ...env }, stdio: "ignore" })
  const url = `http://127.0.0.1:${port}/`
  for (let i = 0; i < 60; i += 1) {
    if (await fetch(url).then((r) => r.ok, () => false)) break
    await new Promise((done) => setTimeout(done, 500))
  }
  return { child, url }
}
const configured = await devServer(5176, { VITE_SUPABASE_URL: SUPABASE, VITE_SUPABASE_ANON_KEY: "test-anon-key" })
const offline = await devServer(5177, { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" })
const base = configured.url

const user = { id: "11111111-2222-3333-4444-555555555555", email: "owner@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
const session = () => ({ access_token: "header.eyJzdWIiOiIxMTExIn0.sig", refresh_token: "refresh", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user })
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
  await check("browser: 회원가입 (two passwords, 만 14세, 개인정보 동의) → signed in, the menu shows the account", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    const seen = { signup: 0, upsert: [], uploads: [], logout: 0, patches: [] }
    await page.route("**/api/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"AI_NOT_CONFIGURED"}' }))
    await page.route(`${SUPABASE}/**`, async (route) => {
      const url = new URL(route.request().url())
      const method = route.request().method()
      const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) })
      if (method === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } })
      if (url.pathname === "/auth/v1/signup") {
        seen.signup += 1
        return json(200, session())
      }
      if (url.pathname === "/auth/v1/user") return json(200, user)
      if (url.pathname === "/auth/v1/logout") {
        seen.logout += 1
        return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } })
      }
      if (url.pathname === "/rest/v1/records" && method === "GET") return json(200, [])
      if (url.pathname === "/rest/v1/records" && method === "POST") {
        seen.upsert.push(route.request().postDataJSON())
        return json(201, [])
      }
      if (url.pathname === "/rest/v1/records" && method === "PATCH") {
        seen.patches.push(route.request().postDataJSON())
        return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } })
      }
      if (url.pathname.startsWith("/storage/v1/object/records/")) {
        seen.uploads.push(url.pathname.replace("/storage/v1/object/records/", ""))
        return json(200, { Key: url.pathname })
      }
      return json(404, { message: "not stubbed" })
    })
    await page.goto(base)
    await page.getByRole("button", { name: /메뉴/ }).first().click()
    await page.getByRole("button", { name: /로그인 · 회원가입/ }).click()
    await page.getByRole("button", { name: "회원가입", exact: true }).click()
    await page.getByRole("heading", { name: "회원가입" }).waitFor()
    await page.locator("#login-email").fill("owner@example.com")
    await page.locator("#login-password").fill("password123")
    await page.locator("#login-password2").fill("password123")
    // Consents are required.
    await page.getByRole("button", { name: "가입하기" }).click()
    await page.getByText("필수 항목에 동의해 주세요.").waitFor()
    assert.equal(seen.signup, 0)
    await page.locator("#login-age").check()
    await page.locator("#login-privacy").check()
    await page.getByText("개인정보 처리방침 보기").click()
    await page.getByText(/개인정보 보호책임자/).waitFor()
    await page.getByRole("button", { name: "가입하기" }).click()
    await page.getByRole("button", { name: /홍보물 만들기/ }).first().waitFor()
    assert.equal(seen.signup, 1)
    await page.getByRole("button", { name: /메뉴/ }).first().click()
    await page.getByText("owner@example.com").waitFor()
    assert.ok(await page.getByRole("button", { name: "로그아웃" }).isVisible())
    assert.ok(await page.getByRole("button", { name: "회원 탈퇴" }).isVisible())
    await page.getByRole("button", { name: /닫기/ }).first().click()

    // A creation goes to the server: the row, then the photo and the poster.
    await page.getByRole("button", { name: "홍보물 만들기", exact: true }).first().click()
    await page.locator("#product-photo").setInputFiles(resolve("public/assets/reference-fresh/coffee.webp"))
    await page.getByRole("button", { name: "다음으로", exact: true }).click()
    await page.getByRole("dialog").getByRole("button", { name: /그대로/ }).click()
    await page.getByLabel("제품 이름", { exact: true }).fill("하트 카페라테")
    await page.getByRole("button", { name: "홍보물 만들기", exact: true }).click()
    await page.locator("#result-poster-preview img").waitFor({ timeout: 30000 })
    for (let waited = 0; (seen.upsert.length < 1 || !seen.patches.some((p) => String(p.poster_path ?? "").endsWith("/poster.png"))) && waited < 20000; waited += 250) await page.waitForTimeout(250)
    const row = seen.upsert[0]
    assert.ok(row && row.user_id === user.id && row.data?.details?.name === "하트 카페라테", "record row with the owner")
    assert.ok(!JSON.stringify(row.data).includes("data:image"), "pictures are files, not in the row")
    assert.ok(seen.uploads.some((p) => p === `${user.id}/${row.id}/photo.jpg` || p === `${user.id}/${row.id}/photo.webp`), `photo uploaded: ${seen.uploads}`)
    assert.ok(seen.uploads.some((p) => p === `${user.id}/${row.id}/poster.png`), `poster uploaded: ${seen.uploads}`)
    assert.ok(seen.patches.some((p) => p.poster_path === `${user.id}/${row.id}/poster.png`), "poster path saved on the row")

    // Signing out takes the account's records off this device.
    await page.getByRole("button", { name: /내 홍보물/ }).first().click()
    await page.getByText("하트 카페라테").first().waitFor()
    await page.getByRole("button", { name: /메뉴/ }).first().click()
    await page.getByRole("button", { name: "로그아웃" }).click()
    await page.waitForTimeout(800)
    assert.equal(await page.getByText("하트 카페라테").count(), 0, "signed out: the account's records are gone from this device")
    assert.deepEqual(errors, [])
    await page.close()
  })

  await check("browser: not set up → the login buttons say 준비 중 and 바로 시작하기 works (as before)", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.route("**/api/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }))
    await page.goto(offline.url)
    await page.getByRole("button", { name: /메뉴/ }).first().click()
    await page.getByRole("button", { name: /로그인 · 회원가입/ }).click()
    await page.getByRole("button", { name: "카카오로 시작하기" }).click()
    await page.getByText(/준비 중/).waitFor()
    await page.getByRole("button", { name: /바로 시작하기/ }).click()
    await page.getByRole("button", { name: /홍보물 만들기/ }).first().waitFor()
    await page.close()
  })
} finally {
  await browser.close()
  configured.child.kill()
  offline.child.kill()
}
console.log(`PASS: verify-auth ${results.length} checks (account deletion, sign-up, records on the server, sign-out; fake Supabase)`)
