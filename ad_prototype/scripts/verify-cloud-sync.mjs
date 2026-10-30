// Two isolated browser devices and one shared fake Supabase. No real account, keys or AI calls.
// Run from ad_prototype: node scripts/verify-cloud-sync.mjs
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { chromium } from "playwright"

const SUPABASE = "https://sync-test.supabase.co"
const ownerId = "11111111-2222-4333-8444-555555555555"
const otherId = "99999999-8888-4777-8666-555555555555"
const user = (id = ownerId) => ({ id, email: id === ownerId ? "owner@example.com" : "other@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-10-30T00:00:00Z" })
const tokenFor = (id) => `header.${Buffer.from(JSON.stringify({ sub: id })).toString("base64url")}.sig`
const session = (id = ownerId) => ({ access_token: tokenFor(id), refresh_token: `refresh-${id}`, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: user(id) })
const idFrom = (request) => request.headers().authorization?.includes(tokenFor(otherId)) ? otherId : ownerId
const photo = readFileSync(resolve("public/assets/reference-fresh/coffee.webp"))
const photoUrl = `data:image/webp;base64,${photo.toString("base64")}`
const fixture = { id: "cross-device-record", createdAt: "10월 30일 오전 10:00", type: "poster", outputFormat: "poster", channel: "instagram", imageUrl: photoUrl, details: { name: "기기 간 저장 확인", shopName: "테스트 가게", description: "테스트용 커피 사진", features: "", audience: "", keywords: "", tones: [], posterRatio: "4:5", posterLayout: "vertical", posterTheme: "" }, userHashtags: { instagram: "", naver: "", carrot: "" } }
const backend = { rows: new Map(), calls: [], uploads: new Map(), reads: 0, signedGeneration: 0, failRead: false, failWrite: false, failSigned: false, holdRead: null, holdPhoto: null, photoReads: 0 }
const results = []
const wait = (ms) => new Promise((done) => setTimeout(done, ms))
async function until(fn, message, timeout = 15000) { const start = Date.now(); while (Date.now() - start < timeout) { if (await fn()) return; await wait(100) } throw new Error(message) }
async function check(name, fn) { await fn(); results.push(name); console.log("ok -", name) }
async function capture(page, path) {
  if (!process.env.CLOUD_SYNC_SCREENSHOTS) return
  if (process.env.CLOUD_SYNC_SCREENSHOT_FONT) {
    const font = readFileSync(process.env.CLOUD_SYNC_SCREENSHOT_FONT).toString("base64")
    await page.addStyleTag({ content: `@font-face{font-family:SyncQA;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900;font-display:block}.reference-app,.reference-app *{font-family:SyncQA,sans-serif!important}` })
    await page.evaluate(() => document.fonts.load('16px SyncQA'))
  }
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path })
}
let child, browser
const port = Number(process.env.CLOUD_SYNC_TEST_PORT || 5182)
const base = `http://127.0.0.1:${port}/`

