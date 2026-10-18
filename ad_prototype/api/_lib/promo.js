// Ported from B_이창훈/promo.mjs — input normalisation, response parsing, the automatic quality
// review (상투어·의학·건강 효능 표현·확인할 수 없는 주장·AI 말투·설명 되풀이·해시태그 길이) and the
// one-time rewrite. Uses Gemini (./gemini.js) instead of the Claude SDK and works within a time budget
// so the UI never waits long.
import { ApiError, cleanText } from "./http.js"
import { generateJson } from "./gemini.js"
import {
  AI_STYLE_WORDS, CHANNEL_STYLES, CLICHE_WORDS, HEALTH_CLAIM_WORDS, MEDICAL_WORDS, PROMO_SYSTEM_PROMPT, UNVERIFIED_CLAIM_WORDS,
  buildPromoUserPrompt, buildRetryNote,
} from "./promo-prompt.js"
import { TONE_NAMES, cleanTones } from "./tones.js"

const HASHTAG_MIN = 3
const HASHTAG_MAX = 5
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
/** visualDetails: short phrases about what the photo shows (from api/analyze-photo.js) */
const VISUAL_DETAILS_MAX = 5
const VISUAL_DETAIL_MAX_LENGTH = 30
/** "AI 말투" words: this many hits (or more) in copy/sns/intro is a review problem, never a hard reject */
const AI_STYLE_LIMIT = 2

/** Never said, even when the owner wrote it (의학 표현 + 건강·효능 주장) */
const ALWAYS_FORBIDDEN = [...MEDICAL_WORDS, ...HEALTH_CLAIM_WORDS]

/**
 * Gemini structured output (generationConfig.responseJsonSchema). It shapes the answer only:
 * lengths, banned words and repeats are still checked in parsePromoResponse / reviewPromo.
 */
export const PROMO_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    copyCandidates: { type: "array", description: "광고 카피 후보 3개, 각 25자 안팎", items: { type: "string" }, minItems: 3, maxItems: 3 },
    copy: { type: "string", description: "후보 중 고른 광고 카피 한 줄" },
    sns: { type: "string", description: "SNS 홍보문구, 마지막 문장은 행동 유도" },
    intro: { type: "string", description: "제품 소개 1~2문장" },
    hashtags: { type: "array", description: "# 없이, 띄어쓰기 없이, 10자 이내", items: { type: "string" }, minItems: HASHTAG_MIN, maxItems: HASHTAG_MAX },
    videoHeadline: { type: "string", description: "영상 자막, 띄어쓰기 포함 16자 이내" },
    cta: { type: "string", description: "행동 유도, 띄어쓰기 포함 14자 이내" },
  },
  required: ["copyCandidates", "copy", "sns", "intro", "hashtags", "videoHeadline", "cta"],
  propertyOrdering: ["copyCandidates", "copy", "sns", "intro", "hashtags", "videoHeadline", "cta"],
}

const charCount = (text) => Array.from(text).length

/** 사장님이 직접 쓴 입력 (상투어·확인할 수 없는 주장의 예외 판단용). 사진 분석 결과(visualDetails)는 넣지 않는다. */
function ownerInput(product) {
  return Object.entries(product).filter(([key]) => key !== "visualDetails").map(([, value]) => value).join(" ")
}

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

/** 사진에서 본 모습(visualDetails): 문자열 배열, 최대 5개, 각 30자 이내. 넘으면 자르지 않고 400. */
function visualDetailList(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > VISUAL_DETAILS_MAX || !value.every((item) => typeof item === "string")) {
    throw new ApiError(400, "INVALID_INPUT")
  }
  const list = value.map((item) => cleanText(item, Infinity)).filter(Boolean)
  if (list.some((item) => charCount(item) > VISUAL_DETAIL_MAX_LENGTH)) throw new ApiError(400, "INVALID_INPUT")
  return [...new Set(list)]
}

