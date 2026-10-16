// Gemini REST client for the AI functions.
// Adapted from E_이채원/src/gemini.js: generateContent over REST with the x-goog-api-key header,
// responseMimeType application/json, request timeouts, validated JSON output and error codes.
// The key is read from process.env on the server only and is never logged or returned.
import { ApiError } from "./http.js"

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"

/** Reads GEMINI_API_KEY / GEMINI_MODEL. Missing or malformed config → 503 AI_NOT_CONFIGURED. */
export function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  const model = process.env.GEMINI_MODEL?.trim().replace(/^models\//, "")
  if (!apiKey || !model || !/^[a-zA-Z0-9._-]+$/.test(model)) throw new ApiError(503, "AI_NOT_CONFIGURED")
  return { apiKey, model }
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
  let response
  try {
    response = await fetch(`${ENDPOINT}/${config.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
      signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts }],
        generationConfig: buildGenerationConfig({ model: config.model, temperature, maxOutputTokens, responseJsonSchema }),
      }),
    })
  } catch (error) {
    const name = error && typeof error === "object" ? error.name : ""
    throw new ApiError(name === "TimeoutError" || name === "AbortError" ? 504 : 502, name === "TimeoutError" || name === "AbortError" ? "AI_TIMEOUT" : "AI_REQUEST_FAILED")
  }
  if (response.status === 429) throw new ApiError(429, "AI_RATE_LIMITED")
  if (!response.ok) throw new ApiError(502, "AI_REQUEST_FAILED")

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
