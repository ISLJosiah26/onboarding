import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function EditEmployeeModal({ employee, instanceId, onClose, onSave }) {
  const [fullName, setFullName] = useState(employee.full_name)
  const [email, setEmail] = useState(employee.email || '')
  const [hireDate, setHireDate] = useState(employee.hire_date)
  const [roleId, setRoleId] = useState(employee.role_id || '')
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const styles = {
    overlay: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, -apple-system, sans-serif' },
    modal: { background: '#fff', borderRadius: '12px', border: '1px solid #ebebe8', padding: '28px', width: '100%', maxWidth: '420px', margin: '0 24px' },
    title: { fontSize: '16px', fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.3px', marginBottom: '20px' },
    label: { fontSize: '12px', color: '#8a8a86', marginBottom: '6px', display: 'block' },
    input: { width: '100%', background: '#fff', border: '1px solid #ebebe8', borderRadius: '7px', padding: '10px 14px', fontSize: '13px', color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', marginBottom: '16px', display: 'block', boxSizing: 'border-box' },
    footer: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' },
    btnPrimary: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    btnSecondary: { background: 'transparent', color: '#5f5f5c', border: '1px solid #ebebe8', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    error: { fontSize: '12px', color: '#c74848', marginBottom: '12px' },
    warning: { fontSize: '12px', color: '#d4901a', marginBottom: '12px', padding: '10px 12px', background: '#fffbf0', border: '1px solid #f5e4b0', borderRadius: '6px' }
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  async function fetchRoles() {
    const { data } = await supabase.from('roles').select('*').order('name')
    if (data) setRoles(data)
  }

  const roleChanged = roleId !== employee.role_id

  async function handleSave() {
    if (!fullName.trim() || !hireDate) { setError('Name and start date are required.'); return }
    setLoading(true)
    setError('')

    const { error: updateError } = await supabase
      .from('employees')
      .update({ full_name: fullName.trim(), email, hire_date: hireDate, role_id: roleId })
      .eq('id', employee.id)

    if (updateError) { setError(updateError.message); setLoading(false); return }

    if (roleChanged && instanceId) {
      await supabase.from('task_completions').delete().eq('instance_id', instanceId)

      const { data: newTasks } = await supabase
        .from('onboarding_templates')
        .select('id')
        .eq('role_id', roleId)

      if (newTasks && newTasks.length > 0) {
        await supabase.from('task_completions').insert(
          newTasks.map(t => ({ instance_id: instanceId, template_task_id: t.id, completed: false }))
        )
      }
    }

    const newRole = roles.find(r => r.id === roleId)
    setLoading(false)
    onSave({
      ...employee,
      full_name: fullName.trim(),
      email,
      hire_date: hireDate,
      role_id: roleId,
      roles: newRole ? { name: newRole.name } : employee.roles
    })
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.title}>Edit employee</div>
        {error && <div style={styles.error}>{error}</div>}
        {roleChanged && (
          <div style={styles.warning}>
            Changing the role will reset all task progress and replace the checklist with the new role's tasks.
          </div>
        )}
        <label style={styles.label}>Full name</label>
        <input style={styles.input} type="text" value={fullName} onChange={e => setFullName(e.target.value)} />
        <label style={styles.label}>Email address</label>
        <input style={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <label style={styles.label}>Start date</label>
        <input style={styles.input} type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} />
        <label style={styles.label}>Role</label>
        <select style={{ ...styles.input, marginBottom: '20px' }} value={roleId} onChange={e => setRoleId(e.target.value)}>
          <option value="">Select a role...</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.brand})</option>)}
        </select>
        <div style={styles.footer}>
          <button style={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button style={styles.btnPrimary} onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  )
}