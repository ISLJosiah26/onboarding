import { supabase } from '../supabaseClient'

export async function logAudit(action, entityType = null, entityId = null, metadata = null) {
  try {
    await supabase.rpc('insert_audit_log', {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId ? String(entityId) : null,
      p_metadata: metadata
    })
  } catch (err) {
    console.error('Audit log failed:', err)
  }
}
