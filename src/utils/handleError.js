export function handleSupabaseError(error, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!error) return null
  console.error('Supabase error:', error)
  return error.message || fallbackMessage
}