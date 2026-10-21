// The free video: a 10-second motion graphic drawn in the browser (no AI, no cost, no garbled text).
//   0.0–3.5 s   the photo, a slow push-in, the shop name and the headline rise in
//   3.5–6.5 s   closer on the product, a light sweep across it, the key points pop in as tags
//   6.5–10.0 s  end card over the blurred photo: shop, product name, price, call to action
// QA 2026-10-21: it was 6 s and the end card (price, call to action) went by in 1.6 s; the extra time is spent
// holding the text still so it can be read, not on more movement.
// The photo is the same 9:16 frame as the one sent for the AI clip (src/videoFrame.ts), and the captions use the
// poster style (src/videoCaption.ts). Reels / Shorts cover about the top 240 px and the bottom 340 px.

import { drawVideoCaption, drawWords, wrap, type VideoCaption } from "./videoCaption"

export const MOTION_SECONDS = 10
const SCENE_2 = 3.5
const END_CARD = 6.5
/** Scene changes, for the transition sound (src/videoSound.ts): just before each cut. */
export const MOTION_CUES = [SCENE_2 - 0.25, END_CARD - 0.25]

export type MotionScene = {
  /** The photo already framed to the canvas size (9:16). */
  framed: CanvasImageSource
  caption: VideoCaption
  /** Short key points (특징), shown as tags in the middle scene. At most three are used. */
  points: string[]
  /** The shop's colour as "r, g, b". */
  accent: string
  /** The kind of product (motionEffectFor): picks the moving touch on top of the photo. */
  effect?: MotionEffect
  /** "AI 활용" in the corner when an AI wrote the copy or drew the background (one mark for both; the
   *  institution's advice 2026-10-19: combine it, or mark conservatively). Same look as the poster's. */
  aiMark?: boolean
}

export type MotionEffect = "steam" | "sparkle" | "petals" | "glow" | "sheen"

/**
 * The same product groups as the AI video prompt (E_이채원 rules in api/_lib/video-prompt.js), plus flowers:
 * food gets rising steam, beauty a sparkle, flowers falling petals, household goods a soft glow.
 */
export function motionEffectFor(text: string): MotionEffect {
  if (/꽃|플라워|부케|화분|\b(flower|flowers|bouquet)\b/i.test(text)) return "petals"
  // A baked or cold dessert is never steamed, even with a flavour word ("녹차 필링" on a 마카롱, 2026-10-18 phone photo).
  if (/케이크|마카롱|쿠키|베이글|타르트|머핀|브라우니|아이스크림|디저트|\b(cake|macaron|cookie|bagel|tart|muffin|brownie|dessert)\b/i.test(text)) return "sheen"
  // Steam only for hot dishes and drinks; cakes, bread and cookies get the light sweep (round 1: steam on a cake).
  if (/커피|라떼|라테|녹차|홍차|밀크티|국밥|국수|라면|찌개|전골|떡볶이|\b(coffee|latte|tea|soup)\b/i.test(text)) return "steam"
  // Cold or room-temperature food before beauty: "생크림 케이크" has "크림" but is no cosmetic (2026-10-18 showcase).
  if (/빵|과자|떡|초콜릿|초코|생크림|크림치즈|식품|반찬|김치|도시락|\b(bread|chocolate|food)\b/i.test(text)) return "sheen"
  if (/화장품|세럼|로션|크림|스킨케어|립스틱|향수|샴푸|비누|\b(cosmetic|serum|lotion|skincare|lipstick|perfume|shampoo|soap)\b/i.test(text)) return "sparkle"
  if (/머그|컵|생활용품|텀블러|수건|주방|그릇|\b(mug|cup|tumbler|towel|kitchen|bowl)\b/i.test(text)) return "glow"
  return "sheen"
}

/** Repeatable "random" numbers, so every render of the same video is identical. */
const seeded = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** Soft wisps rising from the middle of the picture (food): blurred, see-through curves drifting up and fading. */
function drawSteam(ctx: CanvasRenderingContext2D, seconds: number) {
  const { width, height } = ctx.canvas
  const strength = Math.min(1, seconds / 0.8) * (1 - progress(seconds, END_CARD - 0.4, 0.4))
  if (strength <= 0) return
  ctx.save()
  ctx.filter = "blur(12px)"
  ctx.lineCap = "round"
  for (let i = 0; i < 5; i += 1) {
    const life = (seconds * 0.45 + seeded(i + 1)) % 1
    const x = width * (0.38 + 0.24 * seeded(i + 7)) + Math.sin(seconds * 1.3 + i) * 26
    const y = height * (0.3 - life * 0.2)
    ctx.globalAlpha = strength * 0.55 * Math.sin(Math.PI * life)
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 40
    ctx.beginPath()
    ctx.moveTo(x, y + 160)
    ctx.bezierCurveTo(x - 50, y + 100, x + 50, y + 50, x, y)
    ctx.stroke()
  }
  ctx.restore()
}

