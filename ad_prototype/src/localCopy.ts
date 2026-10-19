// The 홍보 글 the app writes by itself, used whenever the AI text is not available (no key, daily quota,
// slow answer, a rejected answer). Kept free of React so scripts/eval-promo.mjs can score it with the same
// rules as the AI text (node runs this file directly).

export type LocalCopyTone = "natural" | "premium" | "friendly" | "trendy"

export type LocalCopyInput = {
  name?: string
  shopName?: string
  description: string
  features: string
  keywords?: string
  audience: string
  location?: string
  priceInfo?: string
  contact?: string
  tones: readonly LocalCopyTone[]
}

const toneLines: Record<LocalCopyTone, string> = {
  natural: "꾸밈없이 있는 그대로 담았어요.",
  premium: "소중한 날, 고마운 분께 권하기 좋아요.",
  friendly: "편하게 들러 주세요. 반갑게 맞이할게요!",
  trendy: "가볍게 들러서 지금 바로 만나 보세요!",
}

/** The one sentence the copy and the poster use when the owner wrote no 알리고 싶은 점. */
export function localBody(input: LocalCopyInput) {
  const keyFeatureList = (input.keywords ?? "").split(",").map((item) => item.trim()).filter(Boolean)
  const shopName = input.shopName?.trim() ?? ""
  return (
    input.features.trim() ||
    (input.description.trim() || keyFeatureList.length
      ? ""
      : shopName
        ? `${shopName}에서 직접 준비했어요. 편하게 들러 보세요.`
        : "가까이에서 편하게 만나 보세요.")
  )
}

/** Today's behaviour, unchanged: kept so the new text can be compared against it (eval-promo --local). */
export function legacyLocalCopy(input: LocalCopyInput, channel: string) {
  const keyFeatureList = (input.keywords ?? "").split(",").map((item) => item.trim()).filter(Boolean)
  const productSummary = [
    input.name?.trim(),
    input.shopName?.trim(),
    input.description,
    keyFeatureList.length ? keyFeatureList.map((item) => "✔ " + item).join("  ") : "",
  ].filter(Boolean).join("\n")
  const toneLine = input.tones.length ? toneLines[input.tones[0]] : ""
  const shopName = input.shopName?.trim() ?? ""
  const body =
    input.features.trim() ||
    (input.description.trim() || keyFeatureList.length
      ? ""
      : shopName
        ? `${shopName}에서 직접 준비했어요. 편하게 들러 보세요.`
        : "가까이에서 편하게 만나 보세요.")
  const shopInfo = [
    input.location?.trim() && `위치 · ${input.location.trim()}`,
    input.priceInfo?.trim() && `가격 · ${input.priceInfo.trim()}`,
    input.contact?.trim() && `문의 · ${input.contact.trim()}`,
  ].filter(Boolean).join("\n")
  const audienceRecommendation = input.audience.trim() ? `\n\n${input.audience}께 추천해요.` : ""
  const audienceLabel = input.audience.trim() ? `\n\n추천 대상: ${input.audience}` : ""
  const byChannel: Record<string, string> = {
    naver_place: `${productSummary}\n\n${body}${audienceLabel}`,
    kakao: `우리 가게 소식을 전해요.\n\n${productSummary}\n${body}\n\n궁금한 점은 편하게 문의해 주세요.`,
    naver_blog: `${productSummary}\n\n${input.features.trim() ? "이런 특징이 있어요\n" : ""}${body}${audienceLabel}`,
    daangn: `이웃 여러분께 우리 가게를 소개해요.\n\n${productSummary}\n${body}\n\n궁금한 점은 문의해 주세요.`,
    youtube: `${body}\n\n${productSummary}${audienceLabel}`,
    instagram: `오늘 소개할 ${productSummary}\n\n${body}\n지금 사진으로 만나 보세요.`,
    x: `${body || productSummary.split("\n")[0]} — 필요한 분은 바로 확인해 보세요.${audienceRecommendation}`,
    threads: `오늘은 이걸 소개하고 싶어요.\n${productSummary}\n${input.features.trim() ? `특히 ${input.features.trim()} 이 부분이 좋아요. ` : body ? `${body} ` : ""}궁금한 점은 편하게 물어보세요.`,
  }
  const base = byChannel[channel] ?? `${productSummary}\n\n${body}${audienceRecommendation}`
  return [base, shopInfo, toneLine].filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n").trim()
}

