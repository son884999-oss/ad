// Claude through the institution's OpenAI-compatible gateway (COPA, https://copa.codyssey.kr/v1/chat/completions).
// When COPA_API_KEY is set it is the second step for every AI function (photo, promo text, video direction):
// free Gemini key → COPA → paid Gemini key (api/_lib/gemini.js generateJson). Server-only, never logged.
import { ApiError } from "./http.js"
import { parseModelJson } from "./gemini.js"

const DEFAULT_BASE_URL = "https://copa.codyssey.kr/v1"
const DEFAULT_MODEL = "claude-haiku-4"

/** COPA_API_KEY (+ optional COPA_MODEL, COPA_BASE_URL), or null when unset. */
export function getCopaConfig() {
  const apiKey = process.env.COPA_API_KEY?.trim()
  if (!apiKey) return null
  const model = process.env.COPA_MODEL?.trim() || DEFAULT_MODEL
  const baseUrl = (process.env.COPA_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "")
  if (!/^[a-zA-Z0-9._:/-]+$/.test(model) || !/^https:\/\//.test(baseUrl)) return null
  return { apiKey, model, baseUrl }
}

/** Gemini parts → OpenAI chat content: text stays text, inlineData becomes a base64 data URL image. */
export function toChatContent(parts) {
  return parts.map((part) =>
    part.inlineData
      ? { type: "image_url", image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` } }
      : { type: "text", text: String(part.text ?? "") },
  )
}

/**
 * One chat completion that must answer with one JSON object. The schema goes into the system prompt (the gateway
 * may not support response_format json_schema); the answer is parsed and every field is still checked by the caller.
 * Korean takes more Claude tokens than Gemini tokens, so the output cap is doubled.
 */
export async function copaJson(copa, { systemInstruction, parts, timeoutMs = 15_000, temperature = 0.7, maxOutputTokens = 1024, responseJsonSchema }) {
  const system = responseJsonSchema
    ? `${systemInstruction}\n\n출력: 설명이나 코드 블록 없이 아래 JSON Schema에 맞는 JSON 객체 하나만 출력한다.\n${JSON.stringify(responseJsonSchema)}`
    : `${systemInstruction}\n\n출력: 설명이나 코드 블록 없이 JSON 객체 하나만 출력한다.`
  let response
  try {
    response = await fetch(`${copa.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${copa.apiKey}` },
      signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
      body: JSON.stringify({
        model: copa.model,
        messages: [{ role: "system", content: system }, { role: "user", content: toChatContent(parts) }],
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
  const choice = result?.choices?.[0]
  // A cut-off answer ("length") is not valid JSON for the app: same rule as Gemini's MAX_TOKENS.
  if (!choice || (choice.finish_reason && !["stop", "end_turn"].includes(choice.finish_reason))) throw new ApiError(502, "AI_BAD_RESPONSE")
  const content = choice.message?.content
  const text = Array.isArray(content) ? content.map((part) => part?.text ?? "").join("") : content
  return parseModelJson(typeof text === "string" ? text.trim() : "")
}
