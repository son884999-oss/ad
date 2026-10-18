// Claude through the institution's gateway (COPA, https://copa.codyssey.kr), Anthropic Messages API (/v1/messages).
// The issued key is an Anthropic-compatible key: the OpenAI-compatible /v1/chat/completions answers 403 for it
// (checked 2026-10-18). When COPA_API_KEY is set it is the second step for every AI function (photo, promo text,
// video direction): free Gemini key → COPA → paid Gemini key (api/_lib/gemini.js generateJson). Server-only, never logged.
import { ApiError } from "./http.js"
import { parseModelJson } from "./gemini.js"

const DEFAULT_BASE_URL = "https://copa.codyssey.kr"
const DEFAULT_MODEL = "claude-haiku-4"

/** COPA_API_KEY (+ optional COPA_MODEL, COPA_BASE_URL), or null when unset. */
export function getCopaConfig() {
  const apiKey = process.env.COPA_API_KEY?.trim()
  if (!apiKey) return null
  const model = process.env.COPA_MODEL?.trim() || DEFAULT_MODEL
  // Accept the base with or without /v1 (the console shows both forms).
  const baseUrl = (process.env.COPA_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "").replace(/\/v1$/, "")
  if (!/^[a-zA-Z0-9._:/-]+$/.test(model) || !/^https:\/\//.test(baseUrl)) return null
  return { apiKey, model, baseUrl }
}

/** Gemini parts → Anthropic content blocks: text stays text, inlineData becomes a base64 image block. */
export function toMessageContent(parts) {
  return parts.map((part) =>
    part.inlineData
      ? { type: "image", source: { type: "base64", media_type: part.inlineData.mimeType, data: part.inlineData.data } }
      : { type: "text", text: String(part.text ?? "") },
  )
}

/**
 * One Messages call that must answer with one JSON object. The schema goes into the system prompt; the answer is
 * parsed and every field is still checked by the caller. Korean takes more Claude tokens than Gemini tokens, so the
 * output cap is doubled.
 */
export async function copaJson(copa, { systemInstruction, parts, timeoutMs = 15_000, temperature = 0.7, maxOutputTokens = 1024, responseJsonSchema }) {
  const system = responseJsonSchema
    ? `${systemInstruction}\n\n출력: 설명이나 코드 블록 없이 아래 JSON Schema에 맞는 JSON 객체 하나만 출력한다.\n${JSON.stringify(responseJsonSchema)}`
    : `${systemInstruction}\n\n출력: 설명이나 코드 블록 없이 JSON 객체 하나만 출력한다.`
  let response
  try {
    response = await fetch(`${copa.baseUrl}/v1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": copa.apiKey, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
      body: JSON.stringify({
        model: copa.model,
        system,
        messages: [{ role: "user", content: toMessageContent(parts) }],
        max_tokens: maxOutputTokens * 2,
        temperature: Math.min(1, Math.max(0, temperature)),
      }),
    })
  } catch (error) {
    const name = error && typeof error === "object" ? error.name : ""
    const timeout = name === "TimeoutError" || name === "AbortError"
    throw new ApiError(timeout ? 504 : 502, timeout ? "AI_TIMEOUT" : "AI_REQUEST_FAILED")
  }
  if (response.status === 429) throw new ApiError(429, "AI_RATE_LIMITED")
  if (!response.ok) throw new ApiError(502, "AI_REQUEST_FAILED")
  let result
  try {
    result = await response.json()
  } catch {
    throw new ApiError(502, "AI_BAD_RESPONSE")
  }
  // A cut-off answer (max_tokens) is not valid JSON for the app: same rule as Gemini's MAX_TOKENS.
  if (result?.type === "error" || result?.stop_reason !== "end_turn") throw new ApiError(502, "AI_BAD_RESPONSE")
  const text = (result.content ?? []).filter((block) => block?.type === "text").map((block) => block.text).join("")
  return parseModelJson(text.trim())
}
