import { supabase } from '../supabaseClient'
import { getHrEmail } from './getHrEmail'

// Send the same HTML notification to HR and (optionally) the employee's
// manager. Fire-and-forget: failures are logged, never thrown, so they don't
// block the user-facing action. Recipients are validated server-side by the
// send-email function.
export async function notifyHrAndManager({ subject, html, managerId }) {
  const hrEmail = await getHrEmail()
  if (hrEmail) {
    const { error } = await supabase.functions.invoke('send-email', { body: { to: hrEmail, subject, html } })
    if (error) console.error('Failed to notify HR:', error)
  }

  if (managerId) {
    const { data: mgr } = await supabase.from('employees').select('email').eq('id', managerId).maybeSingle()
    if (mgr?.email) {
      const { error } = await supabase.functions.invoke('send-email', { body: { to: mgr.email, subject, html } })
      if (error) console.error('Failed to notify manager:', error)
    }
  }
}
