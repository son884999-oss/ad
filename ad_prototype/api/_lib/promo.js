// Ported from B_이창훈/promo.mjs — input normalisation, response parsing, the automatic quality
// review (상투어·의학 표현·설명 되풀이·해시태그 길이) and the one-time rewrite. Uses Gemini
// (./gemini.js) instead of the Claude SDK and works within a time budget so the UI never waits long.
import { ApiError, cleanText } from "./http.js"
import { generateJson } from "./gemini.js"
import { CHANNEL_STYLES, CLICHE_WORDS, MEDICAL_WORDS, PROMO_SYSTEM_PROMPT, buildPromoUserPrompt, buildRetryNote } from "./promo-prompt.js"
import { TONE_NAMES, cleanTones } from "./tones.js"

const HASHTAG_MIN = 4
const HASHTAG_MAX = 6
const HASHTAG_MAX_LENGTH = 10
/** 제품 설명과 이 글자 수 이상 똑같이 이어지면 "되풀이"로 본다 (띄어쓰기·문장부호 제외) */
const REPEAT_LIMIT = 12
/** Whole request budget; the client stops waiting at about 12 s. */
const TOTAL_BUDGET_MS = 11_000
/** A rewrite is only attempted when at least this much of the budget is left. */
const RETRY_MIN_MS = 5_000

/** Field limits mirror the form (src/App.tsx). Over-long values are rejected, not cut. */
const LIMITS = {
  productName: 50, shopName: 30, productDescription: 500, highlights: 1000, targetAudience: 200,
  location: 60, priceInfo: 60, contact: 60,
}
/** copyCandidates: B's three one-line angles; longer lines are dropped (not cut mid-sentence). */
const CANDIDATE_MAX = 3
const CANDIDATE_MAX_LENGTH = 60
/** Video caption (A_손용범 sample-push.json "headline") and call to action ("cta"). */
const HEADLINE_MAX_LENGTH = 16
const CTA_MAX_LENGTH = 14

function optionalText(body, field) {
  const value = body[field]
  if (value === undefined || value === null) return ""
  if (typeof value !== "string") throw new ApiError(400, "INVALID_INPUT")
  const text = cleanText(value, Infinity)
  if (Array.from(text).length > LIMITS[field]) throw new ApiError(400, "INVALID_INPUT")
  return text
}

/** 문자열 또는 문자열 배열을 한 줄 문자열로 정리 (C 입력폼의 keyFeatures는 배열) */
function featureText(value) {
  if (value === undefined || value === null) return ""
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : null
  if (!list || !list.every((item) => typeof item === "string") || list.length > 20) throw new ApiError(400, "INVALID_INPUT")
  const text = list.map((item) => cleanText(item, 40)).filter(Boolean).join(", ")
  if (text.length > 300) throw new ApiError(400, "INVALID_INPUT")
  return text
}

/**
 * 입력값 확인·정리. 제품명만 필수. 형식이 틀리면 400 INVALID_INPUT.
 * Request JSON: { productName, productDescription?, highlights?, keyFeatures?, targetAudience?,
 *                 tones?: ("natural"|"premium"|"friendly"|"trendy")[], shopName?, location?, priceInfo?,
 *                 contact?, channel? }
 */
export function normalizePromoInput(body) {
  const productName = optionalText(body, "productName")
  if (!productName) throw new ApiError(400, "INVALID_INPUT")
  const product = {
    productName,
    productDescription: optionalText(body, "productDescription"),
    highlights: optionalText(body, "highlights"),
    keyFeatures: featureText(body.keyFeatures),
    targetAudience: optionalText(body, "targetAudience"),
    shopName: optionalText(body, "shopName"),
    location: optionalText(body, "location"),
    priceInfo: optionalText(body, "priceInfo"),
    contact: optionalText(body, "contact"),
    brandTone: "",
    channel: "",
  }
  if (body.tones !== undefined && !Array.isArray(body.tones)) throw new ApiError(400, "INVALID_INPUT")
  const tones = cleanTones(body.tones)
  if (tones.length) product.brandTone = tones.map((tone) => TONE_NAMES[tone]).join(", ")
  if (body.channel !== undefined && body.channel !== null && body.channel !== "") {
    if (typeof body.channel !== "string" || !Object.hasOwn(CHANNEL_STYLES, body.channel)) throw new ApiError(400, "INVALID_INPUT")
    product.channel = body.channel
  }
  return product
}

