// Shared request/response helpers for the AI functions in api/.
// The leading underscore keeps this folder from being routed as a Vercel function.
// Handlers only use Node's plain req/res API so the same module runs on Vercel and
// inside the Vite dev middleware (vite.config.ts).

/** Upper bound for a JSON request body (Vercel's own request limit is 4.5 MB). */
export const MAX_BODY_BYTES = 4_500_000

export class ApiError extends Error {
  /** @param {number} status @param {string} code */
  constructor(status, code) {
    super(code)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

/** @param {import('node:http').ServerResponse} res @param {number} status @param {unknown} data */
export function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.end(JSON.stringify(data))
}

function headerValue(req, name) {
  const value = req.headers?.[name]
  return Array.isArray(value) ? value[0] : value
}

function parseObject(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new ApiError(400, "INVALID_JSON")
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiError(400, "INVALID_JSON")
  return data
}

/**
 * Reads a JSON object body. Accepts a body that Vercel already parsed (req.body) or reads the stream.
 * @param {any} req
 * @param {number} [limit]
 */
export async function readJsonBody(req, limit = MAX_BODY_BYTES) {
  const type = String(headerValue(req, "content-type") ?? "").split(";")[0].trim().toLowerCase()
  if (type !== "application/json") throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE")
  if (Number(headerValue(req, "content-length")) > limit) throw new ApiError(413, "PAYLOAD_TOO_LARGE")

  let preParsed
  try {
    preParsed = req.body // Vercel parses JSON lazily and throws on invalid JSON.
  } catch {
    throw new ApiError(400, "INVALID_JSON")
  }
  if (preParsed !== undefined && preParsed !== null) {
    if (typeof preParsed === "string" || Buffer.isBuffer(preParsed)) {
      if (Buffer.byteLength(preParsed) > limit) throw new ApiError(413, "PAYLOAD_TOO_LARGE")
      return parseObject(preParsed.toString())
    }
    if (typeof preParsed === "object" && !Array.isArray(preParsed)) return preParsed
    throw new ApiError(400, "INVALID_JSON")
  }

  const chunks = []
  let length = 0
  for await (const chunk of req) {
    length += chunk.length
    if (length > limit) throw new ApiError(413, "PAYLOAD_TOO_LARGE")
    chunks.push(Buffer.from(chunk))
  }
  if (!length) throw new ApiError(400, "INVALID_JSON")
  return parseObject(Buffer.concat(chunks).toString("utf8"))
}

/** Client address: the first X-Forwarded-For entry (Vercel sets it), else the socket. "" when unknown. */
export function clientAddress(req) {
  const forwarded = String(headerValue(req, "x-forwarded-for") ?? "").split(",")[0].trim()
  return forwarded || req.socket?.remoteAddress || ""
}

/**
 * Browsers send Origin on POST. A request from another site's page is refused, so other sites cannot
 * spend our AI quota through visitors' browsers. Requests without Origin (scripts) are left to the rate limit.
 * ALLOWED_ORIGINS (comma separated) adds origins such as a custom domain.
 */
export function checkOrigin(req) {
  const origin = String(headerValue(req, "origin") ?? "")
  if (!origin) return
  const allowed = String(process.env.ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean)
  let host = ""
  try {
    host = new URL(origin).host
  } catch {
    throw new ApiError(403, "FORBIDDEN_ORIGIN")
  }
  if (host === headerValue(req, "host") || allowed.includes(origin)) return
  throw new ApiError(403, "FORBIDDEN_ORIGIN")
}

// Per-address sliding window, per function instance (memory only). It stops casual loops; a determined
// attacker spreads over instances, so production should also add a Vercel Firewall rate-limit rule.
const recentCalls = new Map()
export function checkRateLimit(req, bucket, perMinute) {
  const address = clientAddress(req)
  if (!address || !perMinute) return
  const key = `${bucket}:${address}`
  const now = Date.now()
  const calls = (recentCalls.get(key) ?? []).filter((time) => now - time < 60_000)
  if (calls.length >= perMinute) {
    recentCalls.set(key, calls)
    throw new ApiError(429, "RATE_LIMITED")
  }
  calls.push(now)
  recentCalls.set(key, calls)
  if (recentCalls.size > 5_000) recentCalls.delete(recentCalls.keys().next().value)
}

/**
 * Wraps a POST-only JSON endpoint. `prepare` runs before the body is read (config checks),
 * `run` receives the parsed body and returns the JSON to send with 200.
 * `perMinute` caps calls per client address and minute (0 = no cap).
 * @param {{ prepare?: () => any, run: (body: any, context: any) => Promise<unknown>, bucket?: string, perMinute?: number }} options
 */
export function createJsonHandler({ prepare, run, bucket = "api", perMinute = 20 }) {
  return async function handler(req, res) {
    try {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST")
        throw new ApiError(405, "METHOD_NOT_ALLOWED")
      }
      checkOrigin(req)
      checkRateLimit(req, bucket, perMinute)
      const context = prepare ? prepare() : undefined
      const body = await readJsonBody(req)
      sendJson(res, 200, await run(body, context))
    } catch (error) {
      if (error instanceof ApiError) {
        sendJson(res, error.status, { error: error.code })
        return
      }
      // Never log request bodies or headers: they may hold photos, user text or keys.
      console.error("[api] unexpected error:", error instanceof Error ? error.name : typeof error)
      sendJson(res, 500, { error: "INTERNAL_ERROR" })
    }
  }
}

/**
 * Trims a string and caps it at `max` characters; anything else becomes "".
 * With `keepLines`, single line breaks survive (SNS copy), otherwise all whitespace collapses.
 */
export function cleanText(value, max, keepLines = false) {
  if (typeof value !== "string") return ""
  const normalized = keepLines
    ? value.replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n")
    : value.replace(/\s+/g, " ")
  return Array.from(normalized.trim()).slice(0, max).join("").trim()
}
