// Turns the product photo into a 9:16 frame before it is sent for the AI video. Kling keeps the shape of the
// photo it gets, so a square photo used to come back as a square clip (black bars in Reels / Shorts).
// - If a 9:16 window fits the product (the box from the photo analysis, or the middle when there is none),
//   the photo is cropped around it: full screen, nothing invented.
// - Otherwise (a wide product), the whole photo is fitted to the width and the space above and below is filled
//   with the same photo blurred. The photo is enlarged as far as the product still fits the width (only the
//   background at the sides is cut), so the blurred bands stay small.

export type StoryFrame =
  | { mode: "crop"; sx: number; sy: number; sw: number; sh: number }
  /** the product's left and right edge in photo pixels (with margin): it must stay inside the frame */
  | { mode: "fill"; productLeft: number; productRight: number }

/** Product box [ymin, xmin, ymax, xmax] on a 0–1000 grid, as returned by the photo analysis. */
type Box = [number, number, number, number]

const RATIO = 9 / 16

/** Where to cut a 9:16 frame out of a width × height photo, or "fill" when that would cut the product. */
export function storyFrame(width: number, height: number, box?: Box | null): StoryFrame {
  // Product edges in pixels, with a 6% margin so it does not touch the frame; no box = the middle 70%.
  const [ymin, xmin, ymax, xmax] = box ?? [150, 150, 850, 850]
  const left = (xmin / 1000) * width
  const right = (xmax / 1000) * width
  const top = (ymin / 1000) * height
  const bottom = (ymax / 1000) * height
  const marginX = (right - left) * 0.06
  const marginY = (bottom - top) * 0.06

  if (width / height > RATIO) {
    // Wider than 9:16 (square or landscape): keep the full height, cut the sides.
    const sw = height * RATIO
    const need = right - left + marginX * 2
    if (need > sw) return { mode: "fill", productLeft: Math.max(0, left - marginX), productRight: Math.min(width, right + marginX) }
    const center = (left + right) / 2
    const sx = Math.min(width - sw, Math.max(0, center - sw / 2))
    return { mode: "crop", sx, sy: 0, sw, sh: height }
  }
  // Taller than 9:16: keep the full width, cut top and bottom.
  const sh = width / RATIO
  const need = bottom - top + marginY * 2
  if (need > sh) return { mode: "fill", productLeft: 0, productRight: width }
  const center = (top + bottom) / 2
  const sy = Math.min(height - sh, Math.max(0, center - sh / 2))
  return { mode: "crop", sx: 0, sy, sw: width, sh }
}

/** The analysis box as the product's centre and size inside the 9:16 frame (0–1), or null when the frame is "fill". */
export function boxFocus(width: number, height: number, box: Box): { x: number; y: number; size: number } | null {
  const frame = storyFrame(width, height, box)
  if (frame.mode !== "crop") return null
  const [ymin, xmin, ymax, xmax] = box
  const left = ((xmin / 1000) * width - frame.sx) / frame.sw
  const right = ((xmax / 1000) * width - frame.sx) / frame.sw
  const top = ((ymin / 1000) * height - frame.sy) / frame.sh
  const bottom = ((ymax / 1000) * height - frame.sy) / frame.sh
  return { x: (left + right) / 2, y: (top + bottom) / 2, size: Math.max(right - left, (bottom - top) * 1.2) }
}

const loadImage =(src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })

/**
 * Draws the photo as a 9:16 frame filling the canvas (crop around the product, or the whole photo with a blurred
 * fill). The AI photo and the sample video use the same frame, so both videos show the product the same way.
 */
export function drawStoryFrame(ctx: CanvasRenderingContext2D, image: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }, box?: Box | null) {
  const { width: frameWidth, height: frameHeight } = ctx.canvas
  const width = image.naturalWidth || Number(image.width) || 0
  const height = image.naturalHeight || Number(image.height) || 0
  if (!width || !height) return false
  ctx.fillStyle = "#ffffff" // transparent PNGs would turn black in JPEG
  ctx.fillRect(0, 0, frameWidth, frameHeight)
  const frame = storyFrame(width, height, box)
  if (frame.mode === "crop") {
    ctx.drawImage(image, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, frameWidth, frameHeight)
    return true
  }
  // Blurred, slightly darkened copy as the background, then the whole photo across the full width.
  const cover = Math.max(frameWidth / width, frameHeight / height)
  const bleed = frameWidth * 0.055
  ctx.save()
  ctx.filter = `blur(${Math.round(frameWidth * 0.05)}px) brightness(.85)`
  ctx.drawImage(image, (frameWidth - width * cover) / 2 - bleed, (frameHeight - height * cover) / 2 - bleed, width * cover + bleed * 2, height * cover + bleed * 2)
  ctx.restore()
  // As large as the product allows (it must fit the width) but never taller than the frame or narrower than it.
  const productWidth = frame.productRight - frame.productLeft
  const scale = Math.max(frameWidth / width, Math.min(frameWidth / productWidth, frameHeight / height))
  const drawWidth = width * scale
  const drawHeight = height * scale
  const productCenter = ((frame.productLeft + frame.productRight) / 2) * scale
  const x = Math.min(0, Math.max(frameWidth - drawWidth, frameWidth / 2 - productCenter))
  ctx.drawImage(image, x, (frameHeight - drawHeight) / 2, drawWidth, drawHeight)
  return true
}

/** The photo as a 9:16 JPEG (720 × 1280, the clip size) for the video request, or null if it cannot be read. */
export async function storyFramePhoto(source: string, box?: Box | null): Promise<{ mimeType: "image/jpeg"; data: string } | null> {
  try {
    const image = await loadImage(source)
    const canvas = document.createElement("canvas")
    canvas.width = 720
    canvas.height = 1280
    const ctx = canvas.getContext("2d")
    if (!ctx || !drawStoryFrame(ctx, image, box)) return null
    const data = canvas.toDataURL("image/jpeg", 0.88).split(",")[1] ?? ""
    return data ? { mimeType: "image/jpeg", data } : null
  } catch {
    return null
  }
}
