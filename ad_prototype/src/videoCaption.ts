// Captions for the 9:16 videos (1080 × 1920), in the same style as the "사진 크게" poster: a dark fade at the
// bottom carrying a large white headline, the product line, the price and a call-to-action pill, and the shop
// name on a see-through pill at the top. Lines rise in one after another. Reels / Shorts cover about the top
// 240 px and the bottom 340 px with their own buttons, so nothing is drawn there.
// Used for the sample video, and later on top of the real AI clip.

export type VideoCaption = {
  /** Shop name, top-left. */
  eyebrow?: string
  headline: string
  /** The product line under the headline (shop · product), when it is not the headline itself. */
  subline?: string
  price?: string
  cta?: string
}

const FONT = '"Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif'
const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`
const SIDE = 72
const TOP_SAFE = 240
const BOTTOM_SAFE = 340

/** Word wrap with a character fallback for long unspaced Korean words; the last line gets "…" when cut. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const lines: string[] = []
  let line = ""
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = ""
    for (const character of Array.from(word)) {
      if (ctx.measureText(line + character).width <= maxWidth) line += character
      else {
        lines.push(line)
        line = character
      }
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = Array.from(last).slice(0, -1).join("")
  kept[maxLines - 1] = `${last.trimEnd()}…`
  return kept
}

/** 0 → 1 over 0.45 s starting at `from` seconds. */
const appear = (seconds: number, from: number) => Math.min(Math.max((seconds - from) / 0.45, 0), 1)

/**
 * Draws the caption for the frame at `seconds` on a 1080 × 1920 canvas (call after drawing the picture).
 * `accent` is the shop's colour for the call-to-action text, as "r, g, b".
 */
export function drawVideoCaption(ctx: CanvasRenderingContext2D, seconds: number, caption: VideoCaption, accent = "150, 55, 16") {
  const { width, height } = ctx.canvas
  const textWidth = width - SIDE * 2

  // Measure bottom-up so the fade sits exactly behind the text block.
  ctx.font = font(800, 104)
  const headline = wrap(ctx, caption.headline, textWidth, 2)
  ctx.font = font(600, 46)
  const subline = caption.subline ? wrap(ctx, caption.subline, textWidth, 1) : []
  let y = height - BOTTOM_SAFE
  const ctaY = caption.cta ? y - 92 : y
  if (caption.cta) y -= 92 + 30
  const priceY = caption.price ? y : 0
  if (caption.price) y -= 84 + 22
  const sublineY = subline.length ? y : 0
  if (subline.length) y -= 46 + 26
  const headlineBottom = y
  const headlineTop = headlineBottom - (headline.length - 1) * 116 - 104

  // Clear above the text, already dark at the headline (white text on a white cup must stay readable).
  const fadeStart = Math.max(0, headlineTop - 320)
  const fade = ctx.createLinearGradient(0, fadeStart, 0, height)
  fade.addColorStop(0, "rgba(20,14,10,0)")
  fade.addColorStop(Math.min(0.95, 280 / (height - fadeStart)), "rgba(20,14,10,.78)")
  fade.addColorStop(1, "rgba(20,14,10,.92)")
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, width, height)

  const rise = (value: number, draw: () => void) => {
    if (value <= 0) return
    ctx.save()
    ctx.globalAlpha = value
    ctx.translate(0, (1 - value) * 28)
    draw()
    ctx.restore()
  }
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"

  if (caption.eyebrow) {
    rise(appear(seconds, 0.2), () => {
      const top = ctx.createLinearGradient(0, 0, 0, TOP_SAFE + 200)
      top.addColorStop(0, "rgba(20,14,10,.5)")
      top.addColorStop(1, "rgba(20,14,10,0)")
      ctx.fillStyle = top
      ctx.fillRect(0, 0, width, TOP_SAFE + 200)
      ctx.font = font(800, 40)
      const [line] = wrap(ctx, caption.eyebrow ?? "", textWidth - 56, 1)
      const pillWidth = ctx.measureText(line).width + 56
      ctx.fillStyle = "rgba(20,14,10,.72)"
      ctx.beginPath()
      ctx.roundRect(SIDE, TOP_SAFE, pillWidth, 76, 38)
      ctx.fill()
      ctx.fillStyle = "#ffffff"
      ctx.fillText(line, SIDE + 28, TOP_SAFE + 52)
    })
  }
  rise(appear(seconds, 0.4), () => {
    ctx.font = font(800, 104)
    ctx.fillStyle = "#ffffff"
    headline.forEach((line, index) => ctx.fillText(line, SIDE, headlineTop + 104 + index * 116))
  })
  if (subline.length) {
    rise(appear(seconds, 1.1), () => {
      ctx.font = font(600, 46)
      ctx.fillStyle = "#f4eee8"
      ctx.fillText(subline[0], SIDE, sublineY)
    })
  }
  if (caption.price) {
    rise(appear(seconds, 1.8), () => {
      ctx.font = font(800, 84)
      ctx.fillStyle = "#ffc79e"
      const [line] = wrap(ctx, caption.price ?? "", textWidth, 1)
      ctx.fillText(line, SIDE, priceY)
    })
  }
  if (caption.cta) {
    rise(appear(seconds, 2.8), () => {
      ctx.font = font(800, 44)
      const [line] = wrap(ctx, caption.cta ?? "", textWidth - 88, 1)
      const pillWidth = ctx.measureText(line).width + 88
      ctx.fillStyle = "#ffffff"
      ctx.beginPath()
      ctx.roundRect(SIDE, ctaY, pillWidth, 92, 46)
      ctx.fill()
      ctx.fillStyle = `rgb(${accent})`
      ctx.fillText(line, SIDE + 44, ctaY + 62)
    })
  }
}

/** The 고급형 serif (index.html loads it from Google Fonts); Pretendard stays for the information lines. */
const SERIF = '"Noto Serif KR", "Nanum Myeongjo", serif'
const serif = (weight: number, size: number) => `${weight} ${size}px ${SERIF}`
const CREAM = "#fff7ea"
const GOLD = "#f0cf98"

/** Loads the caption fonts before the first frame is drawn (a frame drawn earlier would use the fallback). */
export async function loadCaptionFonts(texts: string[]) {
  if (typeof document === "undefined" || !document.fonts?.load) return
  const sample = texts.filter(Boolean).join(" ") || "가"
  try {
    await Promise.all([serif(600, 88), font(500, 46), font(600, 40), font(700, 46)].map((value) => document.fonts.load(value, sample)))
  } catch {
    // Fallback fonts are fine.
  }
}

/**
 * 고급형 caption, after the reference ad the owner chose (쵸이셀 리디자인), styled like a magazine ad: a gold spaced
 * label behind a short rule, the mood line in a serif, the product name in cream with the price in gold, and the
 * invitation in a thin outlined pill. A soft shade under the text keeps it readable without hiding the picture.
 */
export function drawElegantCaption(ctx: CanvasRenderingContext2D, seconds: number, caption: VideoCaption & { mood?: string; label?: string }) {
  const { width, height } = ctx.canvas
  const textWidth = width - SIDE * 2
  const bottom = height - BOTTOM_SAFE
  const shade = ctx.createLinearGradient(0, bottom - 720, 0, height)
  shade.addColorStop(0, "rgba(16,11,8,0)")
  shade.addColorStop(0.3, "rgba(16,11,8,.5)")
  shade.addColorStop(1, "rgba(16,11,8,.8)")
  ctx.fillStyle = shade
  ctx.fillRect(0, bottom - 720, width, height - bottom + 720)
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  const fadeIn = (from: number, draw: () => void) => {
    const value = appear(seconds, from)
    if (value <= 0) return
    ctx.save()
    ctx.globalAlpha = value
    ctx.translate(0, (1 - value) * 14)
    ctx.shadowColor = "rgba(0,0,0,.35)"
    ctx.shadowBlur = 14
    draw()
    ctx.restore()
  }
  // Line 1: the label; line 2: the mood line (or the headline); line 3: the product name and price; line 4: the invitation.
  const mood = caption.mood || caption.headline
  const name = caption.subline && caption.subline !== mood ? caption.subline : ""
  const price = caption.price ?? ""
  const label = caption.label ?? (name ? caption.eyebrow ?? "" : [caption.eyebrow, caption.subline].filter(Boolean).join("  /  "))
  let y = bottom - 30
  const invite = caption.cta ? `${caption.cta}  →` : ""
  if (invite) {
    fadeIn(2.0, () => {
      ctx.font = font(600, 40)
      const line = wrap(ctx, invite, textWidth - 76, 1)[0]
      const pillWidth = ctx.measureText(line).width + 76
      ctx.shadowBlur = 0
      ctx.strokeStyle = "rgba(255,247,234,.9)"
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.roundRect(SIDE, y - 58, pillWidth, 84, 42)
      ctx.stroke()
      ctx.fillStyle = CREAM
      ctx.fillText(line, SIDE + 38, y - 2)
    })
    y -= 128
  }
  if (name || price) {
    fadeIn(1.2, () => {
      ctx.font = font(500, 46)
      const shown = wrap(ctx, name, textWidth, 1)[0] ?? ""
      ctx.fillStyle = CREAM
      ctx.fillText(shown, SIDE, y)
      if (price) {
        const gap = shown ? ctx.measureText(shown + "   ").width : 0
        ctx.font = font(700, 46)
        ctx.fillStyle = GOLD
        ctx.fillText(wrap(ctx, price, Math.max(textWidth - gap, 120), 1)[0], SIDE + gap, y)
      }
    })
    y -= 104
  }
  ctx.font = serif(600, 88)
  const moodLines = wrap(ctx, mood, textWidth, 2)
  const moodBaseline = y
  fadeIn(0.3, () => {
    ctx.font = serif(600, 88)
    ctx.fillStyle = CREAM
    moodLines.forEach((line, index) => ctx.fillText(line, SIDE, moodBaseline - (moodLines.length - 1 - index) * 112))
  })
  const labelBaseline = moodBaseline - (moodLines.length - 1) * 112 - 88 - 40
  if (label) {
    fadeIn(0, () => {
      ctx.fillStyle = GOLD
      ctx.fillRect(SIDE, labelBaseline - 12, 44, 3)
      ctx.font = font(600, 32)
      ctx.fillStyle = CREAM
      if ("letterSpacing" in ctx) ctx.letterSpacing = "8px"
      ctx.fillText(wrap(ctx, label.toUpperCase(), textWidth - 64, 1)[0], SIDE + 64, labelBaseline)
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px"
    })
  }
}