/** Ends a line the owner typed as a sentence, so it does not read like a form field. */
const sentence = (text: string) => {
  const value = text.replace(/\s+/g, " ").trim()
  return !value || /[.!?…~]$/.test(value) ? value : `${value}.`
}

/** One closing line per place: what the reader should do next (a visit, a question, a save). */
const channelClosing: Record<string, string> = {
  download: "가까이 오시면 편하게 들러 보세요.",
  instagram: "저장해 두었다가 지나가실 때 들러 보세요.",
  naver_place: "방문 전에 영업시간을 확인해 주세요.",
  daangn: "궁금한 점은 채팅으로 편하게 문의해 주세요.",
  kakao: "궁금한 점은 편하게 문의해 주세요.",
}
const channelOpening: Record<string, string> = {
  kakao: "우리 가게 소식을 전해요.",
  daangn: "이웃 여러분께 우리 가게를 소개해요.",
}

/**
 * The app's own 홍보 글: a title line, the owner's words as sentences, the key points and practical info on
 * labelled lines ("특징 · …", "가격 · …"), who it suits, and one closing line that says what to do next.
 */
export function localCopy(input: LocalCopyInput, channel: string) {
  const name = input.name?.trim() ?? ""
  const shop = input.shopName?.trim() ?? ""
  const title = shop && name && `${shop}의 ${name}`.length <= 30 ? `${shop}의 ${name}` : name || shop
  const description = sentence(input.description)
  const features = input.features.trim() && input.features.trim() !== input.description.trim() ? sentence(input.features) : ""
  const keywords = (input.keywords ?? "").split(",").map((item) => item.trim()).filter(Boolean)
  // Nothing written but a name: one plain line so the text is not just the name (the closing line invites).
  const filler = !description && !features && !keywords.length ? (shop ? `${shop}에서 직접 준비했어요.` : "가까이에서 만나 보실 수 있어요.") : ""
  const facts = [
    keywords.length ? `특징 · ${keywords.join(", ")}` : "",
    input.location?.trim() ? `위치 · ${input.location.trim()}` : "",
    input.priceInfo?.trim() ? `가격 · ${input.priceInfo.trim()}` : "",
    input.contact?.trim() ? `문의 · ${input.contact.trim()}` : "",
  ].filter(Boolean).join("\n")
  const audience = input.audience.trim() ? `${input.audience.trim()}께 추천해요.` : ""
  // With a shop or a place the text ends on a concrete invitation from the owner's own facts
  // ("망원동 달빛제과에서 조각 6,500원에 만나 보세요."); a price that does not end in 원 ("…부터") stays in its line.
  // Channels whose readers ask first (채팅, 영업시간) keep their line after it. Otherwise the tone or the place decides.
  const place = [input.location?.trim(), shop].filter(Boolean).join(" ")
  const price = input.priceInfo?.trim() ?? ""
  const offer = place ? `${place}에서 ${/원$/.test(price) && price.length <= 16 ? `${price}에 ` : ""}만나 보세요.` : ""
  const asksFirst = channel === "naver_place" || channel === "daangn" || channel === "kakao"
  const closing = offer
    ? [offer, asksFirst ? channelClosing[channel] : ""].filter(Boolean).join(" ")
    : input.tones.length ? toneLines[input.tones[0]] : channelClosing[channel] ?? channelClosing.download
  return [channelOpening[channel] ?? "", title, [description, features, filler].filter(Boolean).join(" "), facts, audience, closing]
    .filter(Boolean)
    .join("\n\n")
}
