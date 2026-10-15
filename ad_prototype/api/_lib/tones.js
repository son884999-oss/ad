// 홍보 분위기 values shared with the client (src/App.tsx toneOptions).
export const TONE_NAMES = {
  natural: "자연스럽고 건강한",
  premium: "고급스럽고 전문적인",
  friendly: "친근하고 따뜻한",
  trendy: "트렌디하고 활기찬",
}

/** Keeps only known tone IDs, without duplicates, in their original order. */
export function cleanTones(value, max = 4) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((tone) => typeof tone === "string" && Object.hasOwn(TONE_NAMES, tone)))].slice(0, max)
}
