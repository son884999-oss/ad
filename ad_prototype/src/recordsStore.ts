// 내 홍보물 kept on this device (IndexedDB), so results survive a reload or a closed tab.
// No server and no account: everything stays in this browser. If IndexedDB is unavailable
// (private mode, blocked storage), every function resolves quietly and the app keeps records in memory.

const DB_NAME = "hongboitda"
const STORE = "records"
const VERSION = 1

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, VERSION)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** Saved records, newest first. Resolves to null when storage is unavailable. */
export async function loadRecords<T extends { id: string }>(): Promise<T[] | null> {
  const db = await open()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll()
      request.onsuccess = () => {
        const items = (request.result as (T & { savedAt?: number })[]).sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
        resolve(items.map(({ savedAt: _savedAt, ...item }) => item as unknown as T))
      }
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** Replaces the stored set with `records` (newest first). Resolves to false when it could not be saved. */
export async function saveRecords<T extends { id: string }>(records: T[]): Promise<boolean> {
  const db = await open()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE, "readwrite")
      const store = transaction.objectStore(STORE)
      store.clear()
      const now = Date.now()
      // savedAt keeps the on-screen order (newest first) when the list is read back.
      records.forEach((record, index) => store.put({ ...record, savedAt: now - index }))
      transaction.oncomplete = () => resolve(true)
      transaction.onerror = () => resolve(false)
      transaction.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}
