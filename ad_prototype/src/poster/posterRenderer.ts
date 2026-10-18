// Ported from D_고혜숙/src/poster/posterRenderer.js — themes, ratios and the three compositions.
// Changes for this app:
// - TypeScript types; Pretendard (the app font) with Noto Sans KR fallback.
// - No placeholder copy: empty description / point / audience lines are simply not drawn, so a poster
//   with only the product name shows the name once (fixes "포스터 제목 중복").
// - Demo labels ("PRODUCT STORY", "POSTER 01", "제품 포스터 시안", "샘플 포스터") are replaced by the
//   shop name / a short eyebrow, and the ratio·theme footer is dropped: the PNG is meant to be posted.
// - A `warm` theme (not in D) for 친근, using the app's orange tokens.
// - Returns the text that was actually drawn (for the screen-reader description).

export type PosterTheme = {
  id: string
  shortName: string
  tag: string
  bgGradient: [string, string, string]
  ink: string
  sub: string
  accent: string
  accentText: string
  paper: string
}

export const POSTER_THEMES = {
  nature: {
    id: "nature", shortName: "자연스러운", tag: "편안하고 따뜻한 분위기",
    bgGradient: ["#f0f6e9", "#dcebd3", "#bed8b4"], ink: "#173f2b", sub: "#42664d", accent: "#70a55f", accentText: "#173f2b", paper: "#fbfcf8",
  },
  luxury: {
    id: "luxury", shortName: "고급스러운", tag: "차분하고 깊은 분위기",
    bgGradient: ["#171d19", "#27352d", "#405346"], ink: "#f7e7bb", sub: "#dfd5b7", accent: "#caa557", accentText: "#202a24", paper: "#202a24",
  },
  minimal: {
    id: "minimal", shortName: "깔끔한", tag: "정돈되고 담백한 분위기",
    bgGradient: ["#f7f6f1", "#eaeae4", "#d8ddd7"], ink: "#1e2823", sub: "#536159", accent: "#8ca095", accentText: "#1e2823", paper: "#ffffff",
  },
  vibrant: {
    id: "vibrant", shortName: "생동감 있는", tag: "밝고 경쾌한 분위기",
    bgGradient: ["#fff0d7", "#ffd6ad", "#f5ad7c"], ink: "#732f20", sub: "#8f4b35", accent: "#e7683f", accentText: "#732f20", paper: "#fff8ee",
  },
  // Added for this app (not in D): friendly = the app's warm orange palette.
  warm: {
    id: "warm", shortName: "따뜻한", tag: "친근하고 다정한 분위기",
    bgGradient: ["#fdf6ef", "#f6e3d3", "#ebc7aa"], ink: "#4a2614", sub: "#6e4a36", accent: "#f2b48a", accentText: "#4a2614", paper: "#fffaf5",
  },
} satisfies Record<string, PosterTheme>

export type PosterThemeKey = keyof typeof POSTER_THEMES

export const POSTER_COMPOSITIONS = {
  vertical: { id: "vertical", name: "세로 집중", tag: "큰 제품 사진과 핵심 정보" },
  split: { id: "split", name: "사이드 분할", tag: "문구와 사진을 나란히" },
  editorial: { id: "editorial", name: "에디토리얼", tag: "사진을 먼저 보여주기" },
} as const

export type PosterCompositionKey = keyof typeof POSTER_COMPOSITIONS

export const POSTER_RATIOS = {
  "4:5": { id: "4:5", width: 1080, height: 1350, label: "SNS 세로형", platform: "Instagram" },
  "1:1": { id: "1:1", width: 1080, height: 1080, label: "정사각형", platform: "Feed" },
  "9:16": { id: "9:16", width: 1080, height: 1920, label: "스토리 세로형", platform: "Story" },
} as const

export type PosterRatioKey = keyof typeof POSTER_RATIOS

export type PosterContent = {
  /** Small line above the title (shop name or a short label). */
  eyebrow?: string
  productName: string
  productDescription?: string
  keySellingPoint?: string
  targetAudience?: string
  /** What to do next ("달빛제과에서 만나보세요"); shown as a pill when there is no price to close on. */
  callToAction?: string
}

