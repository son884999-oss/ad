// Gemini REST client for the AI functions.
// Adapted from E_이채원/src/gemini.js: generateContent over REST with the x-goog-api-key header,
// responseMimeType application/json, request timeouts, validated JSON output and error codes.
// The key is read from process.env on the server only and is never logged or returned.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { copaJson, getCopaConfig } from "./copa.js"
import { ApiError } from "./http.js"

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"

/**
 * Reads GEMINI_API_KEY / GEMINI_MODEL, the optional COPA_API_KEY (Claude, api/_lib/copa.js) and the optional
 * GEMINI_API_KEY_2 (paid, ₩500/day). Order in generateJson: COPA → free key → paid key.
 * Neither Gemini nor COPA configured → 503 AI_NOT_CONFIGURED.
 */
export function getGeminiConfig() {
  const copa = getCopaConfig()
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  const backupKey = process.env.GEMINI_API_KEY_2?.trim() || undefined
  const model = process.env.GEMINI_MODEL?.trim().replace(/^models\//, "")
  // A new Google project may not get the older models (404 "no longer available to new users"): the second key can
  // have its own model. Unset or malformed → the first key's model.
  const model2 = process.env.GEMINI_MODEL_2?.trim().replace(/^models\//, "")
  const backupModel = model2 && /^[a-zA-Z0-9._-]+$/.test(model2) ? model2 : model
  const gemini = apiKey && model && /^[a-zA-Z0-9._-]+$/.test(model)
  if (!gemini) {
    if (copa) return { copa }
    throw new ApiError(503, "AI_NOT_CONFIGURED")
  }
  const config = backupKey && backupKey !== apiKey ? { apiKey, model, backupKey, backupModel } : { apiKey, model }
  return copa ? { ...config, copa } : config
}

/**
 * The second key may be a paid key: it spends at most ₩500 a day (owner's rule: ₩100 on 2026-10-18, raised to ₩500 the same day). Each answer's cost
 * is estimated from its usageMetadata at list prices rounded up (USD per 1M tokens, ₩1,500 per dollar) and added
 * to a daily ledger: outputs/.gemini-key2-usage.json locally (gitignored), memory where the disk is read-only.
 * A call is only made while one more worst-case call (₩10) still fits.
 */
export const BACKUP_DAILY_LIMIT_KRW = 500
const BACKUP_CALL_RESERVE_KRW = 10
const KRW_PER_USD = 1500
const ledgerPath = () => process.env.GEMINI_KEY2_LEDGER || join(process.cwd(), "outputs", ".gemini-key2-usage.json")
let memoryLedger = { day: "", krw: 0 }

function pricesFor(model) {
  if (/pro/.test(model)) return { input: 2.5, output: 15 }
  if (/lite/.test(model)) return { input: 0.1, output: 0.4 }
  return { input: 0.5, output: 3 }
}

function today() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })
}

function readLedger() {
  let ledger = memoryLedger
  try {
    ledger = JSON.parse(readFileSync(ledgerPath(), "utf8"))
  } catch {
    // No file yet, or no disk: the memory copy counts.
  }
  return ledger.day === today() && Number.isFinite(ledger.krw) ? ledger : { day: today(), krw: 0 }
}

function addToLedger(krw) {
  const ledger = readLedger()
  memoryLedger = { day: ledger.day, krw: Math.round((ledger.krw + krw) * 100) / 100 }
  try {
    mkdirSync(dirname(ledgerPath()), { recursive: true })
    writeFileSync(ledgerPath(), JSON.stringify(memoryLedger))
  } catch {
    // Read-only disk: the memory copy still counts for this instance.
  }
}

/** ₩ spent today on the second key (estimate). */
export function backupSpentToday() {
  return readLedger().krw
}

function backupAllowed() {
  return backupSpentToday() + BACKUP_CALL_RESERVE_KRW <= BACKUP_DAILY_LIMIT_KRW
}

function costKrw(model, usage) {
  const { input, output } = pricesFor(model)
  const inTokens = Number(usage?.promptTokenCount) || 0
  const outTokens = (Number(usage?.candidatesTokenCount) || 0) + (Number(usage?.thoughtsTokenCount) || 0)
  // No usage reported: count the reserve so the cap can never be passed silently.
  if (!inTokens && !outTokens) return BACKUP_CALL_RESERVE_KRW
  return ((inTokens * input + outTokens * output) / 1_000_000) * KRW_PER_USD
}

/**
 * `temperature` is only sent to gemini-2.x models. Gemini 3.6+ ignores it ("no longer supported"),
 * and newer models may reject it, so for those the model's own default is used.
 */
export function supportsTemperature(model) {
  return String(model).startsWith("gemini-2")
}

