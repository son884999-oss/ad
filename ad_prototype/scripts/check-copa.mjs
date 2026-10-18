// MANUAL live check of the COPA (Claude) step alone, Gemini skipped: one real photo analysis and one promo text.
// Uses about 5–8k COPA tokens. Reads COPA_API_KEY / COPA_MODEL / COPA_BASE_URL from the environment or .env.local.
// Never prints the key.
//
//   node scripts/check-copa.mjs [photo.jpg|png|webp]
import { readFile } from "node:fs/promises"
import { extname, resolve } from "node:path"
import { getCopaConfig } from "../api/_lib/copa.js"
import { analyzeProductPhoto } from "../api/_lib/photo.js"
import { generatePromo, normalizePromoInput } from "../api/_lib/promo.js"

const text = await readFile(resolve(".env.local"), "utf8").catch(() => "")
for (const line of text.split(/\r?\n/)) {
  const match = /^\s*(COPA_API_KEY|COPA_MODEL|COPA_BASE_URL)\s*=\s*(.*?)\s*$/.exec(line)
  if (match && match[2] && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "")
}
const copa = getCopaConfig()
if (!copa) {
  console.error("COPA_API_KEY가 없어요. .env.local에 COPA_API_KEY=... 를 넣어 주세요.")
  process.exit(1)
}
console.log(`model=${copa.model} base=${copa.baseUrl}`)
const config = { copa } // COPA only: no Gemini key in this config

const photoPath = resolve(process.argv[2] ?? "public/assets/reference-fresh/cake.png")
const mimeType = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[extname(photoPath).toLowerCase()]
const photo = { mimeType, data: (await readFile(photoPath)).toString("base64") }

let suggestion
let started = Date.now()
try {
  suggestion = await analyzeProductPhoto(photo, config)
  console.log(`사진 분석 OK ${Date.now() - started}ms`, JSON.stringify(suggestion, null, 1))
} catch (error) {
  console.error(`사진 분석 실패 ${Date.now() - started}ms:`, error?.code ?? error?.message)
  process.exit(1)
}

started = Date.now()
try {
  const promo = await generatePromo(normalizePromoInput({
    productName: suggestion.productName || "딸기 생크림 케이크",
    productDescription: suggestion.description,
    keyFeatures: suggestion.keyFeatures,
    tones: suggestion.tones,
    visualDetails: suggestion.visualDetails,
    channel: "instagram",
  }), config)
  console.log(`홍보 글 OK ${Date.now() - started}ms`, JSON.stringify(promo, null, 1))
} catch (error) {
  console.error(`홍보 글 실패 ${Date.now() - started}ms:`, error?.code ?? error?.message)
  process.exit(1)
}