export const POSTER_FONT = '"Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif'
const font = (weight: number | string, size: number) => `${weight} ${size}px ${POSTER_FONT}`

// WCAG 2.2 contrast: some theme pairs fall short (vibrant badge 2.99:1, nature 4.06:1), so text colours
// are picked per background from a few candidates.
function luminance(hex: string) {
  const value = hex.replace("#", "")
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value.slice(0, 6)
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrastRatio(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
/** The first candidate with at least 4.5:1 on `background`, else the one with the highest contrast. */
export function readableOn(background: string, candidates: string[]) {
  const ok = candidates.find((color) => contrastRatio(color, background) >= 4.5)
  return ok ?? [...candidates].sort((a, b) => contrastRatio(b, background) - contrastRatio(a, background))[0]
}
const textColors = (theme: PosterTheme) => ({
  badge: readableOn(theme.accent, [theme.accentText, theme.ink, "#ffffff", "#1d1a17"]),
  sub: readableOn(theme.paper, [theme.sub, theme.ink]),
})

type Ctx = CanvasRenderingContext2D
type Img = HTMLImageElement | ImageBitmap | null | undefined

function imageSize(image: Img) {
  if (!image) return null
  const width = "naturalWidth" in image ? image.naturalWidth : image.width
  const height = "naturalHeight" in image ? image.naturalHeight : image.height
  if ("complete" in image && !image.complete) return null
  return width && height ? { width, height } : null
}

function roundedRect(ctx: Ctx, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

/** Word wrap with character fallback for long unspaced Korean words; adds "…" when clipped. */
export function wrapText(ctx: Ctx, text: string, maxWidth: number, maxLines: number) {
  const lines: string[] = []
  let line = ""
  const words = String(text || "").trim().split(/\s+/).filter(Boolean)

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = ""
    for (const character of Array.from(word)) {
      const next = line + character
      if (ctx.measureText(next).width <= maxWidth) line = next
      else {
        if (line) lines.push(line)
        line = character
      }
    }
  }

  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const clipped = lines.slice(0, maxLines)
  let last = clipped[maxLines - 1]
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = Array.from(last).slice(0, -1).join("")
  clipped[maxLines - 1] = `${last.trimEnd()}…`
  return clipped
}

function drawLines(ctx: Ctx, lines: string[], { x, y, font: fontValue, color, lineHeight }: { x: number; y: number; font: string; color: string; lineHeight: number }) {
  ctx.font = fontValue
  ctx.fillStyle = color
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight))
  return lines.length * lineHeight
}

function getContainedImageRect(size: { width: number; height: number }, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / size.width, height / size.height)
  const drawWidth = size.width * scale
  const drawHeight = size.height * scale
  return { x: x + (width - drawWidth) / 2, y: y + (height - drawHeight) / 2, width: drawWidth, height: drawHeight }
}

function drawCoverImage(ctx: Ctx, image: Img, x: number, y: number, width: number, height: number) {
  const size = imageSize(image)
  if (!image || !size) return
  const scale = Math.max(width / size.width, height / size.height)
  const drawWidth = size.width * scale
  const drawHeight = size.height * scale
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight)
}

/** Product box on a 0–1000 grid ([ymin, xmin, ymax, xmax]) from the photo analysis. */
export type FocusBox = [number, number, number, number]

/** Source rectangle around the product: the box plus a 15% margin, clamped to the photo. */
function sourceRect(size: { width: number; height: number }, focus?: FocusBox | null) {
  if (!focus) return { x: 0, y: 0, width: size.width, height: size.height }
  const [ymin, xmin, ymax, xmax] = focus
  const marginX = ((xmax - xmin) / 1000) * size.width * 0.15
  const marginY = ((ymax - ymin) / 1000) * size.height * 0.15
  const x = Math.max(0, (xmin / 1000) * size.width - marginX)
  const y = Math.max(0, (ymin / 1000) * size.height - marginY)
  const right = Math.min(size.width, (xmax / 1000) * size.width + marginX)
  const bottom = Math.min(size.height, (ymax / 1000) * size.height + marginY)
  return { x, y, width: right - x, height: bottom - y }
}