/**
 * Builds generationConfig. `responseJsonSchema` is the REST field GenerationConfig.responseJsonSchema
 * (https://ai.google.dev/api/generate-content#GenerationConfig; responseMimeType is required with it).
 * Only its supported JSON Schema subset is used: type, properties, required, items, minItems/maxItems,
 * enum, description — no maxLength, so lengths stay checked in code.
 */
export function buildGenerationConfig({ model, temperature, maxOutputTokens, responseJsonSchema }) {
  const generationConfig = { responseMimeType: "application/json", maxOutputTokens }
  if (responseJsonSchema) generationConfig.responseJsonSchema = responseJsonSchema
  if (typeof temperature === "number" && supportsTemperature(model)) generationConfig.temperature = temperature
  return generationConfig
}

/**
 * Calls generateContent and returns the parsed JSON object the model wrote.
 * @param {{ config: {apiKey: string, model: string}, systemInstruction: string,
 *   parts: object[], timeoutMs?: number, temperature?: number, maxOutputTokens?: number,
 *   responseJsonSchema?: object }} options
 * maxOutputTokens caps cost; a cut-off answer (finishReason MAX_TOKENS) is rejected as AI_BAD_RESPONSE.
 * The schema only shapes the answer: callers still validate every field.
 */
export async function generateJson({ config, systemInstruction, parts, timeoutMs = 15_000, temperature = 0.7, maxOutputTokens = 1024, responseJsonSchema }) {
  const request = { systemInstruction, parts, timeoutMs, temperature, maxOutputTokens, responseJsonSchema }
  // Owner's order (2026-10-18): COPA (Claude, the institution's monthly tokens; it wrote the more concrete copy in a
  // side-by-side test) → free Gemini key → paid Gemini key (₩500/day).
  // Any failure (limit, error, timeout, bad answer) moves on to the next; the last error is the answer.
  const steps = [
    config.copa && (() => copaJson(config.copa, request)),
    config.apiKey && (() => geminiOnce(config.apiKey, config.model, request)),
    config.backupKey && (() => geminiBackup(config, request)),
  ].filter(Boolean)
  let lastError = new ApiError(503, "AI_NOT_CONFIGURED")
  for (const step of steps) {
    try {
      return await step()
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

/** One Gemini call with one key; `onOk` sees the raw answer before it is read. */
async function geminiOnce(apiKey, model, request, onOk) {
  const response = await requestOnce({ apiKey, model, ...request })
  if (response.status === 429) throw new ApiError(429, "AI_RATE_LIMITED")
  if (!response.ok) throw new ApiError(502, "AI_REQUEST_FAILED")
  if (onOk) await onOk(response)
  return readAnswer(response)
}

/** The second (paid) key: skipped, as if limited, once one more call would not fit in today's ₩ cap. */
async function geminiBackup(config, request) {
  if (!backupAllowed()) throw new ApiError(429, "AI_RATE_LIMITED")
  const model = config.backupModel ?? config.model
  return geminiOnce(config.backupKey, model, request, async (response) => {
    const usage = await response.clone().json().then((data) => data?.usageMetadata, () => undefined)
    addToLedger(costKrw(model, usage))
  })
}

/** One generateContent request with one key; returns the raw response. */
async function requestOnce({ apiKey, model, systemInstruction, parts, timeoutMs, temperature, maxOutputTokens, responseJsonSchema }) {

  let response
  try {
    response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts }],
        generationConfig: buildGenerationConfig({ model, temperature, maxOutputTokens, responseJsonSchema }),
      }),
    })
  } catch (error) {
    const name = error && typeof error === "object" ? error.name : ""
    throw new ApiError(name === "TimeoutError" || name === "AbortError" ? 504 : 502, name === "TimeoutError" || name === "AbortError" ? "AI_TIMEOUT" : "AI_REQUEST_FAILED")
  }
  return response
}

/** Reads and validates the model's JSON answer. */
async function readAnswer(response) {

  let result
  try {
    result = await response.json()
  } catch {
    throw new ApiError(502, "AI_BAD_RESPONSE")
  }
  if (result?.error) throw new ApiError(502, "AI_REQUEST_FAILED")
  const candidate = result?.candidates?.[0]
  if (result?.promptFeedback?.blockReason || (candidate?.finishReason && candidate.finishReason !== "STOP")) {
    throw new ApiError(502, "AI_BAD_RESPONSE")
  }
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part?.thought && typeof part?.text === "string")
    .map((part) => part.text)
    .join("")
    .trim()
  return parseModelJson(text)
}

/** Parses the model's JSON object; tolerates code fences or prose around it. */
export function parseModelJson(text) {
  if (typeof text !== "string" || !text) throw new ApiError(502, "AI_BAD_RESPONSE")
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end <= start) throw new ApiError(502, "AI_BAD_RESPONSE")
  let data
  try {
    data = JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new ApiError(502, "AI_BAD_RESPONSE")
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiError(502, "AI_BAD_RESPONSE")
  return data
}
