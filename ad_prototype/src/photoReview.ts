/** A model's suspicions are a review prompt, not a legal or safety verdict. */
export const PHOTO_REVIEW_LABELS = {
  animal: "동물", person: "사람", building: "건물·가게", background: "배경 위주의 사진",
  tobacco: "담배·흡연 용품", alcohol: "술", medicine: "의약품", drug: "마약류 의심 물품",
  hazardous_item: "위험·유해 물품", credit_card: "신용카드·금융정보", other_sensitive: "그 밖의 확인할 내용",
  not_photo: "실제 상품 사진인지 확인", blurry: "흐린 사진",
} as const
export type PhotoReviewCategory = keyof typeof PHOTO_REVIEW_LABELS
export type PhotoReviewItem = { category: PhotoReviewCategory; reason: string }
export type PhotoReview = { items: PhotoReviewItem[]; uncertain: boolean }

/** Mandatory review must distinguish an explicitly empty list from a malformed/missing result. */
export function isCompletePhotoReview(value: unknown): value is PhotoReview {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const review = value as Record<string, unknown>
  return typeof review.uncertain === "boolean" && Array.isArray(review.items) && review.items.length <= 4 && review.items.every((item) => Boolean(item) && typeof item === "object" && !Array.isArray(item) && typeof item.category === "string" && Object.prototype.hasOwnProperty.call(PHOTO_REVIEW_LABELS, item.category) && typeof item.reason === "string")
}

export function parsePhotoReview(value: unknown): PhotoReview {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const seen = new Set<string>()
  const items: PhotoReviewItem[] = []
  for (const raw of Array.isArray(data.items) ? data.items : []) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue
    const item = raw as Record<string, unknown>
    if (typeof item.category !== "string" || !Object.prototype.hasOwnProperty.call(PHOTO_REVIEW_LABELS, item.category) || seen.has(item.category)) continue
    seen.add(item.category)
    items.push({ category: item.category as PhotoReviewCategory, reason: typeof item.reason === "string" ? Array.from(item.reason.replace(/[\u0000-\u001f]/g, " ").trim()).slice(0, 100).join("") : "" })
    if (items.length === 4) break
  }
  return { items, uncertain: data.uncertain === true }
}

export function reviewWithQuality(value: unknown, check?: { isRealPhoto: boolean; isBlurry: boolean; reason: string }, productName = ""): PhotoReview {
  const review = parsePhotoReview(value)
  // A model may name tobacco correctly but omit its category. Use that explicit name as a bounded fallback.
  if (/(?:담배|담뱃갑|담뱃대|궐련|흡연\s*용품|cigarettes?|tobacco|vapes?|e[- ]?cigarettes?)/i.test(productName) && !review.items.some((item) => item.category === "tobacco")) review.items.unshift({ category: "tobacco", reason: "사진 분석에서 담배·흡연 용품으로 읽힌 상품인지 확인해 주세요." })
  if (review.uncertain && !review.items.length) review.items.push({ category: "other_sensitive", reason: "사진 내용을 확실히 확인하지 못했어요. 홍보에 사용할 상품 사진인지 직접 확인해 주세요." })
  if (check?.isRealPhoto === false && !review.items.some((item) => item.category === "not_photo")) review.items.push({ category: "not_photo", reason: check.reason || "파는 상품을 직접 찍은 사진인지 확인해 주세요." })
  if (check?.isBlurry === true && !review.items.some((item) => item.category === "blurry")) review.items.push({ category: "blurry", reason: check.reason || "상품이 선명하게 보이는지 확인해 주세요." })
  return { ...review, items: review.items.slice(0, 6) }
}
