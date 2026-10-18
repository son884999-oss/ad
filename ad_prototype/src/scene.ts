// 고급형 "배경 바꾸기" in the browser: sends the 9:16 frame of the photo to /api/scene-start (one paid picture)
// and polls /api/scene-status until the new advertising scene is back (about a minute). The same photo and
// product name always send the same idempotency key, so asking twice never pays twice.
import { storyFramePhoto } from "./videoFrame"

export type SceneResult = { url: string } | { error: string }

const POLL_MS = 4_000
const DEADLINE_MS = 4 * 60_000
const keys = new Map<string, string>()

/** A short fingerprint of the photo + name (the data URL itself is too long to keep as a key). */
export function sceneKey(imageUrl: string, name: string) {
  let hash = 0
  const text = `${imageUrl.length}:${imageUrl.slice(-2000)}:${name.trim()}`
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return `scene-${(hash >>> 0).toString(16).padStart(8, "0")}-${imageUrl.length.toString(16)}`
}

export async function makeScene(
  imageUrl: string,
  details: { productName: string; productDescription?: string; highlights?: string },
  box?: [number, number, number, number] | null,
  signal?: AbortSignal,
): Promise<SceneResult> {
  const key = sceneKey(imageUrl, details.productName)
  const idempotencyKey = keys.get(key) ?? `${key}-${Math.random().toString(36).slice(2, 10)}`.slice(0, 64)
  keys.set(key, idempotencyKey)
  const image = await storyFramePhoto(imageUrl, box)
  if (!image) return { error: "IMAGE_FAILED" }
  try {
    const response = await fetch("/api/scene-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, details, idempotencyKey }),
      signal,
    })
    const data = (await response.json().catch(() => null)) as { requestId?: string; error?: string } | null
    if (!response.ok || !data?.requestId) return { error: data?.error ?? `HTTP_${response.status}` }
    const startedAt = Date.now()
    while (Date.now() - startedAt < DEADLINE_MS) {
      await new Promise((done) => setTimeout(done, POLL_MS))
      if (signal?.aborted) return { error: "ABORTED" }
      const poll = await fetch(`/api/scene-status?id=${encodeURIComponent(data.requestId)}`, { signal }).catch(() => null)
      const status = (await poll?.json().catch(() => null)) as { status?: string; error?: string; image?: { mimeType: string; data: string } } | null
      if (status?.status === "completed" && status.image) return { url: `data:${status.image.mimeType};base64,${status.image.data}` }
      if (status?.status === "failed") {
        // A failed picture is final for its key; the next try gets a new key (a download failure keeps it: the
        // picture exists and asking again returns it without paying).
        if (status.error !== "SCENE_DOWNLOAD_FAILED") keys.delete(key)
        return { error: status.error ?? "SCENE_FAILED" }
      }
    }
    return { error: "SCENE_TIMEOUT" }
  } catch {
    return { error: signal?.aborted ? "ABORTED" : "NETWORK" }
  }
}
