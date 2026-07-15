import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { logAudit } from '../utils/auditLog'
import { T } from '../ui/theme'

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
  const modalRef = useRef(null)

  const styles = {
    overlay: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, -apple-system, sans-serif' },
    modal: { background: T.surface, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, padding: '28px', width: '100%', maxWidth: '420px', margin: '0 24px' },
    title: { fontSize: '16px', fontWeight: 600, color: T.text, letterSpacing: '-0.3px', marginBottom: '20px' },
    label: { fontSize: '12px', color: T.muted, marginBottom: '6px', display: 'block' },
    input: { width: '100%', background: T.surface, border: `1px solid ${T.border}`, borderRadius: '7px', padding: '10px 14px', fontSize: '13px', color: T.text, fontFamily: 'inherit', outline: 'none', marginBottom: '16px', display: 'block', boxSizing: 'border-box' },
    footer: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' },
    btnPrimary: { background: 'linear-gradient(180deg, #222 0%, #111 100%)', color: '#fff', border: 'none', borderRadius: T.radiusMd, padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.1px' },
    btnSecondary: { background: 'transparent', color: T.muted, border: `1px solid ${T.border}`, borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    error: { fontSize: '12px', color: T.danger, marginBottom: '12px' },
    warning: { fontSize: '12px', color: '#d4901a', marginBottom: '12px', padding: '10px 12px', background: '#fffbf0', border: '1px solid #f5e4b0', borderRadius: '6px' }
  }


  useLayoutEffect(() => {
    const focusable = modalRef.current?.querySelectorAll('input, select, button:not([disabled])')
    if (focusable?.length) focusable[0].focus()
  }, [])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !modalRef.current) return
      const focusable = [...modalRef.current.querySelectorAll('input:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
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

  const { error: rpcError } = await supabase.rpc('swap_employee_and_tasks', {
    p_employee_id: employee.id,
    p_full_name: fullName.trim(),
    p_email: email,
    p_hire_date: hireDate,
    p_role_id: roleId,
    p_manager_id: managerId || null,
    p_instance_id: (roleChanged && instanceId) ? instanceId : null,
  })

  if (rpcError) { setError('Failed to save employee details. Please try again.'); setLoading(false); return }

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
      <div ref={modalRef} className="il-modal" style={{ ...styles.modal, boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
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
