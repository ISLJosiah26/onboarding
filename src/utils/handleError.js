const TECHNICAL_PATTERN = /^PGRST|^JWT|^AuthApi|tuple|constraint|violates|duplicate key/i

export function handleSupabaseError(error, fallbackMessage) {
  if (!error) return null
  console.error('Supabase error:', error)
  if (fallbackMessage) return fallbackMessage
  const msg = error.message || ''
  return TECHNICAL_PATTERN.test(msg) ? 'Something went wrong. Please try again.' : (msg || 'Something went wrong. Please try again.')
}