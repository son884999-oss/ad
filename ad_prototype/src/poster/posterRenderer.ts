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
}

export const POSTER_FONT = '"Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif'
const font = (weight: number | string, size: number) => `${weight} ${size}px ${POSTER_FONT}`

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

function drawPortraitBackdrop(ctx: Ctx, image: Img, background: Img, width: number, height: number, theme: PosterTheme, photoTop: number) {
  ctx.fillStyle = theme.bgGradient[1]
  ctx.fillRect(0, 0, width, height)
  const size = imageSize(image)
  if (!image || !size) return

  const hasBackground = Boolean(imageSize(background))
  ctx.save()
  ctx.filter = hasBackground ? "blur(22px) saturate(1.08)" : "blur(38px) saturate(1.12)"
  drawCoverImage(ctx, hasBackground ? background : image, -54, -54, width + 108, height + 108)
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = 0.13
  ctx.fillStyle = theme.bgGradient[0]
  ctx.fillRect(0, 0, width, height)
  ctx.restore()

  // The photo fills the area under the text panel so the title never covers the product.
  const photo = getContainedImageRect(size, 0, photoTop, width, height - photoTop)
  ctx.save()
  ctx.shadowColor = "rgba(18,35,24,.24)"
  ctx.shadowBlur = 34
  ctx.shadowOffsetY = 8
  ctx.drawImage(image, photo.x, photo.y, photo.width, photo.height)
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = "rgba(255,255,255,.42)"
  ctx.lineWidth = 2
  ctx.strokeRect(photo.x + 1, photo.y + 1, photo.width - 2, photo.height - 2)
  ctx.restore()
}

function fitTitle(ctx: Ctx, text: string, maxWidth: number, maxLines: number, startSize: number, minSize: number) {
  for (let size = startSize; size >= minSize; size -= 2) {
    ctx.font = font(800, size)
    const lines = wrapText(ctx, text, maxWidth, maxLines)
    const fits = !lines[lines.length - 1]?.endsWith("…") || size === minSize
    if (fits && lines.every((line) => ctx.measureText(line).width <= maxWidth)) return { size, lines }
  }
  ctx.font = font(800, minSize)
  return { size: minSize, lines: wrapText(ctx, text, maxWidth, maxLines) }
}

type RenderArgs = { ctx: Ctx; image: Img; background: Img; content: PosterContent; theme: PosterTheme; width: number; height: number }

