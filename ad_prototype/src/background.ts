// 배경 바꾸기 in the browser (plan C): after the owner chooses 바꾸기 in the photo popup, the photo (downscaled
// like the analysis call) goes to /api/background once; the advertising picture comes back in about 15–30 s,
// usually while the owner is still typing. The same photo always sends the same idempotency key, so a retry or a
// second tap is answered from the server's memory without paying again.
import { downscalePhoto } from "./ai"

export type BackgroundResult = { url: string } | { error: string }

const keys = new Map<string, string>()

/** A short fingerprint of the photo (the data URL itself is too long to keep as a key). */
function photoKey(imageUrl: string) {
  let hash = 0
  const text = `${imageUrl.length}:${imageUrl.slice(-4000)}`
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return `bg-${(hash >>> 0).toString(16).padStart(8, "0")}-${imageUrl.length.toString(16)}`
}

export async function makeAdBackground(
  imageUrl: string,
  details: { productName?: string; productDescription?: string; highlights?: string },
  signal?: AbortSignal,
): Promise<BackgroundResult> {
  const key = photoKey(imageUrl)
  const idempotencyKey = keys.get(key) ?? `${key}-${Math.random().toString(36).slice(2, 10)}`.slice(0, 64)
  keys.set(key, idempotencyKey)
  const image = await downscalePhoto(imageUrl)
  if (!image) return { error: "IMAGE_FAILED" }
  try {
    const response = await fetch("/api/background", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, details, idempotencyKey }),
      // The server gives up at 50 s; a little more here so its answer always arrives.
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(58_000)]) : AbortSignal.timeout(58_000),
    })
    const data = (await response.json().catch(() => null)) as { image?: { mimeType: string; data: string }; error?: string } | null
    if (!response.ok || !data?.image) {
      // A failed picture is final for its key: the next try gets a new key.
      keys.delete(key)
      return { error: data?.error ?? `HTTP_${response.status}` }
    }
    return { url: `data:${data.image.mimeType};base64,${data.image.data}` }
  } catch {
    keys.delete(key)
    return { error: signal?.aborted ? "ABORTED" : "NETWORK" }
  }
}
