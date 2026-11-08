// Offline regression: never reads credentials and never sends a network request.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateJson } from '../api/_lib/gemini.js'
import { generatePromo, normalizePromoInput } from '../api/_lib/promo.js'

const temp = mkdtempSync(join(tmpdir(), 'promo-deadline-'))
const realFetch = globalThis.fetch
const realTimeout = AbortSignal.timeout
const oldLedger = process.env.GEMINI_KEY2_LEDGER
process.env.GEMINI_KEY2_LEDGER = join(temp, 'mock-ledger.json')
const config = { copa: { apiKey: 'mock-copa', model: 'mock', baseUrl: 'https://mock.invalid' }, apiKey: 'mock-free', backupKey: 'mock-paid', model: 'mock' }
let count = 0
const good = { copy: '딸기 알갱이가 톡, 우리밭 딸기잼', sns: '토스트에 발라 드셔 보세요.', intro: '아침 식탁에 곁들이는 딸기잼입니다.', hashtags: ['딸기잼', '토스트', '아침식사'] }
async function scenario(name, plan, { budget = 24_000, legacy = false, promo = false, validateResult, settings = config } = {}, verify) {
  let elapsed = 0
  const calls = []
  const limits = new WeakMap()
  AbortSignal.timeout = (ms) => { const signal = new AbortController().signal; limits.set(signal, ms); return signal }
  globalThis.fetch = async (url, init) => {
    const step = plan[calls.length]
    assert.ok(step, `unexpected extra provider request in ${name}`)
    const cap = limits.get(init.signal)
    const provider = String(url).includes('mock.invalid') ? 'copa' : init.headers['x-goog-api-key'] === 'mock-paid' ? 'paid' : 'free'
    calls.push({ provider, cap })
    elapsed += step.kind === 'timeout' ? cap : (step.ms ?? 100)
    if (step.kind === 'timeout') throw new DOMException('mock timeout', 'TimeoutError')
    if (step.kind === '429') return new Response('{}', { status: 429 })
    if (step.kind === '500') return new Response('{}', { status: 500 })
    const text = step.kind === 'bad' ? 'not JSON' : JSON.stringify(step.data ?? (promo ? good : { ok: true }))
    const body = provider === 'copa' ? { type: 'message', stop_reason: 'end_turn', content: [{ type: 'text', text }] } : { candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } }
    return new Response(JSON.stringify(body), { status: 200 })
  }
  let value, error
  try {
    value = promo ? await generatePromo(normalizePromoInput({ productName: '우리밭 딸기잼', channel: 'instagram' }), settings, { now: () => elapsed }) : await generateJson({ config: settings, systemInstruction: 'mock', parts: [{ text: 'mock' }], timeoutMs: 16_000, validateResult, ...(legacy ? {} : { remainingMs: () => budget - elapsed }) })
  } catch (e) { error = e }
  verify({ value, error, elapsed, calls })
  count++
  console.log(`ok - ${name}`)
}

