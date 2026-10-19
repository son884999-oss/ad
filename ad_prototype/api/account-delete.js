// POST /api/account-delete — 회원 탈퇴: deletes the signed-in owner's saved files, records and account.
// Request: header "Authorization: Bearer <the owner's own access token>", body {}. Response: 200 { deleted: true }.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server only, never sent to the browser). The token decides
// whose account goes: nobody can delete another person's account with it.
import { createClient } from "@supabase/supabase-js"
import { ApiError, createJsonHandler } from "./_lib/http.js"

function adminClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceKey) throw new ApiError(503, "AUTH_NOT_CONFIGURED")
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

function bearer(req) {
  const value = req.headers?.authorization ?? req.headers?.Authorization ?? ""
  const match = /^Bearer\s+(\S+)$/.exec(Array.isArray(value) ? value[0] : value)
  if (!match) throw new ApiError(401, "SIGNED_OUT")
  return match[1]
}

/** Every file under <user id>/ in the records bucket (records are folders of a few files each). */
async function userFiles(admin, userId) {
  const paths = []
  const { data: folders } = await admin.storage.from("records").list(userId, { limit: 1000 })
  for (const folder of folders ?? []) {
    const { data: files } = await admin.storage.from("records").list(`${userId}/${folder.name}`, { limit: 100 })
    for (const file of files ?? []) paths.push(`${userId}/${folder.name}/${file.name}`)
  }
  return paths
}

export async function deleteAccountFor(token, admin) {
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) throw new ApiError(401, "SIGNED_OUT")
  const userId = data.user.id
  const files = await userFiles(admin, userId)
  for (let i = 0; i < files.length; i += 100) {
    const { error: removeError } = await admin.storage.from("records").remove(files.slice(i, i + 100))
    if (removeError) throw new ApiError(502, "DELETE_FAILED")
  }
  // Records go with the account (on delete cascade), and explicitly in case the cascade is missing.
  await admin.from("records").delete().eq("user_id", userId)
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) throw new ApiError(502, "DELETE_FAILED")
  return { deleted: true }
}

export default createJsonHandler({
  bucket: "account-delete",
  perMinute: 3,
  prepare: (req) => ({ admin: adminClient(), token: bearer(req) }),
  run: (_body, { admin, token }) => deleteAccountFor(token, admin),
})
