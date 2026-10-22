// Finished 기본형 videos kept on this phone (IndexedDB), so reopening a result from 내 홍보물 plays at once instead of
// making the video again (QA 2026-10-22). Nothing goes to the server. The key is a hash of everything the video is
// drawn from, so any change to the photo or the text makes a new video. At most KEEP files are kept (newest used).
// Every function fails quietly: without storage the app simply makes the video as before.

const DB_NAME = "hongboitda-videos"
const STORE = "videos"
const KEEP = 12
// Bump when motionVideo.ts draws differently, so old files are not shown for new looks.
const DRAW_VERSION = "motion-2026-10-22"

type Entry = { key: string; file: File; usedAt: number }

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "key" })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** FNV-1a over the whole string (photos are data URLs of a few MB: a few ms). */
function hash(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/** The cache key for a video made from these inputs (photo URLs and any JSON-able settings). */
export function videoKey(parts: unknown[]) {
  return hash(JSON.stringify([DRAW_VERSION, ...parts]))
}

export async function loadCachedVideo(key: string): Promise<File | null> {
  const db = await open()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const store = db.transaction(STORE, "readwrite").objectStore(STORE)
      const request = store.get(key)
      request.onsuccess = () => {
        const entry = request.result as Entry | undefined
        if (!entry?.file?.size) return resolve(null)
        store.put({ ...entry, usedAt: Date.now() })
        resolve(entry.file)
      }
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function saveCachedVideo(key: string, file: File): Promise<void> {
  const db = await open()
  if (!db) return
  try {
    const transaction = db.transaction(STORE, "readwrite")
    const store = transaction.objectStore(STORE)
    store.put({ key, file, usedAt: Date.now() } satisfies Entry)
    const all = store.getAll()
    all.onsuccess = () => {
      const old = (all.result as Entry[]).sort((a, b) => b.usedAt - a.usedAt).slice(KEEP)
      old.forEach((entry) => store.delete(entry.key))
    }
  } catch {
    // storage full or blocked: the video just is not kept
  }
}