/** Little four-point stars twinkling around the product (beauty). */
function drawSparkles(ctx: CanvasRenderingContext2D, seconds: number) {
  const { width, height } = ctx.canvas
  const strength = 1 - progress(seconds, END_CARD - 0.4, 0.4)
  if (strength <= 0) return
  ctx.save()
  ctx.fillStyle = "#ffffff"
  for (let i = 0; i < 9; i += 1) {
    const phase = (seconds * 0.9 + seeded(i + 3)) % 1
    const size = 10 + 18 * Math.sin(Math.PI * phase)
    const x = width * (0.22 + 0.56 * seeded(i + 11))
    const y = height * (0.2 + 0.4 * seeded(i + 23))
    ctx.globalAlpha = strength * 0.85 * Math.sin(Math.PI * phase)
    ctx.beginPath()
    ctx.moveTo(x, y - size)
    ctx.quadraticCurveTo(x, y, x + size, y)
    ctx.quadraticCurveTo(x, y, x, y + size)
    ctx.quadraticCurveTo(x, y, x - size, y)
    ctx.quadraticCurveTo(x, y, x, y - size)
    ctx.fill()
  }
  ctx.restore()
}

/** Petals drifting down across the picture (flowers). */
function drawPetals(ctx: CanvasRenderingContext2D, seconds: number) {
  const { width, height } = ctx.canvas
  const strength = 1 - progress(seconds, END_CARD - 0.4, 0.4)
  if (strength <= 0) return
  ctx.save()
  for (let i = 0; i < 12; i += 1) {
    const fall = (seconds * (0.12 + 0.06 * seeded(i + 5)) + seeded(i + 2)) % 1
    const x = width * seeded(i + 9) + Math.sin(seconds * 1.6 + i) * 40
    const y = -60 + fall * (height * 0.72)
    ctx.globalAlpha = strength * 0.8
    ctx.fillStyle = i % 3 ? "#f7c6d0" : "#fde7ee"
    ctx.translate(x, y)
    ctx.rotate(seconds * 1.2 + i)
    ctx.beginPath()
    ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
  ctx.restore()
}

/** A warm light slowly breathing over the middle of the picture (household goods). */
function drawGlow(ctx: CanvasRenderingContext2D, seconds: number) {
  const { width, height } = ctx.canvas
  const strength = (0.5 + 0.5 * Math.sin(seconds * 1.4)) * (1 - progress(seconds, END_CARD - 0.4, 0.4))
  const glow = ctx.createRadialGradient(width * 0.62, height * 0.3, 0, width * 0.62, height * 0.3, width * 0.7)
  glow.addColorStop(0, `rgba(255,236,200,${0.22 * strength})`)
  glow.addColorStop(1, "rgba(255,236,200,0)")
  ctx.save()
  ctx.globalCompositeOperation = "screen"
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

const FONT = '"Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif'
const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`
const clamp = (value: number) => Math.min(1, Math.max(0, value))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2
const progress = (seconds: number, from: number, length: number) => clamp((seconds - from) / length)

/**
 * Two shots of the one photo, cut like an ad (QA 2026-10-22, "여러 장면"): a wide push-in (1.0 → 1.1), then a hard
 * cut to a close-up on the product (1.55 → 1.62) that drifts sideways. The cut itself is a short whip: a sideways
 * motion blur for ~0.6 s. No extra pictures and no cost.
 */
const WHIP = 0.32
function camera(seconds: number) {
  if (seconds < SCENE_2) {
    const t = easeInOut(progress(seconds, 0, SCENE_2))
    return { zoom: 1 + 0.1 * t, x: 0, y: 0 }
  }
  const t = easeInOut(progress(seconds, SCENE_2, END_CARD - SCENE_2))
  // The product sits a little below the middle of the framed photo (src/videoFrame.ts, api/_lib/background.js).
  return { zoom: 1.55 + 0.07 * t, x: 0.05 - 0.1 * t, y: 0.06 }
}

function drawView(ctx: CanvasRenderingContext2D, scene: MotionScene, view: { zoom: number; x: number; y: number }, shift = 0) {
  const { width, height } = ctx.canvas
  ctx.save()
  ctx.translate(width / 2 + (view.x + shift) * width, height / 2 - view.y * height)
  ctx.scale(view.zoom, view.zoom)
  ctx.translate(-width / 2, -height / 2)
  ctx.drawImage(scene.framed, 0, 0, width, height)
  ctx.restore()
}

function drawPhoto(ctx: CanvasRenderingContext2D, scene: MotionScene, seconds: number) {
  const time = Math.min(seconds, END_CARD)
  const whip = 1 - Math.min(1, Math.abs(time - SCENE_2) / WHIP)
  if (whip <= 0) {
    drawView(ctx, scene, camera(time))
    return
  }
  // The whip: the frame slides fast to the left and is smeared sideways, strongest at the cut.
  const side = time < SCENE_2 ? -1 : 1
  ctx.save()
  ctx.filter = `blur(${Math.round(2 + 16 * whip)}px)`
  drawView(ctx, scene, camera(time), side * 0.12 * whip * whip)
  ctx.restore()
}

/** A soft diagonal light band crossing the product once. */
function drawSheen(ctx: CanvasRenderingContext2D, seconds: number) {
  const t = progress(seconds, SCENE_2 + 0.3, 1.2)
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
  // A tag too long for one line is left out, never cut with "…" (QA 2026-10-21).
  const maxText = ctx.canvas.width - 72 * 2 - 64
  ctx.font = font(800, 42)
  const points = scene.points.filter((point) => ctx.measureText(point).width <= maxText)
  points.slice(0, 3).forEach((point, index) => {
    const t = progress(seconds, SCENE_2 + 0.4 + index * 0.4, 0.35)
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
function drawEndCardBackdrop(ctx: CanvasRenderingContext2D, scene: MotionScene, seconds: number) {
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
}

function drawEndCardText(ctx: CanvasRenderingContext2D, scene: MotionScene, seconds: number) {
  if (progress(seconds, END_CARD, 0.35) <= 0) return
  const { width, height } = ctx.canvas
  const { caption } = scene
  const center = width / 2
  const textWidth = width - 72 * 2
  // The big title is the product name since 2026-10-22 (the sub line is the short 포스터·영상 문구).
  const product = caption.headline
  ctx.font = font(800, 112)
  const title = wrap(ctx, product, textWidth, 2)
  // Stack the lines around the middle of the safe area.
  const blocks: { height: number; draw: (y: number) => void; at: number; words?: boolean }[] = []
  if (caption.eyebrow) {
    blocks.push({ height: 76, at: END_CARD + 0.15, draw: (y) => {
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
  blocks.push({ height: title.length * 124, at: END_CARD + 0.35, words: true, draw: (y) => {
    ctx.font = font(800, 112)
    ctx.fillStyle = "#ffffff"
    title.forEach((line, index) => drawWords(ctx, line, center, y + 104 + index * 124, seconds, END_CARD + 0.35 + index * 0.2, "center"))
  } })
  if (caption.price) {
    blocks.push({ height: 96, at: END_CARD + 0.6, draw: (y) => {
      ctx.font = font(800, 88)
      ctx.fillStyle = "#ffc79e"
      ctx.fillText(wrap(ctx, caption.price ?? "", textWidth, 1)[0], center, y + 80)
    } })
  }
  if (caption.cta) {
    blocks.push({ height: 96, at: END_CARD + 0.85, draw: (y) => {
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
    if (appear > 0 || block.words) {
      ctx.save()
      if (!block.words) {
        ctx.globalAlpha = appear
        ctx.translate(0, (1 - easeInOut(appear)) * 36)
      }
      block.draw(y)
      ctx.restore()
    }
    y += block.height + gap
  }
  ctx.textAlign = "left"
}


// --- Finishing (free, canvas only): warm grade, vignette, film grain, light leak. All cheap fills, no pixel reads. ---
let grainTile: HTMLCanvasElement | null = null
const patterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern | null>()
/** A 256 px noise tile made once from the seeded generator, so every render has the same grain. */
function grainPattern(ctx: CanvasRenderingContext2D) {
  if (patterns.has(ctx)) return patterns.get(ctx) ?? null
  if (!grainTile) {
    grainTile = document.createElement("canvas")
    grainTile.width = grainTile.height = 256
    const g = grainTile.getContext("2d")
    if (g) {
      const image = g.createImageData(256, 256)
      for (let i = 0; i < 256 * 256; i += 1) {
        const v = Math.round(seeded(i + 1) * 255)
        image.data.set([v, v, v, 255], i * 4)
      }
      g.putImageData(image, 0, 0)
    }
  }
  const pattern = ctx.createPattern(grainTile, "repeat")
  patterns.set(ctx, pattern)
  return pattern
}

/** Warm advertising tone: a soft-light amber wash over the picture (the text is drawn after, so it stays white). */
function drawGrade(ctx: CanvasRenderingContext2D) {
  const { width, height } = ctx.canvas
  ctx.save()
  ctx.globalCompositeOperation = "soft-light"
  ctx.fillStyle = "rgba(255,176,98,.22)"
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

/** Darkened corners pulling the eye to the middle. */
function drawVignette(ctx: CanvasRenderingContext2D) {
  const { width, height } = ctx.canvas
  const v = ctx.createRadialGradient(width / 2, height * 0.46, height * 0.3, width / 2, height * 0.46, height * 0.75)
  v.addColorStop(0, "rgba(20,10,4,0)")
  v.addColorStop(1, "rgba(20,10,4,.38)")
  ctx.fillStyle = v
  ctx.fillRect(0, 0, width, height)
}

/** Very faint film grain: the noise tile, moved to a new seeded offset every frame so it shimmers. */
function drawGrain(ctx: CanvasRenderingContext2D, seconds: number) {
  const pattern = grainPattern(ctx)
  if (!pattern) return
  const { width, height } = ctx.canvas
  const frame = Math.round(seconds * 30)
  ctx.save()
  ctx.globalCompositeOperation = "overlay"
  ctx.globalAlpha = 0.07
  ctx.translate(Math.floor(seeded(frame + 3) * 256), Math.floor(seeded(frame + 91) * 256))
  ctx.fillStyle = pattern
  ctx.fillRect(-256, -256, width + 256, height + 256)
  ctx.restore()
}

/** A warm flare breathing in from the edge at each cut (the whip at 3.5 s, the end card at 6.5 s). */
function drawLightLeak(ctx: CanvasRenderingContext2D, seconds: number) {
  const bell = (centre: number, half: number) => Math.max(0, 1 - Math.abs(seconds - centre) / half)
  const k = Math.max(bell(SCENE_2, 0.45), bell(END_CARD + 0.15, 0.5))
  if (k <= 0) return
  const { width, height } = ctx.canvas
  const strength = k * k * (3 - 2 * k)
  const flip = seconds > END_CARD ? -1 : 1
  const cx = flip > 0 ? width * 1.02 : -width * 0.02
  const leak = ctx.createRadialGradient(cx, height * 0.34, 0, cx, height * 0.34, width * 1.25)
  leak.addColorStop(0, `rgba(255,150,70,${0.62 * strength})`)
  leak.addColorStop(0.45, `rgba(255,96,80,${0.26 * strength})`)
  leak.addColorStop(1, "rgba(255,96,80,0)")
  ctx.save()
  ctx.globalCompositeOperation = "screen"
  ctx.fillStyle = leak
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

/** Draws the frame at `seconds` (0 … MOTION_SECONDS) on a 1080 × 1920 canvas. */
export function drawMotionFrame(ctx: CanvasRenderingContext2D, seconds: number, scene: MotionScene) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  ctx.imageSmoothingQuality = "high"
  drawPhoto(ctx, scene, seconds)
  drawGrade(ctx)
  const effect = scene.effect ?? "sheen"
  if (effect === "steam") drawSteam(ctx, seconds)
  else if (effect === "sparkle") drawSparkles(ctx, seconds)
  else if (effect === "petals") drawPetals(ctx, seconds)
  else if (effect === "glow") drawGlow(ctx, seconds)
  // The light sweep runs for every kind except flowers (petals already move across the picture).
  if (effect !== "petals") drawSheen(ctx, seconds)
  drawEndCardBackdrop(ctx, scene, seconds)
  // Finishing sits under all the text, so the letters stay clean.
  drawVignette(ctx)
  drawGrain(ctx, seconds)
  drawLightLeak(ctx, seconds)
  if (seconds < END_CARD + 0.35) {
    // Scenes 1–2: shop name and headline only; price and call to action wait for the end card.
    const fade = 1 - progress(seconds, END_CARD, 0.35)
    ctx.save()
    ctx.globalAlpha = fade
    drawVideoCaption(ctx, seconds, { eyebrow: scene.caption.eyebrow, headline: scene.caption.headline, subline: scene.caption.subline }, scene.accent, { words: true })
    ctx.restore()
    drawPoints(ctx, scene, seconds)
  }
  drawEndCardText(ctx, scene, seconds)
  if (scene.aiMark) drawAiMark(ctx)
}

/** The poster's "AI 활용" pill, top right just under the stories' top band (250 px), on every frame. */
function drawAiMark(ctx: CanvasRenderingContext2D) {
  const label = "AI 활용"
  ctx.save()
  ctx.font = `700 32px "Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif`
  const w = ctx.measureText(label).width + 34
  const h = 52
  const x = ctx.canvas.width - w - 32
  const y = 262
  ctx.fillStyle = "rgba(29,26,23,.62)"
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(label, x + 15, y + h / 2 + 1)
  ctx.restore()
}
