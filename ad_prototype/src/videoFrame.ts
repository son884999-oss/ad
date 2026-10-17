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

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })

/** The photo as a 9:16 JPEG (720 × 1280, the clip size) for the video request, or null if it cannot be read. */
export async function storyFramePhoto(source: string, box?: Box | null): Promise<{ mimeType: "image/jpeg"; data: string } | null> {
  try {
    const image = await loadImage(source)
    const width = image.naturalWidth
    const height = image.naturalHeight
    if (!width || !height) return null
    const canvas = document.createElement("canvas")
    canvas.width = 720
    canvas.height = 1280
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.fillStyle = "#ffffff" // transparent PNGs would turn black in JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const frame = storyFrame(width, height, box)
    if (frame.mode === "crop") {
      ctx.drawImage(image, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, canvas.width, canvas.height)
    } else {
      // Blurred, slightly darkened copy as the background, then the whole photo across the full width.
      const cover = Math.max(canvas.width / width, canvas.height / height)
      ctx.save()
      ctx.filter = "blur(36px) brightness(.85)"
      ctx.drawImage(image, (canvas.width - width * cover) / 2 - 40, (canvas.height - height * cover) / 2 - 40, width * cover + 80, height * cover + 80)
      ctx.restore()
      // As large as the product allows (it must fit the width) but never taller than the frame or narrower than it.
      const productWidth = frame.productRight - frame.productLeft
      const scale = Math.max(canvas.width / width, Math.min(canvas.width / productWidth, canvas.height / height))
      const drawWidth = width * scale
      const drawHeight = height * scale
      const productCenter = ((frame.productLeft + frame.productRight) / 2) * scale
      const x = Math.min(0, Math.max(canvas.width - drawWidth, canvas.width / 2 - productCenter))
      ctx.drawImage(image, x, (canvas.height - drawHeight) / 2, drawWidth, drawHeight)
    }
    const data = canvas.toDataURL("image/jpeg", 0.88).split(",")[1] ?? ""
    return data ? { mimeType: "image/jpeg", data } : null
  } catch {
    return null
  }
}
