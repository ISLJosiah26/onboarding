const TECHNICAL_PATTERN = /^PGRST|^JWT|^AuthApi|tuple|constraint|violates|duplicate key/i

export function handleSupabaseError(error, fallbackMessage) {
  if (!error) return null
  console.error('Supabase error:', error)
  const msg = error.message || ''
  if (TECHNICAL_PATTERN.test(msg)) return fallbackMessage || 'Something went wrong. Please try again.'
  return msg || fallbackMessage || 'Something went wrong. Please try again.'
}
