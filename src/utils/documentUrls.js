import { supabase } from '../supabaseClient'

// Employee-uploaded documents live in a private bucket. We store the storage
// path (completed_file_path) and mint a short-lived signed URL on demand,
// rather than persisting a year-long URL that silently expires. Rows created
// before this change only have the legacy completed_file_url, so fall back to
// it when no path is present.
const BUCKET = 'employee-documents'
const SIGNED_URL_TTL = 60 * 60 // 1 hour

export async function resolveCompletedUrl(dc) {
  if (!dc) return null
  if (dc.completed_file_path) {
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(dc.completed_file_path, SIGNED_URL_TTL)
    return data?.signedUrl || null
  }
  return dc.completed_file_url || null
}

// Given a map of documentId -> completion row, return a new map with a
// `resolvedUrl` field added to each entry.
export async function attachResolvedUrls(map) {
  const entries = await Promise.all(
    Object.entries(map).map(async ([key, dc]) => [key, { ...dc, resolvedUrl: await resolveCompletedUrl(dc) }])
  )
  return Object.fromEntries(entries)
}

export function hasCompletedFile(dc) {
  return !!(dc && (dc.completed_file_path || dc.completed_file_url))
}
