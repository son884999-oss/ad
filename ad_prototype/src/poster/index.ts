// Poster module (renderer ported from D_고혜숙/src/poster/*). App-specific glue lives here.
import type { PosterContent, PosterThemeKey } from "./posterRenderer"

export { POSTER_THEMES, POSTER_RATIOS, POSTER_COMPOSITIONS, renderPosterToCanvas, loadPosterFonts } from "./posterRenderer"
export type { PosterContent, PosterThemeKey } from "./posterRenderer"

/** 홍보 분위기 → D theme. The first selected tone decides; 자동 (none) uses the calm minimal theme. */
export const toneThemes: Record<string, PosterThemeKey> = {
  natural: "nature",
  premium: "luxury",
  friendly: "warm",
  trendy: "vibrant",
}

export function posterThemeFor(tones: readonly string[] | undefined): PosterThemeKey {
  return toneThemes[tones?.[0] ?? ""] ?? "minimal"
}

type Details = { shopName?: string; name?: string; description: string; features: string; keywords?: string; audience: string }

const same = (a: string, b: string) => a.replace(/\s+/g, "") === b.replace(/\s+/g, "")

/**
 * Chooses the poster text from the form. Every line is optional except the title, and a line that
 * repeats the title is dropped, so a poster with only the product name shows it once.
 * `headline` is the one-line 홍보 문구 (B_이창훈's AI copy, or the local fallback sentence): it fills the
 * body when the form has none, otherwise the highlight line.
 */
export function buildPosterContent(details: Details, headline = ""): PosterContent {
  const title = details.name?.trim() || details.shopName?.trim() || details.description.trim() || details.features.trim()
  const shopName = details.shopName?.trim() ?? ""
  const description = details.description.trim()
  const features = details.features.trim()
  const keywords = (details.keywords ?? "").split(",").map((item) => item.trim()).filter(Boolean)
  const line = headline.replace(/s+/g, " ").trim()
  const body = [description, features, line].find((value) => value && !same(value, title)) ?? ""
  const point = keywords.length
    ? keywords.slice(0, 3).join("  ·  ")
    : description && features && body === description && !same(features, title)
      ? features
      : line && body !== line && !same(line, title) ? line : ""
  return {
    eyebrow: shopName && !same(shopName, title) ? shopName : "",
    productName: title,
    productDescription: body,
    keySellingPoint: point,
    targetAudience: details.audience.trim(),
  }
}