/**
 * 입력값 확인·정리. 제품명만 필수. 형식이 틀리면 400 INVALID_INPUT.
 * Request JSON: { productName, productDescription?, highlights?, keyFeatures?, targetAudience?,
 *                 tones?: ("natural"|"premium"|"friendly"|"trendy")[], shopName?, location?, priceInfo?,
 *                 contact?, channel?, visualDetails?: string[] (≤5 items, ≤30 chars each) }
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
    visualDetails: visualDetailList(body.visualDetails),
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

/** 해시태그 정리: '#'·공백 제거, 중복 제거, 최대 5개 */
function normalizeHashtags(raw) {
  const tags = raw
    .filter((tag) => typeof tag === "string")
    .map((tag) => tag.replace(/#/g, "").replace(/\s+/g, "").replace(/[^\p{L}\p{N}_]/gu, "").trim())
    .filter((tag) => tag.length > 0)
  return [...new Set(tags)].slice(0, HASHTAG_MAX)
}

const TRAILING_PUNCTUATION = /[\s.,!?·~…:;'"“”‘’\-]+$/u

/** 짧은 한 줄 정리: 공백 정리 후 max자를 넘으면 버린다 (자르지 않음). 문자열이 아니면 "". */
function shortLine(value, max) {
  const text = cleanText(value, Infinity)
  return text && charCount(text) <= max ? text : ""
}

/**
 * 모델 JSON을 { copy, sns, intro, hashtags, copyCandidates, videoHeadline, cta }로 정리한다.
 * 필수 항목(copy·sns·intro·해시태그 3개 이상)이 빠지면 null. 선택 항목은 없거나 틀리면 비워 둔다
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

/** 입력에 없는데 결과에 나온 말 */
const notInInput = (words, text, input) => words.filter((word) => text.includes(word) && !input.includes(word))

/** 상투어·확인할 수 없는 주장(입력에 없을 때)이나 의학·건강 효능 표현(언제나)이 든 한 줄인지 */
function hasBannedWord(text, input) {
  return notInInput(CLICHE_WORDS, text, input).length > 0 || notInInput(UNVERIFIED_CLAIM_WORDS, text, input).length > 0 ||
    ALWAYS_FORBIDDEN.some((word) => text.includes(word))
}

/** "AI 말투" 낱말이 나온 자리 (입력에 있는 말은 세지 않는다). 같은 말이 두 번이면 두 번 센다. */
function aiStyleHits(text, input) {
  return AI_STYLE_WORDS.filter((word) => !input.includes(word)).flatMap((word) => text.split(word).slice(1).map(() => word))
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
  const input = ownerInput(product)
  const allowed = (text) => (text && !hasBannedWord(text, input) ? text : "")
  const trim = (text) => trimCliches(text, input)
  // Short lines (candidates, video headline) are dropped rather than trimmed: what is left is often too bare.
  const copyCandidates = result.copyCandidates.filter((line) => allowed(line)).slice(0, CANDIDATE_MAX)
  // A cut copy can end mid-sentence ("한 입 베어 물면 생크림이", 2026-10-18 showcase), so complete lines come first:
  // a whole candidate or copy within 16, the copy's first comma part, the product name; the word cut only last.
  const whole = (text) => {
    const line = String(text ?? "").replace(TRAILING_PUNCTUATION, "").trim()
    return line && charCount(line) >= 4 && charCount(line) <= HEADLINE_MAX_LENGTH ? allowed(line) : ""
  }
  const firstPart = String(result.copy).split(/[,·]/)[0]
  const videoHeadline = allowed(result.videoHeadline)
    || [...copyCandidates, result.copy].map(whole).find(Boolean)
    || (charCount(firstPart.trim()) >= 6 ? whole(firstPart) : "")
    || whole(product.productName)
    || allowed(headlineFromCopy(result.copy))
  const { hashtags } = result
  return { copy: trim(result.copy), sns: trim(result.sns), intro: trim(result.intro), hashtags, copyCandidates, videoHeadline, cta: allowed(result.cta) }
}

// Cliché modifiers that read fine when simply dropped ("정성껏 내린 커피" → "내린 커피"). Words whose removal
// breaks the sentence ("특별한 날", "정성으로 짠") are left for the retry and the score to catch.
const DROPPABLE_CLICHES = [
  "정성껏", "정성스럽게", "정성스레", "정성 가득한", "정성 가득", "정성을 담은", "정성 담은", "정성 들여",
  "최고급", "최고의", "엄선한", "엄선된", "남다른", "완벽한", "프리미엄", "품격 있는", "차원이 다른",
]

/** Drops cliché modifiers the model kept after the retry, unless the owner wrote that word. */
export function trimCliches(text, input = "") {
  if (!text) return text
  let out = text
  for (const phrase of DROPPABLE_CLICHES) {
    if (input.includes(phrase.split(" ")[0])) continue
    out = out.split(`${phrase} `).join("")
  }
  return out.replace(/ {2,}/g, " ").trim()
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
  const input = ownerInput(product)

  const cliches = notInInput(CLICHE_WORDS, output, input)
  if (cliches.length) problems.push(`뻔한 상투어 사용: ${cliches.join(", ")} — 구체적인 사실이나 감각 표현으로 바꿀 것`)

  const medical = ALWAYS_FORBIDDEN.filter((word) => output.includes(word))
  if (medical.length) problems.push(`의학적·건강 효능 표현 사용: ${medical.join(", ")} — 효능을 말하지 말고 사용감·경험으로 바꿀 것`)

  const unverified = notInInput(UNVERIFIED_CLAIM_WORDS, output, input)
  if (unverified.length) problems.push(`확인할 수 없는 주장 사용: ${unverified.join(", ")} — 입력에 없는 순위·인증·최저가는 빼고 사실만 쓸 것`)

  const aiStyle = aiStyleHits([result.copy, result.sns, result.intro].join(" "), input)
  // "당신" alone is enough: a shop owner never addresses a customer that way (real answer 2026-10-18:
  // "당신의 아침을 더욱 특별하게").
  if (aiStyle.length >= AI_STYLE_LIMIT || aiStyle.includes("당신")) {
    problems.push(`AI 말투(번역투) 사용: ${[...new Set(aiStyle)].join(", ")} — 사장님 말투로 짧게, 해요체로 바꿀 것`)
  }

  // The same describing word three times or more reads as filler ("달콤한 … 달콤함 … 달콤한", real answer
  // 2026-10-18). Words of the product or shop name, which may repeat, are not counted.
  const own = `${product.productName} ${product.shopName ?? ""}`
  const stems = new Map()
  for (const word of [result.copy, result.sns, result.intro].join(" ").match(/[가-힣]{3,}/g) ?? []) {
    const stem = word.slice(0, 2)
    if (own.includes(stem)) continue
    stems.set(stem, (stems.get(stem) ?? 0) + 1)
  }
  // A word the owner used (a key noun such as 두피) may come back a third time; anything else may not.
  // Once per part (first line, SNS, intro) is fine emphasis; twice inside one part on top of that is filler.
  const twiceInOnePart = (stem) => [result.copy, result.sns, result.intro].some((part) => part.split(stem).length - 1 >= 2)
  const repeated = [...stems].filter(([stem, count]) => count >= (input.includes(stem) ? 4 : 3) && twiceInOnePart(stem)).map(([stem]) => stem)
  if (repeated.length) problems.push(`같은 꾸밈말 반복: ${repeated.join(", ")} — 세 번째부터는 다른 감각(식감·향·온도·모양)으로 바꿀 것`)

  // The product or shop name with one letter dropped (real answer 2026-10-18: "수제 초케이크" for 수제 초코 케이크).
  const compact = output.replace(/\s+/g, "")
  const misspelled = [product.productName, product.shopName].map((value) => (value ?? "").replace(/\s+/g, "")).filter((value) => value.length >= 4)
    .filter((value) => [...value].some((_, i) => {
      const variant = value.slice(0, i) + value.slice(i + 1)
      return !value.includes(variant) && compact.includes(variant)
    }))
  if (misspelled.length) problems.push(`이름 오타: ${misspelled.join(", ")} — 제품·가게 이름은 한 글자도 빼지 말고 그대로 쓸 것`)

  const name = squeeze(product.productName)
  const description = squeeze(`${product.productDescription} ${product.highlights}`).replaceAll(name, "")
  if (description) {
    for (const [key, label] of [["intro", "제품 소개"], ["sns", "SNS 문구"]]) {
      const run = longestCommonRun(squeeze(result[key]).replaceAll(name, ""), description)
      if (run >= REPEAT_LIMIT) problems.push(`${label}(${key})가 사장님이 쓴 제품 설명을 거의 그대로 되풀이함 — 손님이 얻는 경험으로 바꿔 쓸 것`)
    }
  }

  // SNS 글과 소개 글은 같이 보여 주므로, 같은 문장을 두 번 쓰면 안 된다.
  const plainName = squeeze(product.productName)
  if (longestCommonRun(squeeze(result.sns).replaceAll(plainName, ""), squeeze(result.intro).replaceAll(plainName, "")) >= REPEAT_LIMIT) {
    problems.push("SNS 문구(sns)와 제품 소개(intro)가 같은 문장을 되풀이함 — 소개는 다른 사실이나 정보로 쓸 것")
  }

  const longTags = result.hashtags.filter((tag) => tag.length > HASHTAG_MAX_LENGTH)
  if (longTags.length) problems.push(`해시태그가 너무 김(${HASHTAG_MAX_LENGTH}자 초과): ${longTags.join(", ")}`)
  return problems
}

/**
 * 의학·건강 효능 표현(B의 규칙: 입력에 있어도 금지)이나 입력에 없는 확인할 수 없는 주장(100%·1위 등)이
 * 남은 결과는 쓰지 않는다. 상투어·AI 말투는 남아도 쓴다.
 */
function hasForbiddenClaim(result, product) {
  const output = [result.copy, result.sns, result.intro, ...result.hashtags].join(" ")
  return ALWAYS_FORBIDDEN.some((word) => output.includes(word)) || notInInput(UNVERIFIED_CLAIM_WORDS, output, ownerInput(product)).length > 0
}

/**
 * 홍보문구 4종을 만든다. 최대 2번 호출: 형식 오류나 품질 문제가 있으면 문제를 짚어 1회 다시 쓰게 한다.
 * @returns {Promise<{copy: string, sns: string, intro: string, hashtags: string[], copyCandidates: string[],
 *   videoHeadline: string, cta: string}>}
 */
export async function generatePromo(product, config, { now = Date.now } = {}) {
  const startedAt = now()
  const remaining = () => TOTAL_BUDGET_MS - (now() - startedAt)
  let best = null // { result, problems, forbidden }
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
        responseJsonSchema: PROMO_RESPONSE_SCHEMA,
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
      retryNote = buildRetryNote(["응답 형식 오류: copy, sns, intro와 해시태그 3개 이상이 필요함"])
      continue
    }
    const problems = reviewPromo(result, product)
    // A usable answer (no health or made-up claim) always beats one the app would have to throw away.
    const forbidden = hasForbiddenClaim(result, product)
    if (!best || (best.forbidden && !forbidden) || (best.forbidden === forbidden && problems.length < best.problems.length)) best = { result, problems, forbidden }
    if (problems.length === 0) break
    retryNote = buildRetryNote(problems)
  }

  if (!best) throw lastError
  // 품질 문제가 조금 남아도 문제가 가장 적은 결과를 쓴다. 단, 의학·건강 효능 표현이나 지어낸 주장은 쓰지 않고
  // 화면의 기본 글로 대신한다.
  if (hasForbiddenClaim(best.result, product)) throw new ApiError(502, "AI_BAD_RESPONSE")
  return finishPromo(best.result, product)
}
