// 내 홍보물 on the server for signed-in owners (Supabase, 2026-10-19). The device copy (src/recordsStore.ts) stays
// the working copy; this mirrors it: one row per record (public.records) and its files in the private "records"
// bucket under <user id>/<record id>/ (photo, background, poster, video). Row-level security keeps each owner to
// their own rows and folder (docs/supabase/schema.sql). Nothing here runs when sign-in is not set up.
import { supabase } from "./auth"

const BUCKET = "records"
// Signed links last a week; the list is read again at every start, so they are always fresh in use.
const LINK_SECONDS = 7 * 24 * 60 * 60

export type CloudFileKind = "photo" | "scene" | "poster" | "video"
type Uploadable = { id: string; imageUrl: string; sceneUrl?: string }

const extensionFor = (type: string) => (type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("webm") ? "webm" : type.includes("mp4") ? "mp4" : "jpg")
const pathFor = (userId: string, recordId: string, kind: CloudFileKind, type: string) => `${userId}/${recordId}/${kind}.${extensionFor(type)}`

async function blobOf(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error("file-read")
  return response.blob()
}

async function upload(userId: string, recordId: string, kind: CloudFileKind, blob: Blob) {
  if (!supabase) throw new Error("not-configured")
  const path = pathFor(userId, recordId, kind, blob.type || "image/jpeg")
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" })
  if (error) throw error
  return path
}

/** A short fingerprint of a picture (its data URL is too long to keep), to know whether it changed. */
export function pictureKey(url?: string) {
  if (!url) return ""
  let hash = 0
  const text = `${url.length}:${url.slice(-2000)}`
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return `${url.length.toString(36)}-${(hash >>> 0).toString(36)}`
}

/**
 * Saves one record's row (the record minus its pictures, as JSON). The photo and the AI background are uploaded
 * only when `uploadPhoto` / `uploadScene` say so (first save, or a new background): the caller remembers what
 * went up (record.cloud) so a later edit sends the small row only.
 */
export async function saveCloudRecord<T extends Uploadable>(userId: string, record: T, { uploadPhoto, uploadScene }: { uploadPhoto: boolean; uploadScene: boolean }) {
  if (!supabase) return
  const { imageUrl, sceneUrl, ...rest } = record
  const data = { ...rest } as Record<string, unknown>
  delete data.owner
  delete data.cloud
  delete data.cloudFiles
  const row: Record<string, unknown> = { id: record.id, user_id: userId, data, updated_at: new Date().toISOString() }
  if (uploadPhoto && !/^https?:/.test(imageUrl)) row.photo_path = await upload(userId, record.id, "photo", await blobOf(imageUrl))
  if (uploadScene && sceneUrl && !/^https?:/.test(sceneUrl)) row.scene_path = await upload(userId, record.id, "scene", await blobOf(sceneUrl))
  const { error } = await supabase.from("records").upsert(row)
  if (error) throw error
}

/** The poster or video made for a record (uploaded the moment it is ready on the result screen). */
export async function saveCloudFile(userId: string, recordId: string, kind: "poster" | "video", blob: Blob) {
  if (!supabase) return
  const path = await upload(userId, recordId, kind, blob)
  const { error } = await supabase.from("records").update({ [`${kind}_path`]: path, updated_at: new Date().toISOString() }).eq("id", recordId)
  if (error) throw error
}

export async function deleteCloudRecord(userId: string, recordId: string) {
  if (!supabase) return
  const { data } = await supabase.storage.from(BUCKET).list(`${userId}/${recordId}`, { limit: 20 })
  const paths = (data ?? []).map((file) => `${userId}/${recordId}/${file.name}`)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
  await supabase.from("records").delete().eq("id", recordId)
}

export type CloudRecordExtras = { owner: string; cloudFiles?: { poster?: string; video?: string } }

/** The owner's records, newest first, with week-long links to their photo, background, poster and video. */
export async function loadCloudRecords<T>(userId: string): Promise<(T & CloudRecordExtras & { imageUrl: string; sceneUrl?: string })[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from("records").select("id, data, photo_path, scene_path, poster_path, video_path, created_at").order("created_at", { ascending: false }).limit(200)
  if (error || !data) return []
  const paths = data.flatMap((row) => [row.photo_path, row.scene_path, row.poster_path, row.video_path].filter(Boolean) as string[])
  const links = new Map<string, string>()
  for (let i = 0; i < paths.length; i += 100) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths.slice(i, i + 100), LINK_SECONDS)
    for (const item of signed ?? []) if (item.path && item.signedUrl) links.set(item.path, item.signedUrl)
  }
  return data
    .filter((row) => row.photo_path && links.has(row.photo_path))
    .map((row) => ({
      ...(row.data as T),
      id: row.id,
      owner: userId,
      imageUrl: links.get(row.photo_path) as string,
      sceneUrl: row.scene_path ? links.get(row.scene_path) : undefined,
      cloudFiles: { poster: row.poster_path ? links.get(row.poster_path) : undefined, video: row.video_path ? links.get(row.video_path) : undefined },
    }))
}

/** A photo from a server link as a data URL, so a reopened record works exactly like one made on this device. */
export async function toDataUrl(url: string) {
  if (!/^https?:/.test(url)) return url
  const blob = await blobOf(url)
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("file-read"))
    reader.readAsDataURL(blob)
  })
}
