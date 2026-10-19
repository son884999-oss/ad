// Keeps every result on this computer while the app runs from the local dev server (vite.config.ts
// /api/save-output → ad_prototype/outputs/<date>/<folder>/). On the deployed site the route does not exist: the
// first 404 turns saving off quietly, so nothing changes for real users.
let available = true

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    // After ";base64,": a video type such as "video/mp4;codecs=avc1,mp4a" has its own comma.
    reader.onload = () => {
      const url = String(reader.result)
      const at = url.indexOf(";base64,")
      resolve(at === -1 ? "" : url.slice(at + 8))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/** "2026-10-18_143205_수제크림커피": the folder for one creation. */
export function outputFolder(name: string, now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0")
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `${day}_${time}_${name.replace(/\s+/g, "").slice(0, 30) || "홍보물"}`
}

/** Saves files (a Blob, or text) into the creation's folder. Best effort: never throws, never blocks the UI. */
export async function saveToComputer(folder: string, files: { name: string; blob?: Blob | null; text?: string }[]) {
  // Only the local dev server (vite.config.ts) has this endpoint; a deployed build never calls it.
  if (!import.meta.env.DEV || !available || !folder) return
  try {
    const payload = []
    for (const file of files) {
      if (file.text !== undefined) payload.push({ name: file.name, data: file.text, text: true })
      else if (file.blob) payload.push({ name: file.name, data: await toBase64(file.blob) })
    }
    if (!payload.length) return
    const response = await fetch("/api/save-output", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder, files: payload }),
    })
    if (response.status === 404 || response.status === 405) available = false
  } catch {
    // Saving a copy on the computer is optional.
  }
}
