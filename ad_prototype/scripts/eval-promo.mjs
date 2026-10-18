// 홍보 글 평가 묶음: 10 products (B_이창훈 examples + 7 shop types) × machine checks.
// Without --live it only checks the fixtures and the scoring code (no network).
// With --live it calls Gemini through api/_lib/promo.js — each product is 1–2 calls on the free key.
//   node scripts/eval-promo.mjs                 # offline self-check
//   node scripts/eval-promo.mjs --live --count 3 # first 3 products, real Gemini (reads GEMINI_* from .env.local)
//   node scripts/eval-promo.mjs --live --names 아메리카노,가죽 지갑   # only products whose name contains one of these
// A product the app would replace with its own text (AI_BAD_RESPONSE) scores 0; a rate-limited one is skipped.
// Scores are machine checks only (no 1–5 human rubric): banned words, repetition, lengths, call to action, hashtags.
import { readFile } from "node:fs/promises"
import { generatePromo, normalizePromoInput, reviewPromo } from "../api/_lib/promo.js"
import { getGeminiConfig } from "../api/_lib/gemini.js"
import { CLICHE_WORDS, MEDICAL_WORDS, HEALTH_CLAIM_WORDS, AI_STYLE_WORDS } from "../api/_lib/promo-prompt.js"

const args = process.argv.slice(2)
const live = args.includes("--live")
const count = Number(args[args.indexOf("--count") + 1]) || 10
const names = args.includes("--names") ? args[args.indexOf("--names") + 1].split(",").map((name) => name.trim()).filter(Boolean) : []

const fromB = JSON.parse(await readFile(new URL("../../B_이창훈/examples/products.json", import.meta.url), "utf8"))
  .map(({ brandTone: _tone, ...product }) => product)
const own = [
  { productName: "수제 딸기 케이크", productDescription: "생크림과 딸기를 층층이 올린 케이크", shopName: "달빛제과", priceInfo: "조각 6,500원" },
  { productName: "아메리카노", shopName: "골목커피", location: "성수역 3번 출구 앞" },
  { productName: "천연 수제 비누", productDescription: "올리브유로 만든 순한 비누", keyFeatures: ["무향", "선물 포장"], targetAudience: "선물을 찾는 분" },
  { productName: "떡볶이", productDescription: "매콤달콤한 국물 떡볶이", priceInfo: "1인분 5,000원", contact: "전화 주문 가능" },
  { productName: "꽃다발", productDescription: "제철 꽃으로 그날 만드는 꽃다발", shopName: "작은꽃집", targetAudience: "기념일을 챙기는 분" },
  { productName: "수학 과외", productDescription: "중학생 대상 1:1 수업", location: "동네 공부방", contact: "문자 상담" },
  { productName: "가죽 키링", productDescription: "손바느질로 만든 가죽 키링", keyFeatures: ["이니셜 각인"], priceInfo: "15,000원" },
]
const products = [...fromB, ...own].filter((product) => !names.length || names.some((name) => product.productName.includes(name))).slice(0, count)

/** Machine score 0–100 for one result. */
function score(result, product) {
  const text = [result.copy, result.sns, result.intro].join(" ")
  const input = Object.values(product).flat().join(" ")
  const issues = []
  for (const word of CLICHE_WORDS) if (text.includes(word) && !input.includes(word)) issues.push(`상투어 ${word}`)
  for (const word of [...MEDICAL_WORDS, ...HEALTH_CLAIM_WORDS]) if (text.includes(word)) issues.push(`효능 표현 ${word}`)
  const aiStyle = AI_STYLE_WORDS.filter((word) => text.includes(word) && !input.includes(word))
  if (aiStyle.length >= 2) issues.push(`AI 말투 ${aiStyle.join(", ")}`)
  // reviewPromo reports the same banned word in its own words ("뻔한 상투어 사용: 정성 — ..."); count each word once.
  const counted = issues.map((issue) => issue.split(" ").at(-1))
  issues.push(...reviewPromo(result, product).filter((problem) => !counted.some((word) => problem.includes(word))))
  if (!/(오세요|들러|만나|주문|문의|확인|찾아|와 주세요|보러|해 보세요|해보세요|보세요|드셔|예약)/.test(text)) issues.push("행동 유도 없음")
  if (result.copy.length > 40) issues.push(`첫 줄이 김 (${result.copy.length}자)`)
  if (result.hashtags.length < 3 || result.hashtags.length > 5) issues.push(`해시태그 ${result.hashtags.length}개`)
  return { score: Math.max(0, 100 - issues.length * 15), issues }
}

