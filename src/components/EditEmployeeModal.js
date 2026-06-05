import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { logAudit } from '../utils/auditLog'

export default function EditEmployeeModal({ employee, instanceId, onClose, onSave }) {
  const [fullName, setFullName] = useState(employee.full_name)
  const [email, setEmail] = useState(employee.email || '')
  const [hireDate, setHireDate] = useState(employee.hire_date)
  const [roleId, setRoleId] = useState(employee.role_id)
  const [managerId, setManagerId] = useState(employee.manager_id || '')
  const [roles, setRoles] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(true)
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
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function fetchRoles() {
    const { data } = await supabase.from('roles').select('*').order('name')
    if (data) setRoles(data)
  }

  async function fetchEmployees() {
    const { data } = await supabase.from('employees').select('id, full_name').order('full_name')
    if (data) setEmployees(data)
  }

  useEffect(() => {
    Promise.all([fetchRoles(), fetchEmployees()]).finally(() => setOptionsLoading(false))
  }, [])

  const roleChanged = roleId !== employee.role_id

async function handleSave() {
  if (!fullName.trim() || !hireDate) { setError('Name and start date are required.'); return }
  if (!roleId) { setError('Please select a role.'); return }
  setLoading(true)
  setError('')

const { error: updateError } = await supabase
  .from('employees')
  .update({
    full_name: fullName.trim(),
    email,
    hire_date: hireDate,
    role_id: roleId,
    manager_id: managerId || null
  })
  .eq('id', employee.id)

    if (updateError) { setError('Failed to save employee details. Please try again.'); setLoading(false); return }

    if (roleChanged && instanceId) {
      const { data: newTasks, error: fetchTasksError } = await supabase
        .from('onboarding_templates')
        .select('id')
        .eq('role_id', roleId)

      if (fetchTasksError) { setError('Failed to load tasks for the new role.'); setLoading(false); return }

      // Snapshot existing IDs before touching them
      const { data: existingCompletions } = await supabase
        .from('task_completions').select('id').eq('instance_id', instanceId)

      // Insert new tasks first — if this fails, old tasks are still intact
      if (newTasks && newTasks.length > 0) {
        const { error: insertError } = await supabase.from('task_completions').insert(
          newTasks.map(t => ({ instance_id: instanceId, template_task_id: t.id, completed: false }))
        )
        if (insertError) { setError('Failed to create new task list.'); setLoading(false); return }
      }

      // Delete old tasks by known IDs — non-fatal if this fails (employee has duplicate tasks rather than none)
      if (existingCompletions && existingCompletions.length > 0) {
        await supabase.from('task_completions').delete().in('id', existingCompletions.map(c => c.id))
      }
    }

    if (roleChanged) {
      await logAudit('role_changed', 'employee', employee.id, {
        employee_name: fullName.trim(),
        old_role_id: employee.role_id,
        new_role_id: roleId
      })
    }
    await logAudit('employee_edited', 'employee', employee.id, { employee_name: fullName.trim() })

    const newRole = roles.find(r => r.id === roleId)
    const newManager = employees.find(e => e.id === managerId) || null
    setLoading(false)
    onSave({
      ...employee,
      full_name: fullName.trim(),
      email,
      hire_date: hireDate,
      role_id: roleId,
      manager_id: managerId || null,
      roles: newRole ? { name: newRole.name } : employee.roles,
      manager: newManager ? { id: newManager.id, full_name: newManager.full_name } : null
    })
  }

  return (
    <div className="il-backdrop" style={styles.overlay}>
      <div className="il-modal" style={{ ...styles.modal, boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
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
        {optionsLoading ? (
          <div style={{ ...styles.input, background: '#f7f6f3', color: '#a0a09c', marginBottom: '16px' }}>Loading roles…</div>
        ) : (
          <select style={{ ...styles.input, marginBottom: '16px' }} value={roleId} onChange={e => setRoleId(e.target.value)}>
            <option value="">Select a role...</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.brand})</option>)}
          </select>
        )}
        <label style={styles.label}>Manager</label>
        {optionsLoading ? (
          <div style={{ ...styles.input, background: '#f7f6f3', color: '#a0a09c', marginBottom: '20px' }}>Loading employees…</div>
        ) : (
          <select style={{ ...styles.input, marginBottom: '20px' }} value={managerId} onChange={e => setManagerId(e.target.value)}>
            <option value="">No manager</option>
            {employees.filter(e => e.id !== employee.id).map(e => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        )}
        <div style={styles.footer}>
          <button style={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button style={styles.btnPrimary} onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  )
}