function renderVerticalPoster({ ctx, image, background, content, theme, width, height }: RenderArgs) {
  const { eyebrow = "", productName, productDescription = "", keySellingPoint = "", targetAudience = "" } = content
  const drawn: string[] = []
  const panelX = 48
  const panelY = 48
  const panelWidth = width - panelX * 2
  const inset = 38
  const textX = panelX + inset
  const textWidth = panelWidth - inset * 2
  const hasEyebrow = Boolean(eyebrow)
  const titleY = panelY + (hasEyebrow ? 138 : 104)
  const title = fitTitle(ctx, productName, textWidth, 2, height > 1500 ? 80 : 72, 42)
  const titleLineHeight = title.size * 1.12
  const descriptionFontSize = height > 1500 ? 30 : 28
  const descriptionLineHeight = height > 1500 ? 42 : 40
  const lastTitleBaseline = titleY + (title.lines.length - 1) * titleLineHeight
  const descriptionY = lastTitleBaseline + 58
  ctx.font = font(500, descriptionFontSize)
  const descriptionLines = productDescription ? wrapText(ctx, productDescription, textWidth, 2) : []
  const afterDescription = descriptionLines.length ? descriptionY + (descriptionLines.length - 1) * descriptionLineHeight + 28 : lastTitleBaseline + 34
  ctx.font = font(700, 22)
  const benefitLines = keySellingPoint ? wrapText(ctx, keySellingPoint, textWidth - 44, 2) : []
  const benefitY = afterDescription
  const benefitHeight = benefitLines.length ? Math.max(58, benefitLines.length * 28 + 24) : 0
  ctx.font = font(600, 20)
  const audienceLines = targetAudience ? wrapText(ctx, `추천 대상  ·  ${targetAudience}`, textWidth, 2) : []
  const audienceY = benefitLines.length ? benefitY + benefitHeight + 18 : afterDescription + 4
  const panelBottom = audienceLines.length
    ? audienceY + audienceLines.length * 28 + 22
    : benefitLines.length
      ? benefitY + benefitHeight + 30
      : afterDescription + 10
  const panelHeight = panelBottom - panelY

  drawPortraitBackdrop(ctx, image, background, width, height, theme, Math.min(panelBottom + 24, height * 0.55))

  ctx.save()
  ctx.shadowColor = "rgba(17,38,25,.14)"
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 10
  ctx.globalAlpha = 0.97
  ctx.fillStyle = theme.paper
  roundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 34)
  ctx.fill()
  ctx.restore()

  if (hasEyebrow) {
    ctx.fillStyle = theme.accent
    roundedRect(ctx, textX, panelY + 30, 9, 30, 4)
    ctx.fill()
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillStyle = theme.sub
    ctx.font = font(700, 22)
    const [line] = wrapText(ctx, eyebrow, textWidth - 20, 1)
    ctx.fillText(line, textX + 20, panelY + 45)
    drawn.push(line)
  }

  drawLines(ctx, title.lines, { x: textX, y: titleY, font: font(800, title.size), color: theme.ink, lineHeight: titleLineHeight })
  drawn.push(title.lines.join(" "))

  if (descriptionLines.length) {
    drawLines(ctx, descriptionLines, { x: textX, y: descriptionY, font: font(500, descriptionFontSize), color: theme.sub, lineHeight: descriptionLineHeight })
    drawn.push(descriptionLines.join(" "))
  }

  if (benefitLines.length) {
    ctx.font = font(700, 22)
    const pointTextWidth = Math.max(0, ...benefitLines.map((line) => ctx.measureText(line).width))
    const pointWidth = Math.min(textWidth, pointTextWidth + 44)
    ctx.fillStyle = theme.accent
    roundedRect(ctx, textX, benefitY, pointWidth, benefitHeight, Math.min(29, benefitHeight / 2))
    ctx.fill()
    drawLines(ctx, benefitLines, { x: textX + 22, y: benefitY + 37, font: font(700, 22), color: theme.accentText || theme.paper, lineHeight: 28 })
    drawn.push(benefitLines.join(" "))
  }

  if (audienceLines.length) {
    drawLines(ctx, audienceLines, { x: textX, y: audienceY + 22, font: font(600, 20), color: theme.ink, lineHeight: 28 })
    drawn.push(audienceLines.join(" "))
  }
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
    const photo = getContainedImageRect(size, x + width * 0.035, y + height * 0.035, width * 0.93, height * 0.93)
    ctx.drawImage(image, photo.x, photo.y, photo.width, photo.height)
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
}: RenderPosterOptions): string[] | null {
  const theme: PosterTheme = POSTER_THEMES[themeKey] ?? POSTER_THEMES.nature
  const ratio = POSTER_RATIOS[ratioKey] ?? POSTER_RATIOS["4:5"]
  const { width, height } = ratio
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  if (compositionKey === "vertical") {
    return renderVerticalPoster({ ctx, image: productImage, background: backgroundImage, content, theme, width, height })
  }

  const { eyebrow = "", productName, productDescription = "", keySellingPoint = "", targetAudience = "" } = content
  const drawn: string[] = []
  const isStory = ratioKey === "9:16"
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
    ctx.font = font(700, 24)
    const [line] = wrapText(ctx, eyebrow, width - pad * 2, 1)
    drawLines(ctx, [line], { x: pad, y: 82, font: font(700, 24), color: theme.ink, lineHeight: 30 })
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

  if (compositionKey === "editorial") {
    imageRect = { x: pad, y: isStory ? 150 : 125, width: width - pad * 2, height: isStory ? 930 : isSquare ? 450 : 560 }
    titleY = imageRect.y + imageRect.height + (isStory ? 100 : 88)
    titleWidth = width - pad * 2
    descriptionY = titleY + (isStory ? 150 : 120)
    copyWidth = titleWidth * 0.9
    maxTitleLines = 2
    titleSize = isStory ? 80 : 66
  } else if (compositionKey === "split" && !isSquare) {
    imageRect = { x: 570, y: isStory ? 400 : 300, width: 430, height: isStory ? 1080 : 760 }
    titleY = isStory ? 430 : 370
    titleWidth = imageRect.x - titleX - 52
    descriptionY = titleY + (isStory ? 330 : 270)
    copyWidth = titleWidth
    maxTitleLines = isStory ? 5 : 4
    titleSize = isStory ? 70 : 58
  } else {
    imageRect = { x: 132, y: isStory ? 590 : isSquare ? 325 : 345, width: 816, height: isStory ? 880 : isSquare ? 400 : 570 }
    titleY = isStory ? 230 : isSquare ? 150 : 178
    titleWidth = width - pad * 2
    descriptionY = imageRect.y + imageRect.height + (isStory ? 84 : 70)
    copyWidth = titleWidth * 0.92
    maxTitleLines = isStory ? 3 : 2
    titleSize = isStory ? 78 : 68
  }

  const title = fitTitle(ctx, productName, titleWidth, maxTitleLines, titleSize, 38)
  drawLines(ctx, title.lines, { x: titleX, y: titleY, font: font(800, title.size), color: theme.ink, lineHeight: title.size * 1.17 })
  drawn.push(title.lines.join(" "))

  drawProductPhoto(ctx, productImage, imageRect, theme)

  const descriptionLineCount = isStory ? 3 : 2
  const descriptionLineHeight = isStory ? 44 : 38
  let metaY = descriptionY
  if (productDescription) {
    ctx.font = font(500, isStory ? 30 : 26)
    const lines = wrapText(ctx, productDescription, copyWidth, descriptionLineCount)
    drawLines(ctx, lines, { x: titleX, y: descriptionY, font: font(500, isStory ? 30 : 26), color: theme.sub, lineHeight: descriptionLineHeight })
    drawn.push(lines.join(" "))
    metaY = descriptionY + lines.length * descriptionLineHeight + 26
  }

  if (keySellingPoint) {
    ctx.font = font(700, 21)
    const [line] = wrapText(ctx, keySellingPoint, Math.min(copyWidth, 536), 1)
    ctx.fillStyle = theme.accent
    roundedRect(ctx, titleX, metaY - 28, Math.min(copyWidth, ctx.measureText(line).width + 44), 54, 27)
    ctx.fill()
    drawLines(ctx, [line], { x: titleX + 22, y: metaY + 8, font: font(700, 21), color: theme.accentText || theme.paper, lineHeight: 26 })
    drawn.push(line)
    metaY += 72
  }

  if (targetAudience) {
    ctx.font = font(600, 19)
    const [line] = wrapText(ctx, `추천 대상  ·  ${targetAudience}`, copyWidth, 1)
    drawLines(ctx, [line], { x: titleX, y: Math.min(metaY + 12, height - 104), font: font(600, 19), color: theme.ink, lineHeight: 24 })
    drawn.push(line)
  }
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
