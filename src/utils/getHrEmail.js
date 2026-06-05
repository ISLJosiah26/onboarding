import { supabase } from '../supabaseClient'

export async function getHrEmail() {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'hr_notification_email')
    .maybeSingle()
  return data?.value || 'hr@integratedstaffing.ca'
}
