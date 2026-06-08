import { supabase } from '../supabaseClient'

const cache = {}

async function getSetting(key) {
  if (cache[key] !== undefined) return cache[key]
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  cache[key] = data?.value ?? null
  return cache[key]
}

export async function getHrEmail() {
  return getSetting('hr_notification_email')
}

export async function getTechSupportEmail() {
  return getSetting('tech_support_email')
}

export function clearSettingsCache() {
  Object.keys(cache).forEach(k => delete cache[k])
}
