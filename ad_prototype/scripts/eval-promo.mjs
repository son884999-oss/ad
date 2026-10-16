// 홍보 글 평가 묶음: 10 products (B_이창훈 examples + 7 shop types) × machine checks.
// Without --live it only checks the fixtures and the scoring code (no network).
// With --live it calls Gemini through api/_lib/promo.js — each product is 1–2 calls on the free key.
//   node scripts/eval-promo.mjs                 # offline self-check
//   node scripts/eval-promo.mjs --live --count 3 # first 3 products, real Gemini (reads GEMINI_* from .env.local)
// Scores are machine checks only (no 1–5 human rubric): banned words, repetition, lengths, call to action, hashtags.
import { readFile } from "node:fs/promises"
import { generatePromo, normalizePromoInput, reviewPromo } from "../api/_lib/promo.js"
import { getGeminiConfig } from "../api/_lib/gemini.js"
import { CLICHE_WORDS, MEDICAL_WORDS, HEALTH_CLAIM_WORDS, AI_STYLE_WORDS } from "../api/_lib/promo-prompt.js"

const args = process.argv.slice(2)
const live = args.includes("--live")
const count = Number(args[args.indexOf("--count") + 1]) || 10

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
const products = [...fromB, ...own].slice(0, count)

/** Machine score 0–100 for one result. */
function score(result, product) {
  const text = [result.copy, result.sns, result.intro].join(" ")
  const input = Object.values(product).flat().join(" ")
  const issues = []
  for (const word of CLICHE_WORDS) if (text.includes(word) && !input.includes(word)) issues.push(`상투어 ${word}`)
  for (const word of [...MEDICAL_WORDS, ...HEALTH_CLAIM_WORDS]) if (text.includes(word)) issues.push(`효능 표현 ${word}`)
  const aiStyle = AI_STYLE_WORDS.filter((word) => text.includes(word) && !input.includes(word))
  if (aiStyle.length >= 2) issues.push(`AI 말투 ${aiStyle.join(", ")}`)
  issues.push(...reviewPromo(result, product).filter((problem) => !issues.some((issue) => problem.includes(issue))))
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
    const match = /^\s*(GEMINI_API_KEY|GEMINI_MODEL)\s*=\s*(.*?)\s*$/.exec(line)
    if (match && match[2] && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
  const config = getGeminiConfig()
  const rows = []
  for (const product of products) {
    try {
      const result = await generatePromo(normalizePromoInput(product), config)
      const { score: points, issues } = score(result, product)
      rows.push(points)
      console.log(`\n[${points}점] ${product.productName}\n  첫 줄: ${result.copy}\n  SNS: ${result.sns.replace(/\n/g, " ")}\n  태그: ${result.hashtags.join(" ")}${issues.length ? `\n  문제: ${issues.join(" / ")}` : ""}`)
    } catch (error) {
      console.log(`\n[실패] ${product.productName}: ${error?.code ?? error?.name ?? "error"}`)
    }
  }
  if (rows.length) console.log(`\n평균 ${Math.round(rows.reduce((a, b) => a + b, 0) / rows.length)}점 (${rows.length}개)`)
}
