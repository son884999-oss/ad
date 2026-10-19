// Instant, free photo check in the browser (no AI): blur, too dark / too bright, too small.
// The photo is drawn at ≤512 px on its long side, turned to grayscale, and measured:
// - sharpness: variance of the 4-neighbour Laplacian, taken per tile on a 4×4 grid; the score is the
//   2nd-highest tile so a sharp subject on a soft background (shallow focus, plain wall) still passes
//   while one noisy tile cannot make a blurry photo pass.
// - brightness: mean luminance 0–255 (Rec. 601 weights).
// - size: the original photo's shorter side.
//
// Calibration (Edge, scratch calibrate.mjs; synthetic variants drawn with canvas filters, JPEG 0.9):
//                         sharpness            brightness
//   6 example photos      961 – 4392           89 – 161   (coffee 961/123, cake 4057/101, store 2390/125)
//   blur(2px)              55 – 235            unchanged  (mild; 2 of 6 flagged)
//   blur(3px)              20 – 69             unchanged  (all flagged)
//   blur(6px)               4 – 8              unchanged
//   brightness(0.25)                           22 – 39    (all flagged)
//   brightness(0.4)                            35 – 64    (half flagged: moody photos must still pass)
//   brightness(4) / (6)                       201 – 238 / 216 – 246
//   scale 0.25 (150–300 px)                    "small"
// Thresholds: blurry < 100 (≈10× under the softest example), dark < 45 (half the darkest example,
// a dim café photo at 89), bright > 230 (white-background product shots stay ~200), small < 400 px.

export type PhotoIssue = "blurry" | "dark" | "bright" | "small" | "notPhoto"

export type PhotoMeasure = { width: number; height: number; sharpness: number; brightness: number }

export const PHOTO_THRESHOLDS = { minSharpness: 100, minBrightness: 45, maxBrightness: 230, minSide: 400 } as const

const SAMPLE_SIZE = 512
const GRID = 4

/** Pure measurement on RGBA pixels (exported for tests). */
export function measurePixels(data: Uint8ClampedArray, width: number, height: number) {
  const gray = new Float32Array(width * height)
  let sum = 0
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    const value = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
    gray[i] = value
    sum += value
  }
  const tileW = Math.max(1, Math.floor((width - 2) / GRID))
  const tileH = Math.max(1, Math.floor((height - 2) / GRID))
  const tiles: number[] = []
  for (let ty = 0; ty < GRID; ty += 1) {
    for (let tx = 0; tx < GRID; tx += 1) {
      let n = 0, s = 0, s2 = 0
      const y0 = 1 + ty * tileH, x0 = 1 + tx * tileW
      for (let y = y0; y < Math.min(height - 1, y0 + tileH); y += 1) {
        for (let x = x0; x < Math.min(width - 1, x0 + tileW); x += 1) {
          const i = y * width + x
          const lap = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i]
          n += 1
          s += lap
          s2 += lap * lap
        }
      }
      if (n) tiles.push(s2 / n - (s / n) ** 2)
    }
  }
  tiles.sort((a, b) => b - a)
  return { sharpness: Math.round(tiles[Math.min(1, tiles.length - 1)] ?? 0), brightness: Math.round(sum / Math.max(1, gray.length)) }
}

/** The first problem found, in the order a shop owner can fix it. */
export function issueFor(measure: PhotoMeasure): PhotoIssue | null {
  const t = PHOTO_THRESHOLDS
  if (Math.min(measure.width, measure.height) < t.minSide) return "small"
  if (measure.brightness < t.minBrightness) return "dark"
  if (measure.brightness > t.maxBrightness) return "bright"
  if (measure.sharpness < t.minSharpness) return "blurry"
  return null
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("image-load-failed"))
    image.src = src
  })
}

/** Measures a photo (data/object URL). Resolves to null if the browser cannot read it. */
export async function measurePhoto(src: string): Promise<PhotoMeasure | null> {
  try {
    const image = await loadImage(src)
    const width = image.naturalWidth, height = image.naturalHeight
    if (!width || !height) return null
    const scale = Math.min(1, SAMPLE_SIZE / Math.max(width, height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(3, Math.round(width * scale))
    canvas.height = Math.max(3, Math.round(height * scale))
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) return null
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    return { width, height, ...measurePixels(data, canvas.width, canvas.height) }
  } catch {
    return null
  }
}

export async function checkPhotoQuality(src: string) {
  const measure = await measurePhoto(src)
  return measure ? { ...measure, issue: issueFor(measure) } : null
}