let currentFocus: FocusBox | null = null

/** Large Korean titles read tighter with about -1.5% tracking; browsers without canvas letterSpacing ignore it. */
function setTitleTracking(ctx: Ctx, size: number) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${-Math.round(size * 0.015)}px`
}
function resetTracking(ctx: Ctx) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px"
}

function fitTitle(ctx: Ctx, text: string, maxWidth: number, maxLines: number, startSize: number, minSize: number) {
  const fitted = fitTitleLines(ctx, text, maxWidth, maxLines, startSize, minSize)
  resetTracking(ctx)
  return fitted
}

function fitTitleLines(ctx: Ctx, text: string, maxWidth: number, maxLines: number, startSize: number, minSize: number) {
  for (let size = startSize; size >= minSize; size -= 2) {
    ctx.font = font(800, size)
    setTitleTracking(ctx, size)
    const lines = wrapText(ctx, text, maxWidth, maxLines)
    const fits = !lines[lines.length - 1]?.endsWith("…") || size === minSize
    if (fits && lines.every((line) => ctx.measureText(line).width <= maxWidth)) return { size, lines }
  }
  ctx.font = font(800, minSize)
  setTitleTracking(ctx, minSize)
  return { size: minSize, lines: wrapText(ctx, text, maxWidth, maxLines) }
}

type RenderArgs = { ctx: Ctx; image: Img; background: Img; content: PosterContent; theme: PosterTheme; width: number; height: number }

/**
 * Cover-crops the photo into the rectangle, centred on the product box when the photo analysis gave one, and
 * never reaching outside the photo.
 */
function drawPhotoCover(ctx: Ctx, image: Img, x: number, y: number, width: number, height: number) {
  const size = imageSize(image)
  if (!image || !size) return false
  const focus = sourceRect(size, currentFocus)
  const scale = Math.max(width / focus.width, height / focus.height, width / size.width, height / size.height)
  const cropWidth = Math.min(size.width, width / scale)
  const cropHeight = Math.min(size.height, height / scale)
  const centerX = focus.x + focus.width / 2
  const centerY = focus.y + focus.height / 2
  const sx = Math.min(size.width - cropWidth, Math.max(0, centerX - cropWidth / 2))
  const sy = Math.min(size.height - cropHeight, Math.max(0, centerY - cropHeight / 2))
  ctx.drawImage(image, sx, sy, cropWidth, cropHeight, x, y, width, height)
  return true
}

/** "5,500원 · 직접 만든 크림" → the price (shown large) and the other short points (shown as a badge). */
function splitPoint(point: string) {
  const items = point.split("·").map((item) => item.trim()).filter(Boolean)
  const price = items.find((item) => /\d/.test(item) && /원|₩|만/.test(item)) ?? ""
  return { price, others: items.filter((item) => item !== price) }
}

function drawPill(ctx: Ctx, text: string, x: number, y: number, { size, background, color }: { size: number; background: string; color: string }) {
  ctx.font = font(800, size)
  const width = ctx.measureText(text).width + size * 1.4
  const height = size * 1.9
  ctx.fillStyle = background
  roundedRect(ctx, x, y, width, height, height / 2)
  ctx.fill()
  ctx.fillStyle = color
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(text, x + size * 0.7, y + height / 2 + 1)
  return { width, height }
}

const DARK = "#1d1a17"

/**
 * "사진 크게": the photo fills the poster and the text sits on a dark fade at the bottom, like a magazine ad
 * (the coffee sample on the home screen). Story (9:16) keeps the top 250px and the bottom 340px clear.
 */
function renderFullBleedPoster({ ctx, image, content, theme, width, height }: RenderArgs) {
  const { eyebrow = "", productName, productDescription = "", keySellingPoint = "", targetAudience = "" } = content
  const drawn: string[] = []
  const isStory = height > 1500
  const side = 72
  const bottomSafe = isStory ? 360 : 76
  const topSafe = isStory ? 260 : 64
  const textWidth = width - side * 2

  ctx.fillStyle = theme.bgGradient[1]
  ctx.fillRect(0, 0, width, height)
  drawPhotoCover(ctx, image, 0, 0, width, height)

  // Measure the text block first (bottom-up) so the dark fade sits exactly behind it.
  const { price, others } = splitPoint(keySellingPoint)
  // Every other point goes in the badge (a second price, "당일 예약" …), cut to one line.
  ctx.font = font(800, 34)
  const badge = others.length ? wrapText(ctx, others.join("  ·  "), textWidth - 48, 1)[0] : ""
  const title = fitTitle(ctx, productName, textWidth, 2, isStory ? 124 : 112, 64)
  const titleLineHeight = title.size * 1.12
  ctx.font = font(500, 44)
  const descriptionLines = productDescription ? wrapText(ctx, productDescription, textWidth, 2) : []
  // No price to close on: the poster ends with what to do (a white pill), not with who it suits.
  const cta = !price && content.callToAction ? content.callToAction.trim() : ""
  const audience = cta ? "" : targetAudience ? `${targetAudience}에게 추천해요` : ""
  const priceSize = 76
  let y = height - bottomSafe
  const priceY = price ? y : 0
  if (price) y -= priceSize + 30
  const ctaY = cta ? y - 76 : 0
  if (cta) y -= 76 + 34
  const audienceY = !price && audience ? y : 0
  if (!price && audience) y -= 34 + 28
  const descriptionY = descriptionLines.length ? y - (descriptionLines.length - 1) * 56 : 0
  if (descriptionLines.length) y -= descriptionLines.length * 56 + 18
  const titleBottom = y
  const titleTop = titleBottom - (title.lines.length - 1) * titleLineHeight - title.size
  const badgeY = badge ? titleTop - 36 - 64 : 0
  const blockTop = badge ? badgeY : titleTop

  // Dark fade from well above the text to the bottom; a light one at the top keeps the shop name readable.
  const fade = ctx.createLinearGradient(0, Math.max(0, blockTop - 420), 0, height)
  fade.addColorStop(0, "rgba(20,14,10,0)")
  fade.addColorStop(Math.min(0.9, 420 / Math.max(1, height - blockTop + 420)), "rgba(20,14,10,.66)")
  fade.addColorStop(1, "rgba(20,14,10,.9)")
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, width, height)
  if (eyebrow) {
    const top = ctx.createLinearGradient(0, 0, 0, topSafe + 200)
    top.addColorStop(0, "rgba(20,14,10,.55)")
    top.addColorStop(1, "rgba(20,14,10,0)")
    ctx.fillStyle = top
    ctx.fillRect(0, 0, width, topSafe + 200)
    // On a dark see-through pill so the shop name stays readable on a bright photo.
    ctx.font = font(800, 38)
    const [line] = wrapText(ctx, eyebrow, textWidth - 56, 1)
    drawPill(ctx, line, side, topSafe, { size: 38, background: "rgba(20,14,10,.62)", color: "#ffffff" })
    drawn.push(line)
  }

  if (badge) {
    drawPill(ctx, badge, side, badgeY, { size: 34, background: "#ffffff", color: readableOn("#ffffff", [theme.accent, theme.ink, DARK]) })
    drawn.push(badge)
  }
  setTitleTracking(ctx, title.size)
  drawLines(ctx, title.lines, { x: side, y: titleTop + title.size, font: font(800, title.size), color: "#ffffff", lineHeight: titleLineHeight })
  resetTracking(ctx)
  drawn.push(title.lines.join(" "))
  if (descriptionLines.length) {
    drawLines(ctx, descriptionLines, { x: side, y: descriptionY, font: font(500, 44), color: "#f4eee8", lineHeight: 56 })
    drawn.push(descriptionLines.join(" "))
  }
  if (price) {
    // A light tint of the accent, kept readable on the dark fade.
    const priceColor = readableOn(DARK, ["#ffc79e", "#ffd9bd", "#ffffff"])
    drawLines(ctx, [price], { x: side, y: priceY, font: font(800, priceSize), color: priceColor, lineHeight: priceSize })
    drawn.push(price)
  } else if (cta) {
    ctx.font = font(800, 36)
    const [line] = wrapText(ctx, cta, textWidth - 56, 1)
    drawPill(ctx, line, side, ctaY, { size: 36, background: "#ffffff", color: readableOn("#ffffff", [theme.accent, theme.ink, DARK]) })
    drawn.push(line)
  } else if (audience) {
    ctx.font = font(600, 34)
    const [line] = wrapText(ctx, audience, textWidth, 1)
    drawLines(ctx, [line], { x: side, y: audienceY, font: font(600, 34), color: "#f4eee8", lineHeight: 40 })
    drawn.push(line)
  }
  return drawn
}

/**
 * "사진 먼저": the photo fills the top and fades into a calm panel with the text centred below it (the cake
 * sample on the home screen).
 */
function renderPanelPoster({ ctx, image, content, theme, width, height }: RenderArgs) {
  const { eyebrow = "", productName, productDescription = "", keySellingPoint = "", targetAudience = "" } = content
  const drawn: string[] = []
  const isStory = height > 1500
  const isSquare = width === height
  const paper = theme.id === "luxury" ? theme.paper : "#fdf8f3"
  const ink = readableOn(paper, [theme.ink, DARK, "#ffffff"])
  const sub = readableOn(paper, [theme.sub, "#5b4f47", ink])
  const accent = readableOn(paper, [theme.accent, theme.ink, ink])
  const side = 72
  const textWidth = width - side * 2
  // Measure the text first: the photo takes whatever the text does not need (within limits), so a poster
  // with little text is not left with a half-empty panel.
  // The price is shown large under the description (like 사진 크게); the other points and who it suits share the
  // info row, so a second price or "당일 예약" is no longer cut off a single small line.
  const { price, others } = splitPoint(keySellingPoint)
  const left = others.join("  ·  ")
  const right = targetAudience ? `${targetAudience} 추천` : ""
  const hasRow = Boolean(left || right)
  const title = fitTitle(ctx, productName, textWidth, 2, isStory ? 112 : isSquare ? 84 : 100, 56)
  ctx.font = font(500, isSquare ? 36 : 40)
  const descriptionLines = productDescription ? wrapText(ctx, productDescription, textWidth, isSquare ? 1 : 2) : []
  const eyebrowHeight = eyebrow ? (isSquare ? 24 : 34) + 38 : 0
  const titleHeight = title.size + (title.lines.length - 1) * title.size * 1.12
  const descriptionHeight = descriptionLines.length ? (isSquare ? 50 : 66) + (descriptionLines.length - 1) * 54 : 0
  const priceSize = isSquare ? 60 : 72
  const priceHeight = price ? priceSize + (isSquare ? 30 : 40) : 0
  const blockHeight = eyebrowHeight + titleHeight + descriptionHeight + priceHeight
  const bottomSafe = isStory ? 340 : isSquare ? 40 : 60
  const rowHeight = hasRow ? 150 : 0
  const needed = blockHeight + rowHeight + (isSquare ? 70 : 120)
  // A story with little text gives the photo up to 3/4 of the height, so no half-empty panel is left.
  const [minShare, maxShare] = isStory ? [0.5, 0.75] : isSquare ? [0.5, 0.62] : [0.56, 0.68]
  const photoHeight = Math.round(Math.min(height * maxShare, Math.max(height * minShare, height - bottomSafe - needed)))

  ctx.fillStyle = paper
  ctx.fillRect(0, 0, width, height)
  drawPhotoCover(ctx, image, 0, 0, width, photoHeight)
  const fade = ctx.createLinearGradient(0, photoHeight - 220, 0, photoHeight)
  fade.addColorStop(0, `${paper}00`)
  fade.addColorStop(1, paper)
  ctx.fillStyle = fade
  ctx.fillRect(0, photoHeight - 220, width, 220)

  const center = width / 2
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  // The text block sits in the middle of the panel (above the info row when there is one).
  const rowY = height - bottomSafe - (isStory ? 40 : isSquare ? 24 : 32)
  const panelTop = photoHeight + 16
  const panelBottom = hasRow ? rowY - 110 : height - bottomSafe
  let y = Math.max(panelTop + (isSquare ? 30 : 44), panelTop + (panelBottom - panelTop - blockHeight) / 2 + (eyebrow ? 30 : 0))
  if (eyebrow) {
    ctx.font = font(800, 38)
    const [line] = wrapText(ctx, eyebrow, textWidth, 1)
    ctx.fillStyle = accent
    ctx.fillText(line, center, y)
    drawn.push(line)
    y += isSquare ? 24 : 34
  }
  setTitleTracking(ctx, title.size)
  ctx.font = font(800, title.size)
  ctx.fillStyle = ink
  title.lines.forEach((line, index) => ctx.fillText(line, center, y + title.size + index * title.size * 1.12))
  resetTracking(ctx)
  drawn.push(title.lines.join(" "))
  y += title.size + (title.lines.length - 1) * title.size * 1.12 + (isSquare ? 50 : 66)
  if (descriptionLines.length) {
    ctx.font = font(500, isSquare ? 36 : 40)
    ctx.fillStyle = sub
    descriptionLines.forEach((line, index) => ctx.fillText(line, center, y + index * 54))
    drawn.push(descriptionLines.join(" "))
    y += (descriptionLines.length - 1) * 54
  }
  if (price) {
    y += (descriptionLines.length ? (isSquare ? 30 : 40) : 0) + priceSize
    ctx.font = font(800, priceSize)
    ctx.fillStyle = accent
    const [line] = wrapText(ctx, price, textWidth, 1)
    ctx.fillText(line, center, y)
    drawn.push(line)
  }

  // Info row at the bottom: the selling point on the left, who it is for on the right.
  if (hasRow) {
    ctx.save()
    ctx.strokeStyle = `${sub}55`
    ctx.lineWidth = 2
    ctx.setLineDash([10, 10])
    ctx.beginPath()
    ctx.moveTo(side, rowY - 62)
    ctx.lineTo(width - side, rowY - 62)
    ctx.stroke()
    ctx.restore()
    ctx.font = font(700, 34)
    if (left && right) {
      const [l] = wrapText(ctx, left, textWidth * 0.56, 1)
      const [r] = wrapText(ctx, right, textWidth * 0.4, 1)
      ctx.fillStyle = ink
      ctx.textAlign = "left"
      ctx.fillText(l, side, rowY)
      ctx.fillStyle = sub
      ctx.textAlign = "right"
      ctx.fillText(r, width - side, rowY)
      drawn.push(l, r)
    } else {
      const [line] = wrapText(ctx, left || right, textWidth, 1)
      ctx.fillStyle = ink
      ctx.textAlign = "center"
      ctx.fillText(line, center, rowY)
      drawn.push(line)
    }
  }
  ctx.textAlign = "left"
  return drawn
}

function drawProductPhoto(ctx: Ctx, image: Img, rect: { x: number; y: number; width: number; height: number }, theme: PosterTheme) {
  const { x, y, width, height } = rect
  ctx.save()
  ctx.shadowColor = "rgba(25,48,31,.20)"
  ctx.shadowBlur = 32
  ctx.shadowOffsetY = 14
  ctx.fillStyle = theme.paper
  roundedRect(ctx, x, y, width, height, 42)
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundedRect(ctx, x, y, width, height, 42)
  ctx.clip()
  const size = imageSize(image)
  if (image && size) {
    ctx.save()
    ctx.filter = "blur(26px) saturate(1.08)"
    drawCoverImage(ctx, image, x - 24, y - 24, width + 48, height + 48)
    ctx.restore()
    ctx.save()
    ctx.globalAlpha = 0.13
    ctx.fillStyle = theme.paper
    ctx.fillRect(x, y, width, height)
    ctx.restore()
    const source = sourceRect(size, currentFocus)
    const photo = getContainedImageRect(source, x + width * 0.035, y + height * 0.035, width * 0.93, height * 0.93)
    ctx.drawImage(image, source.x, source.y, source.width, source.height, photo.x, photo.y, photo.width, photo.height)
  } else {
    ctx.fillStyle = theme.paper
    ctx.fillRect(x, y, width, height)
  }
  ctx.restore()
}

export type RenderPosterOptions = {
  canvas: HTMLCanvasElement
  content: PosterContent
  productImage: Img
  backgroundImage?: Img
  themeKey?: PosterThemeKey
  ratioKey?: PosterRatioKey
  compositionKey?: PosterCompositionKey
  /** Product box from the photo analysis; the photo is cropped around it so the product reads larger. */
  focusBox?: FocusBox | null
  /** Colours taken from the product photo; they replace the theme's accent, tints and ink. */
  photoColors?: { accent: string; bg: [string, string, string]; ink: string; sub: string } | null
  /** Small visible "AI 활용" mark (인공지능기본법 제31조) when an AI wrote part of the poster text. */
  aiMark?: boolean
}

function drawAiMark(ctx: Ctx, width: number, height: number, isStory: boolean, atTop = false) {
  const label = "AI 활용"
  ctx.save()
  ctx.font = font(700, 24)
  const w = ctx.measureText(label).width + 28
  const h = 40
  const x = width - w - 24
  // Stories: above Instagram's bottom UI band (340px); otherwise near the bottom-right corner.
  const y = atTop ? (isStory ? 260 : 24) : height - h - (isStory ? 352 : 24)
  ctx.fillStyle = "rgba(29,26,23,.62)"
  roundedRect(ctx, x, y, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(label, x + 14, y + h / 2 + 1)
  ctx.restore()
}

/** Draws the poster and returns the visible text lines, or null when the canvas is unusable. */
export function renderPosterToCanvas({
  canvas,
  content,
  productImage,
  backgroundImage,
  themeKey = "nature",
  ratioKey = "4:5",
  compositionKey = "vertical",
  aiMark = false,
  photoColors = null,
  focusBox = null,
}: RenderPosterOptions): string[] | null {
  currentFocus = focusBox
  const baseTheme: PosterTheme = POSTER_THEMES[themeKey] ?? POSTER_THEMES.nature
  // Photo colours apply to the light themes only; the dark luxury theme keeps its own palette.
  const theme: PosterTheme = photoColors && themeKey !== "luxury"
    ? { ...baseTheme, accent: photoColors.accent, accentText: photoColors.ink, bgGradient: photoColors.bg, ink: photoColors.ink, sub: photoColors.sub, paper: "#ffffff" }
    : baseTheme
  const ratio = POSTER_RATIOS[ratioKey] ?? POSTER_RATIOS["4:5"]
  const { width, height } = ratio
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  if (compositionKey === "vertical" || compositionKey === "editorial") {
    const render = compositionKey === "vertical" ? renderFullBleedPoster : renderPanelPoster
    const drawn = render({ ctx, image: productImage, background: backgroundImage, content, theme, width, height })
    if (aiMark) drawAiMark(ctx, width, height, ratioKey === "9:16", compositionKey === "editorial")
    return drawn
  }

  const { eyebrow = "", productName, productDescription = "", keySellingPoint = "", targetAudience = "" } = content
  const drawn: string[] = []
  const colors = textColors(theme)
  const isStory = ratioKey === "9:16"
  // Story safe zone (see renderFullBleedPoster): nothing in the top ~250px or the bottom ~340px.
  const top = isStory ? 170 : 0
  const isSquare = ratioKey === "1:1"
  const pad = 82
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, theme.bgGradient[0])
  gradient.addColorStop(0.6, theme.bgGradient[1])
  gradient.addColorStop(1, theme.bgGradient[2])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  if (imageSize(backgroundImage)) {
    ctx.save()
    ctx.filter = "blur(24px) saturate(1.08)"
    drawCoverImage(ctx, backgroundImage, -48, -48, width + 96, height + 96)
    ctx.restore()
    ctx.save()
    ctx.globalAlpha = 0.58
    ctx.fillStyle = theme.paper
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  }

  if (eyebrow) {
    ctx.font = font(700, 36)
    const [line] = wrapText(ctx, eyebrow, width - pad * 2, 1)
    drawLines(ctx, [line], { x: pad, y: 82 + top, font: font(700, 36), color: theme.ink, lineHeight: 44 })
    drawn.push(line)
  }

  let imageRect: { x: number; y: number; width: number; height: number }
  const titleX = pad
  let titleY: number
  let titleWidth: number
  let descriptionY: number
  let copyWidth: number
  let maxTitleLines: number
  let titleSize: number

  if (compositionKey === "split" && !isSquare) {
    imageRect = { x: 570, y: isStory ? 400 : 300, width: 430, height: isStory ? 1000 : 760 }
    titleY = isStory ? 430 : 370
    titleWidth = imageRect.x - titleX - 52
    descriptionY = titleY + (isStory ? 330 : 270)
    copyWidth = titleWidth
    maxTitleLines = isStory ? 5 : 4
    titleSize = isStory ? 70 : 58
  } else {
    imageRect = { x: 132, y: isStory ? 650 : isSquare ? 325 : 345, width: 816, height: isStory ? 760 : isSquare ? 380 : 550 }
    titleY = isStory ? 230 + top : isSquare ? 150 : 178
    titleWidth = width - pad * 2
    descriptionY = imageRect.y + imageRect.height + (isStory ? 84 : 70)
    copyWidth = titleWidth * 0.92
    maxTitleLines = isStory ? 3 : 2
    titleSize = isStory ? 78 : 68
  }

  const title = fitTitle(ctx, productName, titleWidth, maxTitleLines, titleSize, 38)
  setTitleTracking(ctx, title.size)
  drawLines(ctx, title.lines, { x: titleX, y: titleY, font: font(800, title.size), color: theme.ink, lineHeight: title.size * 1.17 })
  resetTracking(ctx)
  drawn.push(title.lines.join(" "))

  drawProductPhoto(ctx, productImage, imageRect, theme)

  const descriptionLineCount = isStory ? 3 : 2
  const descriptionSize = isStory ? 36 : 32
  const descriptionLineHeight = isStory ? 50 : 44
  let metaY = descriptionY
  if (productDescription) {
    ctx.font = font(500, descriptionSize)
    const lines = wrapText(ctx, productDescription, copyWidth, descriptionLineCount)
    drawLines(ctx, lines, { x: titleX, y: descriptionY, font: font(500, descriptionSize), color: colors.sub, lineHeight: descriptionLineHeight })
    drawn.push(lines.join(" "))
    metaY = descriptionY + lines.length * descriptionLineHeight + 26
  }

  if (keySellingPoint) {
    ctx.font = font(700, 34)
    const [line] = wrapText(ctx, keySellingPoint, Math.min(copyWidth, 640), 1)
    ctx.fillStyle = theme.accent
    roundedRect(ctx, titleX, metaY - 34, Math.min(copyWidth, ctx.measureText(line).width + 52), 66, 33)
    ctx.fill()
    drawLines(ctx, [line], { x: titleX + 26, y: metaY + 10, font: font(700, 34), color: colors.badge, lineHeight: 40 })
    drawn.push(line)
    metaY += 86
  }

  if (targetAudience) {
    ctx.font = font(600, 32)
    const [line] = wrapText(ctx, `추천 대상  ·  ${targetAudience}`, copyWidth, 1)
    drawLines(ctx, [line], { x: titleX, y: Math.min(metaY + 14, height - (isStory ? 340 : 104)), font: font(600, 32), color: theme.ink, lineHeight: 38 })
    drawn.push(line)
  }
  if (aiMark) drawAiMark(ctx, width, height, isStory)
  return drawn
}

/** Makes sure the Pretendard subsets needed for `texts` are loaded before drawing on canvas. */
export async function loadPosterFonts(texts: string[]) {
  if (typeof document === "undefined" || !document.fonts?.load) return
  const sample = texts.join(" ") || "가"
  try {
    await Promise.all([500, 600, 700, 800].map((weight) => document.fonts.load(font(weight, 40), sample)))
  } catch {
    // Fallback fonts are fine.
  }
  await document.fonts.ready
}
