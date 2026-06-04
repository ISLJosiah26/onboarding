/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import { handleSupabaseError } from '../utils/handleError'
import { logAudit } from '../utils/auditLog'

const ACTION_LABELS = {
  onboarding_created: 'Onboarding created',
  onboarding_completed: 'Onboarding marked complete',
  onboarding_archived: 'Onboarding archived',
  onboarding_reactivated: 'Onboarding reactivated',
  employee_deleted: 'Employee deleted',
  employee_edited: 'Employee edited',
  role_changed: 'Role changed',
  user_deactivated: 'User deactivated',
  user_reactivated: 'User reactivated',
  document_hidden: 'Document hidden',
  document_restored: 'Document restored',
  system_setting_updated: 'System setting updated',
}

const CHANGEABLE_ROLES = ['admin', 'manager', 'employee']

const s = {
  header: { padding: '28px 40px 0', borderBottom: '1px solid #ebebe8' },
  title: { fontSize: '20px', fontWeight: 600, letterSpacing: '-0.4px', marginBottom: '20px' },
  tabBar: { display: 'flex', gap: '0', marginTop: '0' },
  tab: (active) => ({
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: active ? 500 : 400,
    color: active ? '#1a1a1a' : '#8a8a86',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #1a1a1a' : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: '-1px',
  }),
  content: { padding: '32px 40px', maxWidth: '900px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontSize: '11px', fontWeight: 600, color: '#a8a8a4', textTransform: 'uppercase', letterSpacing: '0.3px', padding: '0 12px 10px 0', textAlign: 'left', borderBottom: '1px solid #ebebe8' },
  td: { fontSize: '13px', color: '#1a1a1a', padding: '12px 12px 12px 0', borderBottom: '1px solid #f0efeb', verticalAlign: 'middle' },
  statusDot: (active) => ({
    display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
    background: active ? '#2d7a4a' : '#c74848', marginRight: 6, flexShrink: 0
  }),
  select: { border: '1px solid #ebebe8', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', fontFamily: 'inherit', background: '#fff', color: '#1a1a1a', outline: 'none', cursor: 'pointer' },
  btnSmall: (danger) => ({
    fontSize: '12px', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontFamily: 'inherit',
    border: '1px solid ' + (danger ? '#f5d6d6' : '#ebebe8'),
    background: 'transparent',
    color: danger ? '#c74848' : '#5f5f5c',
  }),
  filterRow: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' },
  filterSelect: { border: '1px solid #ebebe8', borderRadius: '6px', padding: '7px 10px', fontSize: '12px', fontFamily: 'inherit', background: '#fff', color: '#1a1a1a', outline: 'none' },
  filterInput: { border: '1px solid #ebebe8', borderRadius: '6px', padding: '7px 10px', fontSize: '12px', fontFamily: 'inherit', background: '#fff', color: '#1a1a1a', outline: 'none' },
  logRow: { display: 'flex', gap: '16px', padding: '12px 0', borderBottom: '1px solid #f0efeb', alignItems: 'flex-start' },
  logTime: { fontSize: '12px', color: '#a8a8a4', whiteSpace: 'nowrap', minWidth: '140px' },
  logUser: { fontSize: '12px', color: '#5f5f5c', minWidth: '160px' },
  logAction: { fontSize: '13px', color: '#1a1a1a', fontWeight: 500, flex: 1 },
  logEntity: { fontSize: '12px', color: '#8a8a86', marginTop: '2px' },
  settingRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 0', borderBottom: '1px solid #f0efeb' },
  settingKey: { fontSize: '13px', fontWeight: 500, color: '#1a1a1a', minWidth: '200px' },
  settingInput: { flex: 1, border: '1px solid #ebebe8', borderRadius: '7px', padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit', background: '#fff', color: '#1a1a1a', outline: 'none', maxWidth: '360px' },
  btnSave: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  empty: { padding: '40px 0', textAlign: 'center', color: '#a8a8a4', fontSize: '13px' },
  badge: (role) => {
    const colors = {
      super_admin: { bg: '#f0edff', color: '#5b3fd4' },
      admin: { bg: '#e8f4ff', color: '#0070CA' },
      manager: { bg: '#f0faf4', color: '#2d7a4a' },
      employee: { bg: '#f4f3f1', color: '#5f5f5c' },
      none: { bg: '#f4f3f1', color: '#a8a8a4' },
    }
    const c = colors[role] || colors.none
    return { fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '4px', background: c.bg, color: c.color }
  }
}

const TAB_MAP = {
  'super-admin-users': 'Users',
  'super-admin-audit': 'Audit Log',
  'super-admin-settings': 'System Settings',
}
const PAGE_MAP = {
  'Users': 'super-admin-users',
  'Audit Log': 'super-admin-audit',
  'System Settings': 'super-admin-settings',
}

export default function SuperAdmin({ session, userProfile, currentPage, onNavigate }) {
  const tab = TAB_MAP[currentPage] || 'Users'

  function setTab(t) {
    onNavigate(PAGE_MAP[t])
  }

  return (
    <Layout session={session} userProfile={userProfile} currentPage={currentPage} onNavigate={onNavigate}>
      <div style={s.header}>
        <div style={s.title}>System</div>
        <div style={s.tabBar}>
          {['Users', 'Audit Log', 'System Settings'].map(t => (
            <button key={t} style={s.tab(tab === t)} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div style={s.content}>
        {tab === 'Users' && <UsersTab />}
        {tab === 'Audit Log' && <AuditLogTab />}
        {tab === 'System Settings' && <SystemSettingsTab />}
      </div>
    </Layout>
  )
}

function UsersTab() {
  const [users, setUsers] = useState([])
  const [allEmployees, setAllEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvitePanel, setShowInvitePanel] = useState(false)
  const [inviteMode, setInviteMode] = useState('employees')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('employee')
  const [inviteBrand, setInviteBrand] = useState('')
  const [pendingInvite, setPendingInvite] = useState(null)
  const [pendingRole, setPendingRole] = useState('employee')
  const [inviting, setInviting] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => { fetchUsers(); fetchAllEmployees() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_all_users_admin')
    if (error) showToast(handleSupabaseError(error, 'Failed to load users.'), 'error')
    else setUsers(data || [])
    setLoading(false)
  }

  async function fetchAllEmployees() {
    const { data } = await supabase.from('employees').select('id, full_name, email, brand').order('full_name')
    if (data) setAllEmployees(data)
  }

  const linkedEmployeeIds = new Set(users.filter(u => u.employee_id).map(u => u.employee_id))
  const unlinkedEmployees = allEmployees.filter(e => !linkedEmployeeIds.has(e.id))

  async function sendInviteToEmployee(employee, role) {
    setInviting(true)
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email: employee.email, role, employee_id: employee.id, brand: employee.brand },
    })
    setInviting(false)
    if (error || data?.error) {
      showToast(data?.error || 'Failed to send invite.', 'error')
    } else {
      showToast(`Invite sent to ${employee.email}`)
      setPendingInvite(null)
      fetchUsers()
      fetchAllEmployees()
    }
  }

  async function sendManualInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email: inviteEmail.trim(), role: inviteRole, brand: inviteBrand || null },
    })
    setInviting(false)
    if (error || data?.error) {
      showToast(data?.error || 'Failed to send invite.', 'error')
    } else {
      showToast(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
      setInviteRole('employee')
      setInviteBrand('')
      fetchUsers()
    }
  }

  async function handleRoleChange(userId, newRole, userEmail) {
    const { error } = await supabase
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', userId)
    if (error) {
      showToast(handleSupabaseError(error, 'Failed to update role.'), 'error')
    } else {
      await logAudit('role_changed', 'user', userId, { user_email: userEmail, new_role: newRole })
      showToast('Role updated')
      fetchUsers()
    }
  }

  async function handleToggleDeactivated(userId, currentDeactivated, userEmail) {
    const newDeactivated = !currentDeactivated
    const { error } = await supabase
      .from('user_profiles')
      .update({ deactivated: newDeactivated })
      .eq('id', userId)
    if (error) {
      showToast(handleSupabaseError(error, 'Failed to update user status.'), 'error')
    } else {
      await logAudit(
        newDeactivated ? 'user_deactivated' : 'user_reactivated',
        'user', userId, { user_email: userEmail }
      )
      showToast(newDeactivated ? 'User deactivated' : 'User reactivated')
      fetchUsers()
    }
  }

  const inviteTabStyle = (active) => ({
    padding: '8px 14px', fontSize: '12px', fontWeight: active ? 500 : 400,
    color: active ? '#1a1a1a' : '#8a8a86', background: 'none', border: 'none',
    borderBottom: active ? '2px solid #1a1a1a' : '2px solid transparent',
    cursor: 'pointer', fontFamily: 'inherit', marginBottom: '-1px',
  })

  if (loading) return <div style={s.empty}>Loading...</div>

  return (
    <>
      {/* ── Invite panel ── */}
      <div style={{ marginBottom: '28px', border: '1px solid #ebebe8', borderRadius: '10px', overflow: 'hidden' }}>
        <button
          onClick={() => setShowInvitePanel(o => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: showInvitePanel ? '#fafaf9' : '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>Invite a user</span>
            {unlinkedEmployees.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 500, background: '#e8f4ff', color: '#0070CA', padding: '1px 7px', borderRadius: '10px' }}>
                {unlinkedEmployees.length} employee{unlinkedEmployees.length !== 1 ? 's' : ''} without login
              </span>
            )}
          </div>
          <span style={{ fontSize: '11px', color: '#a8a8a4' }}>{showInvitePanel ? '▲' : '▼'}</span>
        </button>

        {showInvitePanel && (
          <div style={{ borderTop: '1px solid #ebebe8' }}>
            <div style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid #ebebe8' }}>
              <button style={inviteTabStyle(inviteMode === 'employees')} onClick={() => setInviteMode('employees')}>
                Employees without login ({unlinkedEmployees.length})
              </button>
              <button style={inviteTabStyle(inviteMode === 'manual')} onClick={() => setInviteMode('manual')}>
                Invite by email
              </button>
            </div>

            <div style={{ padding: '16px 20px' }}>
              {inviteMode === 'employees' && (
                unlinkedEmployees.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#a8a8a4', padding: '8px 0' }}>All employees already have a login.</div>
                ) : (
                  unlinkedEmployees.map(emp => (
                    <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f0efeb' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>{emp.full_name}</div>
                        <div style={{ fontSize: '12px', color: '#8a8a86' }}>{emp.email}{emp.brand ? ` · ${emp.brand}` : ''}</div>
                      </div>
                      {pendingInvite === emp.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <select value={pendingRole} onChange={e => setPendingRole(e.target.value)} style={s.select}>
                            {CHANGEABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <button onClick={() => sendInviteToEmployee(emp, pendingRole)} disabled={inviting}
                            style={{ ...s.btnSmall(false), background: '#1a1a1a', color: '#fff', border: 'none' }}>
                            {inviting ? 'Sending…' : 'Confirm & send'}
                          </button>
                          <button onClick={() => setPendingInvite(null)} style={s.btnSmall(false)}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => { setPendingInvite(emp.id); setPendingRole('employee') }} style={s.btnSmall(false)}>
                          Send invite
                        </button>
                      )}
                    </div>
                  ))
                )
              )}

              {inviteMode === 'manual' && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#8a8a86', marginBottom: '4px' }}>Email</div>
                    <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendManualInvite()}
                      placeholder="name@example.com"
                      style={{ border: '1px solid #ebebe8', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', minWidth: '220px', color: '#1a1a1a' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#8a8a86', marginBottom: '4px' }}>Role</div>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={s.filterSelect}>
                      {CHANGEABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#8a8a86', marginBottom: '4px' }}>Brand</div>
                    <select value={inviteBrand} onChange={e => setInviteBrand(e.target.value)} style={s.filterSelect}>
                      <option value="">—</option>
                      <option value="ISL">ISL</option>
                      <option value="AS">AS</option>
                      <option value="ADS">ADS</option>
                    </select>
                  </div>
                  <button onClick={sendManualInvite} disabled={inviting || !inviteEmail.trim()}
                    style={{ background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: inviting || !inviteEmail.trim() ? 'default' : 'pointer', fontFamily: 'inherit', opacity: inviting || !inviteEmail.trim() ? 0.5 : 1 }}>
                    {inviting ? 'Sending…' : 'Send invite'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Users table ── */}
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>User</th>
            <th style={s.th}>Role</th>
            <th style={s.th}>Brand</th>
            <th style={s.th}>Created</th>
            <th style={s.th}>Last sign in</th>
            <th style={s.th}>Status</th>
            <th style={s.th}></th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td style={s.td}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={s.statusDot(!u.deactivated)} />
                  <div style={{ fontSize: 13, color: '#1a1a1a' }}>{u.email}</div>
                </div>
              </td>
              <td style={s.td}>
                {u.role === 'super_admin' ? (
                  <span style={s.badge('super_admin')}>super_admin</span>
                ) : (
                  <select
                    style={s.select}
                    value={u.role || 'none'}
                    onChange={e => handleRoleChange(u.id, e.target.value, u.email)}
                    disabled={!u.role || u.role === 'none'}
                  >
                    {!u.role || u.role === 'none'
                      ? <option value="none">No profile</option>
                      : CHANGEABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)
                    }
                  </select>
                )}
              </td>
              <td style={s.td}><span style={{ fontSize: 12, color: '#8a8a86' }}>{u.brand || '—'}</span></td>
              <td style={s.td}><span style={{ fontSize: 12, color: '#8a8a86' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-CA') : '—'}</span></td>
              <td style={s.td}><span style={{ fontSize: 12, color: '#8a8a86' }}>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-CA') : 'Never'}</span></td>
              <td style={s.td}><span style={{ fontSize: 12, color: u.deactivated ? '#c74848' : '#2d7a4a', fontWeight: 500 }}>{u.deactivated ? 'Deactivated' : 'Active'}</span></td>
              <td style={s.td}>
                {u.role !== 'super_admin' && u.role && u.role !== 'none' && (
                  <button style={s.btnSmall(u.deactivated ? false : true)} onClick={() => handleToggleDeactivated(u.id, u.deactivated, u.email)}>
                    {u.deactivated ? 'Reactivate' : 'Deactivate'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <div style={s.empty}>No users found.</div>}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </>
  )
}

function AuditLogTab() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (filterAction) query = query.eq('action', filterAction)
    if (filterFrom) query = query.gte('created_at', filterFrom + 'T00:00:00')
    if (filterTo) query = query.lte('created_at', filterTo + 'T23:59:59')

    const { data } = await query
    setLogs(data || [])
    setLoading(false)
  }, [filterAction, filterFrom, filterTo])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function formatTime(ts) {
    if (!ts) return '—'
    return new Date(ts).toLocaleString('en-CA', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  function describeEntity(log) {
    if (!log.entity_type && !log.entity_id) return null
    const parts = []
    if (log.entity_type) parts.push(log.entity_type)
    if (log.metadata?.user_email) parts.push(log.metadata.user_email)
    else if (log.entity_id && log.entity_id.length < 40) parts.push(log.entity_id)
    if (log.metadata?.new_role) parts.push(`→ ${log.metadata.new_role}`)
    if (log.metadata?.value) parts.push(`"${log.metadata.value}"`)
    return parts.join(' · ')
  }

  return (
    <>
      <div style={s.filterRow}>
        <select style={s.filterSelect} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          style={s.filterInput}
          type="date"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          placeholder="From"
        />
        <span style={{ fontSize: 12, color: '#a8a8a4' }}>to</span>
        <input
          style={s.filterInput}
          type="date"
          value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          placeholder="To"
        />
        {(filterAction || filterFrom || filterTo) && (
          <button
            style={{ fontSize: 12, color: '#0070CA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => { setFilterAction(''); setFilterFrom(''); setFilterTo('') }}
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div style={s.empty}>Loading...</div>
      ) : logs.length === 0 ? (
        <div style={s.empty}>No audit log entries yet.</div>
      ) : (
        logs.map(log => (
          <div key={log.id} style={s.logRow}>
            <div style={s.logTime}>{formatTime(log.created_at)}</div>
            <div style={s.logUser}>{log.user_email || 'Unknown'}</div>
            <div style={{ flex: 1 }}>
              <div style={s.logAction}>{ACTION_LABELS[log.action] || log.action}</div>
              {describeEntity(log) && (
                <div style={s.logEntity}>{describeEntity(log)}</div>
              )}
            </div>
          </div>
        ))
      )}
    </>
  )
}

function SystemSettingsTab() {
  const [settings, setSettings] = useState([])
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState({})
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    const { data, error } = await supabase.from('system_settings').select('*').order('key')
    if (error) {
      showToast(handleSupabaseError(error, 'Failed to load settings.'), 'error')
    } else if (data) {
      setSettings(data)
      const v = {}
      data.forEach(s => { v[s.key] = s.value })
      setValues(v)
    }
  }

  async function handleSave(key) {
    setSaving(prev => ({ ...prev, [key]: true }))
    const { error } = await supabase
      .from('system_settings')
      .update({ value: values[key], updated_at: new Date().toISOString() })
      .eq('key', key)
    if (error) {
      showToast(handleSupabaseError(error, 'Failed to save setting.'), 'error')
    } else {
      await logAudit('system_setting_updated', 'system_settings', key, { value: values[key] })
      showToast('Setting saved')
    }
    setSaving(prev => ({ ...prev, [key]: false }))
  }

  function labelFor(key) {
    if (key === 'hr_notification_email') return 'HR notification email'
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  return (
    <>
      {settings.map(setting => (
        <div key={setting.key} style={s.settingRow}>
          <div style={s.settingKey}>{labelFor(setting.key)}</div>
          <input
            style={s.settingInput}
            type="text"
            value={values[setting.key] ?? ''}
            onChange={e => setValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSave(setting.key)}
          />
          <button
            style={s.btnSave}
            onClick={() => handleSave(setting.key)}
            disabled={saving[setting.key]}
          >
            {saving[setting.key] ? 'Saving…' : 'Save'}
          </button>
        </div>
      ))}
      {settings.length === 0 && <div style={s.empty}>No settings configured.</div>}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </>
  )
}