/** 해시태그 정리: '#'·공백 제거, 중복 제거, 최대 6개 */
function normalizeHashtags(raw) {
  const tags = raw
    .filter((tag) => typeof tag === "string")
    .map((tag) => tag.replace(/#/g, "").replace(/\s+/g, "").replace(/[^\p{L}\p{N}_]/gu, "").trim())
    .filter((tag) => tag.length > 0)
  return [...new Set(tags)].slice(0, HASHTAG_MAX)
}

const charCount = (text) => Array.from(text).length
const TRAILING_PUNCTUATION = /[\s.,!?·~…:;'"“”‘’\-]+$/u

/** 짧은 한 줄 정리: 공백 정리 후 max자를 넘으면 버린다 (자르지 않음). 문자열이 아니면 "". */
function shortLine(value, max) {
  const text = cleanText(value, Infinity)
  return text && charCount(text) <= max ? text : ""
}

/**
 * 모델 JSON을 { copy, sns, intro, hashtags, copyCandidates, videoHeadline, cta }로 정리한다.
 * 필수 항목(copy·sns·intro·해시태그 4개 이상)이 빠지면 null. 선택 항목은 없거나 틀리면 비워 둔다
 * (금지어 거르기와 videoHeadline 대체는 finishPromo에서 입력과 함께 한다).
 */
export function parsePromoResponse(data) {
  if (!data || typeof data !== "object") return null
  const copy = cleanText(data.copy, 120)
  const sns = cleanText(data.sns, 600, true)
  const intro = cleanText(data.intro, 400)
  if (!copy || !sns || !intro || !Array.isArray(data.hashtags)) return null
  const hashtags = normalizeHashtags(data.hashtags)
  if (hashtags.length < HASHTAG_MIN) return null
  const copyCandidates = Array.isArray(data.copyCandidates)
    ? [...new Set(data.copyCandidates.map((line) => shortLine(line, CANDIDATE_MAX_LENGTH)).filter(Boolean))]
    : []
  const videoHeadline = shortLine(data.videoHeadline, HEADLINE_MAX_LENGTH + 3).replace(TRAILING_PUNCTUATION, "")
  return {
    copy, sns, intro, hashtags, copyCandidates,
    videoHeadline: charCount(videoHeadline) <= HEADLINE_MAX_LENGTH ? videoHeadline : "",
    cta: shortLine(data.cta, CTA_MAX_LENGTH),
  }
}

/** 상투어(입력에 없을 때)나 의학 표현(언제나)이 든 한 줄인지 */
function hasBannedWord(text, input) {
  return CLICHE_WORDS.some((word) => text.includes(word) && !input.includes(word)) || MEDICAL_WORDS.some((word) => text.includes(word))
}

/** copy에서 영상 자막을 만든다: 16자 이내에서 낱말 단위로 자르고, 끝의 문장부호는 뺀다. */
export function headlineFromCopy(copy) {
  const whole = copy.replace(TRAILING_PUNCTUATION, "")
  if (charCount(whole) <= HEADLINE_MAX_LENGTH) return whole
  let line = ""
  for (const word of whole.split(" ")) {
    const next = line ? `${line} ${word}` : word
    if (charCount(next.replace(TRAILING_PUNCTUATION, "")) > HEADLINE_MAX_LENGTH) break
    line = next
  }
  if (!line) line = Array.from(whole).slice(0, HEADLINE_MAX_LENGTH).join("") // 띄어쓰기 없는 긴 한 덩어리
  return line.replace(TRAILING_PUNCTUATION, "")
}

/** 응답으로 보낼 모양: 선택 항목에서 금지어가 든 줄을 거르고, 자막이 없으면 copy로 만든다. */
function finishPromo(result, product) {
  const input = Object.values(product).join(" ")
  const allowed = (text) => (text && !hasBannedWord(text, input) ? text : "")
  const copyCandidates = result.copyCandidates.filter((line) => allowed(line)).slice(0, CANDIDATE_MAX)
  const videoHeadline = allowed(result.videoHeadline) || allowed(headlineFromCopy(result.copy))
  const { copy, sns, intro, hashtags } = result
  return { copy, sns, intro, hashtags, copyCandidates, videoHeadline, cta: allowed(result.cta) }
}

/** 띄어쓰기·문장부호를 빼고 비교용 문자열로 만든다 */
function squeeze(text) {
  return text.replace(/[\s.,!?·~"'“”‘’()[\]…\-]/g, "")
}

/** 두 문자열에서 똑같이 이어지는 가장 긴 부분의 길이 */
function longestCommonRun(a, b) {
  let best = 0
  let prev = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1
        if (cur[j] > best) best = cur[j]
      }
    }
    prev = cur
  }
  return best
}

/** 결과 품질 자동 점검 — 문제 목록을 돌려준다 (없으면 빈 배열). */
export function reviewPromo(result, product) {
  const problems = []
  const output = [result.copy, result.sns, result.intro, ...result.hashtags].join(" ")
  const input = Object.values(product).join(" ")

  const cliches = CLICHE_WORDS.filter((word) => output.includes(word) && !input.includes(word))
  if (cliches.length) problems.push(`뻔한 상투어 사용: ${cliches.join(", ")} — 구체적인 사실이나 감각 표현으로 바꿀 것`)

  const medical = MEDICAL_WORDS.filter((word) => output.includes(word))
  if (medical.length) problems.push(`의학적 효능 표현 사용: ${medical.join(", ")} — 효능을 말하지 말고 사용감·경험으로 바꿀 것`)

  const name = squeeze(product.productName)
  const description = squeeze(`${product.productDescription} ${product.highlights}`).replaceAll(name, "")
  if (description) {
    for (const [key, label] of [["intro", "제품 소개"], ["sns", "SNS 문구"]]) {
      const run = longestCommonRun(squeeze(result[key]).replaceAll(name, ""), description)
      if (run >= REPEAT_LIMIT) problems.push(`${label}(${key})가 사장님이 쓴 제품 설명을 거의 그대로 되풀이함 — 손님이 얻는 경험으로 바꿔 쓸 것`)
    }
  }

  const longTags = result.hashtags.filter((tag) => tag.length > HASHTAG_MAX_LENGTH)
  if (longTags.length) problems.push(`해시태그가 너무 김(${HASHTAG_MAX_LENGTH}자 초과): ${longTags.join(", ")}`)
  return problems
}

/** 의학 표현이 남은 결과는 쓰지 않는다 (B의 규칙: 입력에 있어도 금지) */
function hasMedicalClaim(result) {
  const output = [result.copy, result.sns, result.intro, ...result.hashtags].join(" ")
  return MEDICAL_WORDS.some((word) => output.includes(word))
}

/**
 * 홍보문구 4종을 만든다. 최대 2번 호출: 형식 오류나 품질 문제가 있으면 문제를 짚어 1회 다시 쓰게 한다.
 * @returns {Promise<{copy: string, sns: string, intro: string, hashtags: string[], copyCandidates: string[],
 *   videoHeadline: string, cta: string}>}
 */
export async function generatePromo(product, config, { now = Date.now } = {}) {
  const startedAt = now()
  const remaining = () => TOTAL_BUDGET_MS - (now() - startedAt)
  let best = null // { result, problems }
  let retryNote = ""
  let lastError = new ApiError(502, "AI_BAD_RESPONSE")

  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt === 2 && remaining() < RETRY_MIN_MS) break
    let data
    try {
      data = await generateJson({
        config,
        systemInstruction: PROMO_SYSTEM_PROMPT,
        parts: [{ text: buildPromoUserPrompt(product) + (retryNote ? `\n\n${retryNote}` : "") }],
        timeoutMs: Math.min(10_000, remaining()),
        maxOutputTokens: 1536, // copyCandidates·videoHeadline·cta도 함께 쓰므로 잘리지 않게 여유를 둔다
      })
    } catch (error) {
      if (best) break // 첫 결과가 있으면 그것을 쓴다
      if (!(error instanceof ApiError) || error.code !== "AI_BAD_RESPONSE") throw error
      lastError = error
      retryNote = buildRetryNote(["응답 형식 오류: JSON 객체 하나만 출력할 것"])
      continue
    }

    const result = parsePromoResponse(data)
    if (!result) {
      if (best) break
      retryNote = buildRetryNote(["응답 형식 오류: copy, sns, intro와 해시태그 4개 이상이 필요함"])
      continue
    }
    const problems = reviewPromo(result, product)
    if (!best || problems.length < best.problems.length) best = { result, problems }
    if (problems.length === 0) break
    retryNote = buildRetryNote(problems)
  }

  if (!best) throw lastError
  // 품질 문제가 조금 남아도 문제가 가장 적은 결과를 쓴다. 단, 의학 표현은 쓰지 않고 화면의 기본 글로 대신한다.
  if (hasMedicalClaim(best.result)) throw new ApiError(502, "AI_BAD_RESPONSE")
  return finishPromo(best.result, product)
}