async function startServer() {
  child = spawn(process.execPath, [resolve("node_modules/vite/bin/vite.js"), "--mode", "mock", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { env: { ...process.env, VITE_SUPABASE_URL: SUPABASE, VITE_SUPABASE_ANON_KEY: "test-anon-key", VITE_PHOTO_REVIEW_EXPERIMENTAL: "0" }, stdio: "ignore" })
  await until(() => fetch(base).then((r) => r.ok, () => false), "test dev server did not start", 30000)
}
async function device() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })
  const errors = []
  await context.route("**/*", async (route) => {
    const req = route.request(), url = new URL(req.url()), method = req.method()
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) })
    if (url.origin === SUPABASE) {
      const uid = idFrom(req)
      if (method === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } })
      if (url.pathname === "/auth/v1/token") { const body = req.postDataJSON(); return json(200, session(body.email === "other@example.com" ? otherId : ownerId)) }
      if (url.pathname === "/auth/v1/user") return json(200, user(uid))
      if (url.pathname === "/auth/v1/logout") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } })
      if (url.pathname === "/rest/v1/records") {
        if (method === "GET") {
          backend.reads += 1
          const held = backend.holdRead
          if (held) await held.promise
          if (backend.failRead) return json(503, { message: "simulated read failure" })
          return json(200, [...backend.rows.values()].filter((row) => row.user_id === uid))
        }
        backend.calls.push({ uid, method, body: req.postData() ? req.postDataJSON() : null, search: url.search })
        if (backend.failWrite) return json(503, { message: "simulated write failure" })
        if (method === "POST") { const row = req.postDataJSON(); assert.equal(row.user_id, uid, "write belongs to authenticated account"); backend.rows.set(row.id, { ...backend.rows.get(row.id), ...row }); return json(201, []) }
        if (method === "PATCH") { const id = url.searchParams.get("id")?.slice(3); const old = backend.rows.get(id); if (old?.user_id === uid) Object.assign(old, req.postDataJSON()); return json(200, []) }
        if (method === "DELETE") { const id = url.searchParams.get("id")?.slice(3); if (backend.rows.get(id)?.user_id === uid) backend.rows.delete(id); return json(200, []) }
      }
      if (url.pathname === "/storage/v1/object/sign/records" && method === "POST") {
        if (backend.failSigned) return json(503, { message: "simulated signed URL failure" })
        const generation = ++backend.signedGeneration
        return json(200, req.postDataJSON().paths.map((path) => ({ path, signedURL: `/object/sign/records/${path}?token=generation-${generation}`, error: null })))
      }
      if (url.pathname.startsWith("/storage/v1/object/sign/records/")) { if (req.resourceType() === "fetch") { backend.photoReads += 1; if (backend.holdPhoto) await backend.holdPhoto.promise } return route.fulfill({ status: 200, contentType: "image/webp", body: photo, headers: { "access-control-allow-origin": "*" } }) }
      if (url.pathname.startsWith("/storage/v1/object/records/") && ["POST", "PUT"].includes(method)) { backend.uploads.set(url.pathname, req.postDataBuffer()); return json(200, { Key: url.pathname }) }
      if (url.pathname === "/storage/v1/object/list/records") return json(200, [])
      if (url.pathname === "/storage/v1/object/records" && method === "DELETE") return json(200, [])
      return json(404, { message: `unstubbed ${method} ${url.pathname}` })
    }
    if (url.origin === new URL(base).origin) {
      if (url.pathname === "/__sync-seed") return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Test data setup</title>" })
      if (url.pathname.startsWith("/api/")) return json(503, { error: "AI_NOT_CONFIGURED" })
      return route.continue()
    }
    return route.abort() // external AI/fonts/analytics are never contacted
  })
  const page = await context.newPage()
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(base)
  await page.getByRole("button", { name: /메뉴/ }).first().waitFor()
  return { context, page, errors }
}
async function login(page, email = "owner@example.com") {
  await page.getByRole("button", { name: /메뉴/ }).first().click()
  await page.getByRole("button", { name: /로그인 · 회원가입/ }).click()
  await page.locator("#login-email").fill(email)
  await page.locator("#login-password").fill("password123")
  await page.getByRole("button", { name: "로그인", exact: true }).click()
  await page.getByRole("button", { name: /홍보물 만들기/ }).first().waitFor()
}
async function logout(page) { await page.getByRole("button", { name: /메뉴/ }).first().click(); await page.getByRole("button", { name: "로그아웃", exact: true }).click() }
async function recordsPage(page) { await page.locator(".studio-bottom-nav").getByRole("button", { name: "내 홍보물", exact: true }).click() }
async function localRecords(page) { return page.evaluate(() => new Promise((resolve, reject) => { const q = indexedDB.open("hongboitda", 1); q.onsuccess = () => { const r = q.result.transaction("records", "readonly").objectStore("records").getAll(); r.onsuccess = () => resolve(r.result); r.onerror = reject }; q.onerror = reject })) }
async function seed(page, record) { await page.goto(`${base}__sync-seed`); await page.evaluate((item) => new Promise((resolve, reject) => { const q = indexedDB.open("hongboitda", 1); q.onupgradeneeded = () => q.result.createObjectStore("records", { keyPath: "id" }); q.onsuccess = () => { const t = q.result.transaction("records", "readwrite"); t.objectStore("records").put(item); t.oncomplete = resolve; t.onerror = reject }; q.onerror = reject }), record); await page.goto(base); await page.getByRole("button", { name: /메뉴/ }).first().waitFor() }
function holdReads() { let release; const promise = new Promise((r) => { release = r }); backend.holdRead = { promise }; return () => { backend.holdRead = null; release() } }
const posts = () => backend.calls.filter((call) => call.method === "POST")