try {
  await scenario('primary success does not call fallbacks', [{ kind: 'ok' }], {}, ({ value, calls }) => { assert.equal(value.ok, true); assert.deepEqual(calls.map(x => x.provider), ['copa']) })
  await scenario('slow COPA leaves a usable free-key window', [{ kind: 'timeout' }, { kind: 'ok', ms: 5_000 }], {}, ({ value, elapsed, calls }) => { assert.equal(value.ok, true); assert.equal(elapsed, 17_000); assert.deepEqual(calls.map(x => x.cap), [12_000, 6_000]) })
  await scenario('paid fallback succeeds within the same 24-second budget', [{ kind: 'timeout' }, { kind: 'timeout' }, { kind: 'ok', ms: 5_000 }], {}, ({ value, elapsed, calls }) => { assert.equal(value.ok, true); assert.equal(elapsed, 23_000); assert.deepEqual(calls.map(x => x.provider), ['copa', 'free', 'paid']) })
  await scenario('all providers timing out stops at 24 seconds', [{ kind: 'timeout' }, { kind: 'timeout' }, { kind: 'timeout' }], {}, ({ error, elapsed, calls }) => { assert.equal(error.code, 'AI_TIMEOUT'); assert.equal(elapsed, 24_000); assert.deepEqual(calls.map(x => x.cap), [12_000, 6_000, 6_000]) })
  await scenario('quota errors preserve provider order and fallback', [{ kind: '429' }, { kind: '429' }, { kind: 'ok' }], {}, ({ value, calls }) => { assert.equal(value.ok, true); assert.equal(calls.length, 3) })
  await scenario('bad JSON advances to the next provider', [{ kind: 'bad' }, { kind: 'ok' }], {}, ({ value, calls }) => { assert.equal(value.ok, true); assert.equal(calls.length, 2) })
  await scenario('valid JSON with missing result fields advances to fallback', [{ kind: 'ok', data: {} }, { kind: 'ok' }], { validateResult: data => data.ok === true }, ({ value, calls }) => { assert.equal(value.ok, true); assert.deepEqual(calls.map(x => x.provider), ['copa', 'free']) })
  await scenario('sub-second remaining budget is not stretched to one second', [{ kind: 'timeout' }, { kind: 'timeout' }, { kind: 'timeout' }], { budget: 500 }, ({ error, elapsed }) => { assert.equal(error.code, 'AI_TIMEOUT'); assert.equal(elapsed, 500) })
  await scenario('expired deadline starts no provider request', [], { budget: 0 }, ({ error, calls }) => { assert.equal(error.code, 'AI_TIMEOUT'); assert.equal(calls.length, 0) })
  await scenario('non-promo callers preserve existing per-provider timeout', [{ kind: 'timeout' }, { kind: 'ok' }], { legacy: true }, ({ value, calls }) => { assert.equal(value.ok, true); assert.deepEqual(calls.map(x => x.cap), [16_000, 16_000]) })
  await scenario('answer arriving after the shared deadline is rejected', [{ kind: 'ok', ms: 25_000 }], { settings: { copa: config.copa } }, ({ error }) => { assert.equal(error.code, 'AI_TIMEOUT') })
  await scenario('quality rewrite receives remaining time rather than a new deadline', [{ kind: 'ok', data: {}, ms: 16_000 }, { kind: 'ok', ms: 1_000 }], { promo: true, settings: { copa: config.copa } }, ({ value, error, calls, elapsed }) => { assert.ifError(error); assert.ok(value.sns); assert.deepEqual(calls.map(x => x.cap), [16_000, 8_000]); assert.equal(elapsed, 17_000) })
  // Exercise real AbortSignal timers too: the fake provider hangs until its assigned signal aborts.
  AbortSignal.timeout = realTimeout
  const started = Date.now()
  let abortCalls = 0
  globalThis.fetch = async (_url, { signal }) => {
    abortCalls++
    return new Promise((_, reject) => {
      if (signal.aborted) reject(signal.reason)
      else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
  }
  const keepAlive = setTimeout(() => {}, 1_000)
  try {
    await assert.rejects(generateJson({ config, systemInstruction: 'mock', parts: [{ text: 'mock' }], remainingMs: () => 120 - (Date.now() - started) }), e => e.code === 'AI_TIMEOUT')
    assert.ok(Date.now() - started < 500, 'hanging providers must actually abort within the shared deadline')
    assert.ok(abortCalls >= 1 && abortCalls <= 3)
    count++
    console.log('ok - real abort timers stop hanging providers within a shared 120 ms budget')
  } finally { clearTimeout(keepAlive) }
  console.log(`PASS: ${count} deadline regressions; external network requests 0`)
} finally {
  globalThis.fetch = realFetch
  AbortSignal.timeout = realTimeout
  if (oldLedger === undefined) delete process.env.GEMINI_KEY2_LEDGER
  else process.env.GEMINI_KEY2_LEDGER = oldLedger
  rmSync(temp, { recursive: true, force: true })
}