// Offline self-check: fixtures normalise, and the scorer catches an obviously bad answer.
for (const product of products) normalizePromoInput(product)
const bad = { copy: "최고의 선택, 정성 가득한 디톡스 케이크로 특별한 하루를 선사합니다", sns: "다양한 맛을 통해 힐링", intro: "다양한 맛을 통해 힐링", hashtags: ["케이크"] }
const badScore = score(bad, own[0])
if (badScore.score > 40) throw new Error(`scorer too lenient: ${badScore.score} ${badScore.issues.join(" / ")}`)
console.log(`fixtures ok (${products.length}), scorer catches a bad answer (${badScore.score}점: ${badScore.issues.length}개 문제)`)

if (live) {
  const env = await readFile(new URL("../.env.local", import.meta.url), "utf8").catch(() => "")
  for (const line of env.split(/\r?\n/)) {
    const match = /^\s*(GEMINI_API_KEY|GEMINI_API_KEY_2|GEMINI_MODEL|GEMINI_MODEL_2)\s*=\s*(.*?)\s*$/.exec(line)
    if (match && match[2] && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
  const config = getGeminiConfig()
  const rows = []
  for (const [index, product] of products.entries()) {
    // The free key allows only a few requests a minute; space the products out so none is skipped.
    if (index) await new Promise((done) => setTimeout(done, 10_000))
    try {
      const result = await generatePromo(normalizePromoInput(product), config)
      const { score: points, issues } = score(result, product)
      rows.push(points)
      console.log(`\n[${points}점] ${product.productName}\n  첫 줄: ${result.copy}\n  SNS: ${result.sns.replace(/\n/g, " ")}\n  태그: ${result.hashtags.join(" ")}${issues.length ? `\n  문제: ${issues.join(" / ")}` : ""}`)
    } catch (error) {
      const code = error?.code ?? error?.name ?? "error"
      if (code === "AI_BAD_RESPONSE") rows.push(0) // the app shows its own text instead: counts as a miss
      console.log(`\n[${code === "AI_BAD_RESPONSE" ? "0점" : "건너뜀"}] ${product.productName}: ${code}`)
    }
  }
  if (rows.length) console.log(`\n평균 ${Math.round(rows.reduce((a, b) => a + b, 0) / rows.length)}점 (${rows.length}개)`)
}

// --local: the app's own 홍보 글 (src/localCopy.ts, used whenever the AI text is not available) for the same
// products and 5 channels, scored with the same rules (hashtags are made elsewhere, so not scored here) plus
// two checks for text the app writes itself: lines that are bare words rather than sentences, and repeats.
if (args.includes("--local")) {
  const { legacyLocalCopy, localCopy } = await import("../src/localCopy.ts")
  const channels = ["download", "instagram", "naver_place", "daangn", "kakao"]
  const toInput = (product) => ({
    name: product.productName ?? "",
    shopName: product.shopName ?? "",
    description: product.productDescription ?? "",
    features: product.highlights ?? "",
    keywords: (product.keyFeatures ?? []).join(", "),
    audience: product.targetAudience ?? "",
    location: product.location ?? "",
    priceInfo: product.priceInfo ?? "",
    contact: product.contact ?? "",
    tones: [],
  })
  const scoreLocal = (text, product) => {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean)
    const [first = "", ...rest] = lines
    // The app has no AI to reword the owner's description, so "repeats the description" (a rule for the AI text)
    // is not counted here; every other rule is.
    const { issues: all } = score({ copy: first, sns: rest.join(" "), intro: "", hashtags: ["#a", "#b", "#c"] }, product)
    const issues = all.filter((issue) => !issue.includes("되풀이함"))
    // A line that ends without a sentence ending (요/다/. ! ?) and is not an info line ("가격 · …") reads like a form.
    const bare = lines.slice(1).filter((line) => !/[.!?요다]$/.test(line) && !/ · /.test(line) && !line.startsWith("✔"))
    if (bare.length >= 2) issues.push(`양식처럼 나열된 줄 ${bare.length}개`)
    if (/✔/.test(text)) issues.push("체크 표시 나열")
    const seen = new Set()
    for (const line of lines) {
      const key = line.replace(/[^가-힣a-z0-9]/gi, "")
      if (key.length >= 4 && seen.has(key)) issues.push(`같은 줄 되풀이 "${line.slice(0, 12)}"`)
      seen.add(key)
    }
    return { score: Math.max(0, 100 - issues.length * 15), issues }
  }
  for (const [label, make] of [["지금(legacy)", legacyLocalCopy], ["새 기본 문구", localCopy]]) {
    const all = []
    for (const product of products) for (const channel of channels) {
      const { score: points, issues } = scoreLocal(make(toInput(product), channel), product)
      all.push(points)
      if (args.includes("--verbose") && issues.length) console.log(`  [${points}] ${product.productName} / ${channel}: ${issues.join(" / ")}`)
    }
    console.log(`${label}: 평균 ${Math.round(all.reduce((a, b) => a + b, 0) / all.length)}점 (${all.length}개 = 제품 ${products.length} × 곳 ${channels.length})`)
  }
}