try {
  await startServer()
  browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : { channel: "msedge" }), args: process.env.PLAYWRIGHT_CHROMIUM_ARGS ? JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS) : [], headless: true })
  const a = await device(), b = await device()
  await seed(a.page, fixture)
  await check("device A: no upload or deletion before initial server load; local draft uploads after hydration", async () => {
    const release = holdReads(), before = backend.reads
    await login(a.page)
    await until(() => backend.reads > before, "cloud list not requested")
    await wait(1200)
    assert.equal(backend.calls.length, 0, "no record mutation before cloud list resolved")
    release()
    await until(() => backend.rows.has(fixture.id), "local draft was not saved to server")
    assert.ok(backend.rows.get(fixture.id).photo_path, "photo storage path saved")
    assert.ok(backend.uploads.size > 0, "photo uploaded")
  })
  await check("device B: empty browser same account reads A's stored record and a working signed photo", async () => {
    await login(b.page)
    await recordsPage(b.page)
    await b.page.getByText(fixture.details.name, { exact: true }).waitFor()
    const img = b.page.locator(".record-thumbnail img").first()
    await until(() => img.evaluate((e) => e.complete && e.naturalWidth > 0), "signed photo not displayed")
    assert.ok((await localRecords(b.page))[0].imageUrl.includes("token=generation-"))
  })
  await check("device B edit → device A restart refreshes existing ID details and signed URL without overwriting server", async () => {
    // Merely opening a result must not mark an unchanged record as a pending local edit.
    await recordsPage(a.page)
    await a.page.locator(".record-item").first().click()
    await wait(350)
    await recordsPage(a.page)
    assert.notEqual((await localRecords(a.page))[0].cloudPending, true, "no-op opening is not a local edit")
    await b.page.locator(".record-item").first().click()
    await b.page.getByRole("radio", { name: "스타일 3", exact: true }).click()
    await until(() => backend.rows.get(fixture.id)?.data.details.posterLayout === "card", "device B's changed style not saved")
    const before = posts().length
    await a.page.reload()
    await recordsPage(a.page)
    await until(async () => (await localRecords(a.page)).some((r) => r.id === fixture.id && r.details.posterLayout === "card" && r.imageUrl.includes("token=generation-")), "old device kept stale details or old photo URL")
    await wait(1600)
    assert.equal(posts().length, before, "hydration must not write stale or identical data back")
    assert.equal(backend.rows.get(fixture.id).data.details.posterLayout, "card")
    await capture(a.page, "/tmp/cloud-sync-ready.png")
  })
  await check("cloud list failure preserves local record, prevents mutations and offers explicit retry", async () => {
    backend.failRead = true
    const before = backend.calls.length
    await a.page.reload()
    await recordsPage(a.page)
    await a.page.getByRole("button", { name: "서버 연결 다시 시도", exact: true }).waitFor()
    assert.equal(await a.page.locator(".record-entry").count(), 1)
    await wait(1000)
    assert.equal(backend.calls.length, before)
    backend.failRead = false
    const oldUrl = (await localRecords(a.page))[0].imageUrl
    await a.page.getByRole("button", { name: "서버 연결 다시 시도", exact: true }).click()
    await until(async () => (await localRecords(a.page))[0]?.imageUrl !== oldUrl, "retry did not refresh signed photo URL")
  })
  await check("signed URL service failure preserves the list and retries fresh working photo links", async () => {
    backend.failSigned = true
    const before = backend.calls.length
    await a.page.reload()
    await recordsPage(a.page)
    await a.page.getByRole("button", { name: "서버 연결 다시 시도", exact: true }).waitFor()
    assert.equal(await a.page.locator(".record-entry").count(), 1, "failed signing does not hide the record")
    assert.equal(backend.calls.length, before, "failed signing cannot initiate cloud writes")
    backend.failSigned = false
    const oldUrl = (await localRecords(a.page))[0].imageUrl
    await a.page.getByRole("button", { name: "서버 연결 다시 시도", exact: true }).click()
    await until(async () => (await localRecords(a.page))[0]?.imageUrl !== oldUrl, "signed URL retry did not recover")
    await until(() => a.page.locator(".record-thumbnail img").evaluate((e) => e.complete && e.naturalWidth > 0), "retry picture is broken")
  })
  await check("failed local edit stays on device and explicit retry saves that edit", async () => {
    backend.failWrite = true
    await b.page.getByRole("radio", { name: "스타일 2", exact: true }).click()
    await recordsPage(b.page)
    await b.page.getByRole("button", { name: "서버 연결 다시 시도", exact: true }).waitFor()
    await capture(b.page, "/tmp/cloud-sync-failure.png")
    assert.equal((await localRecords(b.page))[0].details.posterLayout, "editorial")
    assert.equal(backend.rows.get(fixture.id).data.details.posterLayout, "card")
    backend.failWrite = false
    await b.page.getByRole("button", { name: "서버 연결 다시 시도", exact: true }).click()
    await until(() => backend.rows.get(fixture.id).data.details.posterLayout === "editorial", "retry discarded or did not upload the failed local edit")
  })
  await check("a failed guest-record upload is account-owned before another account can sign in", async () => {
    const c = await device()
    await seed(c.page, { ...fixture, id: "failed-guest-record", details: { ...fixture.details, name: "저장 실패 기록" } })
    backend.failWrite = true
    await login(c.page)
    await recordsPage(c.page)
    await c.page.getByRole("button", { name: "서버 연결 다시 시도", exact: true }).waitFor()
    assert.equal((await localRecords(c.page)).find((r) => r.id === "failed-guest-record")?.owner, ownerId, "failed record is claimed by original signed-in owner")
    await logout(c.page)
    backend.failWrite = false
    await login(c.page, "other@example.com")
    await recordsPage(c.page)
    await wait(1200)
    assert.equal(await c.page.locator(".record-entry").count(), 0)
    assert.equal(backend.calls.filter((call) => call.uid === otherId).length, 0)
    assert.deepEqual(c.errors, [])
  })
  await check("late photo download after sign-out cannot reopen the former owner's result", async () => {
    let release
    backend.holdPhoto = { promise: new Promise((r) => { release = r }) }
    const before = backend.photoReads
    await a.page.locator(".record-item").first().click()
    await until(() => backend.photoReads > before, "record photo download did not start")
    await logout(a.page)
    backend.holdPhoto = null
    release()
    await wait(1000)
    assert.equal(await a.page.locator("#result-poster-preview").count(), 0, "late picture completion did not reopen private result")
    await recordsPage(a.page)
    assert.equal(await a.page.locator(".record-entry").count(), 0)
    await login(a.page)
    await recordsPage(a.page)
    await a.page.getByText(fixture.details.name, { exact: true }).waitFor()
  })
  await check("sign-out and another account never show or reupload the previous owner's record", async () => {
    await logout(b.page)
    await recordsPage(b.page)
    assert.equal(await b.page.locator(".record-entry").count(), 0)
    await login(b.page, "other@example.com")
    await recordsPage(b.page)
    await wait(1200)
    assert.equal(await b.page.locator(".record-entry").count(), 0)
    assert.equal(backend.calls.filter((c) => c.uid === otherId).length, 0)
  })
  await check("late cloud response after sign-out cannot restore account records", async () => {
    const release = holdReads(), before = backend.reads
    await a.page.reload()
    await until(() => backend.reads > before, "delayed read did not begin")
    await logout(a.page)
    release()
    await recordsPage(a.page)
    await wait(1200)
    assert.equal(await a.page.locator(".record-entry").count(), 0)
    assert.equal(await a.page.locator("#result-poster-preview").count(), 0, "late cloud list cannot open a signed-out private result")
  })
  await check("explicit delete reaches the server and another device restart removes its clean local copy", async () => {
    await login(a.page)
    await recordsPage(a.page)
    await a.page.getByText(fixture.details.name, { exact: true }).waitFor()
    await logout(b.page)
    await login(b.page)
    await recordsPage(b.page)
    await b.page.getByText(fixture.details.name, { exact: true }).waitFor()
    b.page.once("dialog", (dialog) => dialog.accept())
    await b.page.getByRole("button", { name: `${fixture.details.name} 지우기`, exact: true }).click()
    await until(() => !backend.rows.has(fixture.id), "explicit deletion did not reach server")
    const before = posts().length
    await a.page.reload()
    await recordsPage(a.page)
    await until(async () => (await localRecords(a.page)).length === 0, "clean device copy resurrected a remotely deleted record")
    await wait(1200)
    assert.equal(posts().length, before, "remote deletion must not resurrect from old local copy")
    assert.equal(await a.page.locator(".record-entry").count(), 0)
  })
  for (const d of [a, b]) assert.deepEqual(d.errors, [], "no browser runtime errors")
  console.log(`PASS: verify-cloud-sync ${results.length} checks; two isolated browser devices, shared fake Supabase; real AI/account calls 0`)
} finally {
  await browser?.close()
  child?.kill()
}
