// Picks the poster accent colour from the product photo, so the poster matches the product instead of
// a fixed palette. Small and dependency-free: the photo is scaled to 48×48 and the most common
// saturated hue wins. Returns null for photos without a clear colour (mostly grey/white/black).

type Rgb = [number, number, number]

const hex = ([r, g, b]: Rgb) => `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`

function rgbToHsl([r, g, b]: Rgb) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return { h: h * 60, s, l }
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

/** Accent, tints and a dark ink in the photo's main hue, or null when the photo has no clear colour. */
export type PhotoPalette = { accent: string; bg: [string, string, string]; ink: string; sub: string; tint: string; deep: string }

/** The app's warm orange, for a photo with no clear colour (grey, black and white, washed out). */
export const FALLBACK_PALETTE: PhotoPalette = {
  accent: "#c4622d", bg: ["#fdf3ea", "#f8e2d0", "#efc9ab"], ink: "#3d1d0c", sub: "#6b4430", tint: "#f9e6d6", deep: "#7a3412",
}

export function photoPalette(image: CanvasImageSource): PhotoPalette | null {
  const size = 48
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  try {
    ctx.drawImage(image, 0, 0, size, size)
  } catch {
    return null
  }
  let pixels: Uint8ClampedArray
  try {
    pixels = ctx.getImageData(0, 0, size, size).data
  } catch {
    return null // a tainted canvas (cross-origin image) cannot be read
  }
  // 12 hue buckets of 30°, weighted by saturation; greys and near-white/black pixels are ignored.
  const buckets = Array.from({ length: 12 }, () => ({ weight: 0, h: 0, s: 0 }))
  let colourful = 0
  for (let i = 0; i < pixels.length; i += 4) {
    const { h, s, l } = rgbToHsl([pixels[i], pixels[i + 1], pixels[i + 2]])
    if (s < 0.25 || l < 0.12 || l > 0.9) continue
    colourful += 1
    const bucket = buckets[Math.floor(h / 30) % 12]
    bucket.weight += s
    bucket.h += h * s
    bucket.s += s * s
  }
  const best = buckets.reduce((a, b) => (b.weight > a.weight ? b : a))
  if (colourful < size * size * 0.08 || best.weight === 0) return null
  const hue = best.h / best.weight
  const saturation = Math.min(0.75, Math.max(0.45, best.s / best.weight))
  return {
    accent: hex(hslToRgb(hue, saturation, 0.5)),
    bg: [hex(hslToRgb(hue, 0.45, 0.96)), hex(hslToRgb(hue, 0.42, 0.9)), hex(hslToRgb(hue, 0.38, 0.8))],
    ink: hex(hslToRgb(hue, 0.5, 0.16)),
    sub: hex(hslToRgb(hue, 0.3, 0.3)),
    // 스타일 2 글 상자 (light, so the dark text reads) and 스타일 3 바탕 (deep, so the white frame stands out).
    tint: hex(hslToRgb(hue, 0.42, 0.91)),
    deep: hex(hslToRgb(hue, Math.min(0.6, saturation), 0.24)),
  }
}
