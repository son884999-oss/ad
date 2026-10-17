// The free video: a 6-second motion graphic drawn in the browser (no AI, no cost, no garbled text).
//   0.0–2.6 s  the photo, a slow push-in, the shop name and the headline rise in
//   2.6–4.4 s  closer on the product, a light sweep across it, the key points pop in as tags
//   4.4–6.0 s  end card over the blurred photo: shop, product name, price, call to action
// The photo is the same 9:16 frame as the one sent for the AI clip (src/videoFrame.ts), and the captions use the
// poster style (src/videoCaption.ts). Reels / Shorts cover about the top 240 px and the bottom 340 px.

import { drawVideoCaption, wrap, type VideoCaption } from "./videoCaption"

export const MOTION_SECONDS = 6
const END_CARD = 4.4

export type MotionScene = {
  /** The photo already framed to the canvas size (9:16). */
  framed: CanvasImageSource
  caption: VideoCaption
  /** Short key points (특징), shown as tags in the middle scene. At most three are used. */
  points: string[]
  /** The shop's colour as "r, g, b". */
  accent: string
}

const FONT = '"Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif'
const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`
const clamp = (value: number) => Math.min(1, Math.max(0, value))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2
const progress = (seconds: number, from: number, length: number) => clamp((seconds - from) / length)

/** Camera: 1.0 → 1.12 over the first scene, then 1.12 → 1.38 a little lower (the product), then still. */
function camera(seconds: number) {
  const first = easeInOut(progress(seconds, 0, 2.6))
  const second = easeInOut(progress(seconds, 2.6, 1.8))
  return { zoom: 1 + 0.12 * first + 0.26 * second, y: 0.035 * second }
}

function drawPhoto(ctx: CanvasRenderingContext2D, scene: MotionScene, seconds: number) {
  const { width, height } = ctx.canvas
  const view = camera(Math.min(seconds, END_CARD))
  ctx.save()
  ctx.translate(width / 2, height / 2 - view.y * height)
  ctx.scale(view.zoom, view.zoom)
  ctx.translate(-width / 2, -height / 2)
  ctx.drawImage(scene.framed, 0, 0, width, height)
  ctx.restore()
}

/** A soft diagonal light band crossing the product once. */
function drawSheen(ctx: CanvasRenderingContext2D, seconds: number) {
  const t = progress(seconds, 2.9, 1.0)
  if (t <= 0 || t >= 1) return
  const { width, height } = ctx.canvas
  const x = -width * 0.6 + t * width * 2.2
  const band = ctx.createLinearGradient(x - 220, 0, x + 220, height * 0.35)
  band.addColorStop(0, "rgba(255,255,255,0)")
  band.addColorStop(0.5, "rgba(255,255,255,.28)")
  band.addColorStop(1, "rgba(255,255,255,0)")
  ctx.save()
  ctx.globalCompositeOperation = "screen"
  ctx.fillStyle = band
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

/** Key points as white tags popping in one after another, under the shop name. */
function drawPoints(ctx: CanvasRenderingContext2D, scene: MotionScene, seconds: number) {
  const fadeOut = 1 - progress(seconds, END_CARD - 0.25, 0.25)
  let y = 340
  scene.points.slice(0, 3).forEach((point, index) => {
    const t = progress(seconds, 3.0 + index * 0.3, 0.35)
    if (t <= 0 || fadeOut <= 0) return
    ctx.font = font(800, 42)
    const [line] = wrap(ctx, point, ctx.canvas.width - 72 * 2 - 64, 1)
    const width = ctx.measureText(line).width + 64
    const scale = easeOutBack(t)
    ctx.save()
    ctx.globalAlpha = Math.min(1, t * 1.6) * fadeOut
    ctx.translate(72, y + 40)
    ctx.scale(scale, scale)
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.roundRect(0, -40, width, 80, 40)
    ctx.fill()
    ctx.fillStyle = `rgb(${scene.accent})`
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillText(line, 32, 2)
    ctx.restore()
    y += 100
  })
}

/** The last scene: blurred photo, dark veil, centred shop · product · price · call to action. */
function drawEndCard(ctx: CanvasRenderingContext2D, scene: MotionScene, seconds: number) {
  const t = progress(seconds, END_CARD, 0.35)
  if (t <= 0) return
  const { width, height } = ctx.canvas
  const { caption } = scene
  ctx.save()
  ctx.globalAlpha = t
  ctx.filter = "blur(28px) brightness(.55)"
  ctx.drawImage(scene.framed, -60, -60, width + 120, height + 120)
  ctx.filter = "none"
  ctx.fillStyle = "rgba(20,14,10,.35)"
  ctx.fillRect(0, 0, width, height)
  ctx.restore()

  const center = width / 2
  const textWidth = width - 72 * 2
  const product = caption.subline || caption.headline
  ctx.font = font(800, 112)
  const title = wrap(ctx, product, textWidth, 2)
  // Stack the lines around the middle of the safe area.
  const blocks: { height: number; draw: (y: number) => void; at: number }[] = []
  if (caption.eyebrow) {
    blocks.push({ height: 76, at: 4.55, draw: (y) => {
      ctx.font = font(800, 40)
      const [line] = wrap(ctx, caption.eyebrow ?? "", textWidth - 56, 1)
      const pill = ctx.measureText(line).width + 56
      ctx.fillStyle = `rgb(${scene.accent})`
      ctx.beginPath()
      ctx.roundRect(center - pill / 2, y, pill, 76, 38)
      ctx.fill()
      ctx.fillStyle = "#ffffff"
      ctx.fillText(line, center, y + 52)
    } })
  }
  blocks.push({ height: title.length * 124, at: 4.7, draw: (y) => {
    ctx.font = font(800, 112)
    ctx.fillStyle = "#ffffff"
    title.forEach((line, index) => ctx.fillText(line, center, y + 104 + index * 124))
  } })
  if (caption.price) {
    blocks.push({ height: 96, at: 4.9, draw: (y) => {
      ctx.font = font(800, 88)
      ctx.fillStyle = "#ffc79e"
      ctx.fillText(wrap(ctx, caption.price ?? "", textWidth, 1)[0], center, y + 80)
    } })
  }
  if (caption.cta) {
    blocks.push({ height: 96, at: 5.1, draw: (y) => {
      ctx.font = font(800, 48)
      const [line] = wrap(ctx, caption.cta ?? "", textWidth - 96, 1)
      const pill = ctx.measureText(line).width + 96
      ctx.fillStyle = "#ffffff"
      ctx.beginPath()
      ctx.roundRect(center - pill / 2, y, pill, 96, 48)
      ctx.fill()
      ctx.fillStyle = `rgb(${scene.accent})`
      ctx.fillText(line, center, y + 64)
    } })
  }
  const gap = 40
  const total = blocks.reduce((sum, block) => sum + block.height, 0) + gap * (blocks.length - 1)
  const top = 240 + (height - 240 - 340 - total) / 2
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  let y = top
  for (const block of blocks) {
    const appear = progress(seconds, block.at, 0.4)
    if (appear > 0) {
      ctx.save()
      ctx.globalAlpha = appear
      ctx.translate(0, (1 - easeInOut(appear)) * 36)
      block.draw(y)
      ctx.restore()
    }
    y += block.height + gap
  }
  ctx.textAlign = "left"
}

/** Draws the frame at `seconds` (0 … MOTION_SECONDS) on a 1080 × 1920 canvas. */
export function drawMotionFrame(ctx: CanvasRenderingContext2D, seconds: number, scene: MotionScene) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  ctx.imageSmoothingQuality = "high"
  drawPhoto(ctx, scene, seconds)
  drawSheen(ctx, seconds)
  if (seconds < END_CARD + 0.35) {
    // Scenes 1–2: shop name and headline only; price and call to action wait for the end card.
    const fade = 1 - progress(seconds, END_CARD, 0.35)
    ctx.save()
    ctx.globalAlpha = fade
    drawVideoCaption(ctx, seconds, { eyebrow: scene.caption.eyebrow, headline: scene.caption.headline, subline: scene.caption.subline }, scene.accent)
    ctx.restore()
    drawPoints(ctx, scene, seconds)
  }
  drawEndCard(ctx, scene, seconds)
}
