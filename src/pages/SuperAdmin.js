import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import { handleSupabaseError } from '../utils/handleError'
import { logAudit } from '../utils/auditLog'
import { useWindowSize } from '../hooks/useWindowSize'
import { ROLE } from '../config'

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

const CHANGEABLE_ROLES = [ROLE.ADMIN, ROLE.MANAGER, ROLE.EMPLOYEE]

const s = {
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontSize: '11px', fontWeight: 600, color: '#a4a39f', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 12px 12px 0', textAlign: 'left', borderBottom: '1px solid #e2e1dd' },
  td: { fontSize: '13px', color: '#18181b', padding: '13px 12px 13px 0', borderBottom: '1px solid #f0efe9', verticalAlign: 'middle' },
  statusDot: (active) => ({
    display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
    background: active ? '#1a7a4a' : '#c04040', marginRight: 6, flexShrink: 0,
  }),
  select: { border: '1px solid #e2e1dd', borderRadius: '7px', padding: '5px 8px', fontSize: '12px', fontFamily: 'inherit', background: '#fff', color: '#18181b', outline: 'none', cursor: 'pointer' },
  btnSmall: (danger) => ({
    fontSize: '12px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit',
    border: '1px solid ' + (danger ? '#f5d6d6' : '#e2e1dd'),
    background: 'transparent',
    color: danger ? '#c04040' : '#70706b',
    transition: 'background 0.1s ease',
  }),
  filterSelect: { border: '1px solid #e2e1dd', borderRadius: '7px', padding: '7px 10px', fontSize: '12px', fontFamily: 'inherit', background: '#fff', color: '#18181b', outline: 'none' },
  filterInput: { border: '1px solid #e2e1dd', borderRadius: '7px', padding: '7px 10px', fontSize: '12px', fontFamily: 'inherit', background: '#fff', color: '#18181b', outline: 'none' },
  btnSave: { background: 'linear-gradient(180deg, #222 0%, #111 100%)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, letterSpacing: '0.1px' },
  empty: { padding: '48px 0', textAlign: 'center', color: '#a4a39f', fontSize: '13px' },
  badge: (role) => {
    const colors = {
      super_admin: { bg: '#f0edff', color: '#5b3fd4' },
      admin: { bg: '#eff6ff', color: '#0066cc' },
      manager: { bg: '#f0faf4', color: '#1a7a4a' },
      employee: { bg: '#f4f3ef', color: '#70706b' },
      none: { bg: '#f4f3ef', color: '#a4a39f' },
    }
    const c = colors[role] || colors.none
    return { fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '5px', background: c.bg, color: c.color, letterSpacing: '0.1px' }
  }
}

const TAB_MAP = {
  'super-admin-users': 'Users',
  'super-admin-audit': 'Audit Log',
  'super-admin-settings': 'System Settings',
}

export default function SuperAdmin({ session, userProfile, currentPage, onNavigate }) {
  const { isMobile } = useWindowSize()
  const tab = TAB_MAP[currentPage] || 'Users'

  function setTab(t) { onNavigate(Object.keys(TAB_MAP).find(k => TAB_MAP[k] === t)) }

  const p = isMobile ? '16px' : '40px'

  return (
    <Layout session={session} userProfile={userProfile} currentPage={currentPage} onNavigate={onNavigate}>
      <div style={{ padding: isMobile ? '16px 16px 0' : '28px 40px 0', boxShadow: '0 1px 0 #e2e1dd', background: '#fff' }}>
        <div style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: 600, letterSpacing: '-0.5px', marginBottom: '16px', color: '#18181b' }}>System</div>
        <div style={{ display: 'flex', gap: '0', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', marginBottom: '-1px' }}>
          {['Users', 'Audit Log', 'System Settings'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: isMobile ? '10px 14px' : '10px 18px',
                fontSize: '13px', fontWeight: tab === t ? 600 : 400,
                color: tab === t ? '#0066cc' : '#70706b',
                background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid #0066cc' : '2px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'color 0.12s ease, border-color 0.12s ease',
              }}
            >{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: isMobile ? '20px 16px' : '32px 40px', maxWidth: isMobile ? 'none' : '900px' }}>
        {tab === 'Users' && <UsersTab isMobile={isMobile} p={p} />}
        {tab === 'Audit Log' && <AuditLogTab isMobile={isMobile} />}
        {tab === 'System Settings' && <SystemSettingsTab isMobile={isMobile} />}
      </div>
    </Layout>
  )
}

function UsersTab({ isMobile }) {
  const [users, setUsers] = useState([])
  const [allEmployees, setAllEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvitePanel, setShowInvitePanel] = useState(false)
  const [inviteMode, setInviteMode] = useState('employees')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState(ROLE.EMPLOYEE)
  const [inviteBrand, setInviteBrand] = useState('')
  const [pendingInvite, setPendingInvite] = useState(null)
  const [pendingRole, setPendingRole] = useState(ROLE.EMPLOYEE)
  const [inviting, setInviting] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch functions are stable, mount-only fetch
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

  const linkedEmployeeIds = useMemo(() => new Set(users.filter(u => u.employee_id).map(u => u.employee_id)), [users])
  const unlinkedEmployees = useMemo(() => allEmployees.filter(e => !linkedEmployeeIds.has(e.id)), [allEmployees, linkedEmployeeIds])

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
      setInviteRole(ROLE.EMPLOYEE)
      setInviteBrand('')
      fetchUsers()
    }
  }

  async function handleRoleChange(userId, newRole, userEmail) {
    const { error } = await supabase.from('user_profiles').update({ role: newRole }).eq('id', userId)
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
    const { error } = await supabase.from('user_profiles').update({ deactivated: newDeactivated }).eq('id', userId)
    if (error) {
      showToast(handleSupabaseError(error, 'Failed to update user status.'), 'error')
    } else {
      await logAudit(newDeactivated ? 'user_deactivated' : 'user_reactivated', 'user', userId, { user_email: userEmail })
      showToast(newDeactivated ? 'User deactivated' : 'User reactivated')
      fetchUsers()
    }
  }

  const inviteTabStyle = (active) => ({
    padding: '8px 14px', fontSize: '12px', fontWeight: active ? 600 : 400,
    color: active ? '#0066cc' : '#70706b', background: 'none', border: 'none',
    borderBottom: active ? '2px solid #0066cc' : '2px solid transparent',
    cursor: 'pointer', fontFamily: 'inherit', marginBottom: '-1px',
    transition: 'color 0.12s ease, border-color 0.12s ease',
  })

  if (loading) return <div style={{ ...s.empty, display: 'flex', justifyContent: 'center' }}><div className="il-spinner" role="status" aria-label="Loading" /></div>

  return (
    <>
      {/* ── Invite panel ── */}
      <div style={{ marginBottom: '28px', border: '1px solid #e2e1dd', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 2px 10px rgba(0,0,0,0.03)' }}>
        <button
          onClick={() => setShowInvitePanel(o => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: showInvitePanel ? '#f9f8f5' : '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#18181b' }}>Invite a user</span>
            {unlinkedEmployees.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 600, background: '#eff6ff', color: '#0066cc', padding: '1px 8px', borderRadius: '99px' }}>
                {unlinkedEmployees.length} employee{unlinkedEmployees.length !== 1 ? 's' : ''} without login
              </span>
            )}
          </div>
          <span style={{ fontSize: '11px', color: '#a4a39f', flexShrink: 0 }}>{showInvitePanel ? '▲' : '▼'}</span>
        </button>

        {showInvitePanel && (
          <div style={{ borderTop: '1px solid #e2e1dd' }}>
            <div style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid #e2e1dd', overflowX: 'auto' }}>
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
                  <div style={{ fontSize: '13px', color: '#a4a39f', padding: '8px 0' }}>All employees already have a login.</div>
                ) : (
                  unlinkedEmployees.map(emp => (
                    <div key={emp.id} style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '10px' : '12px', padding: '10px 0', borderBottom: '1px solid #f0efe9' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#18181b' }}>{emp.full_name}</div>
                        <div style={{ fontSize: '12px', color: '#70706b' }}>{emp.email}{emp.brand ? ` · ${emp.brand}` : ''}</div>
                      </div>
                      {pendingInvite === emp.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <select value={pendingRole} onChange={e => setPendingRole(e.target.value)} style={s.select}>
                            {CHANGEABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <button onClick={() => sendInviteToEmployee(emp, pendingRole)} disabled={inviting}
                            style={{ ...s.btnSmall(false), background: 'linear-gradient(180deg, #222 0%, #111 100%)', color: '#fff', border: 'none' }}>
                            {inviting ? 'Sending…' : 'Confirm & send'}
                          </button>
                          <button onClick={() => setPendingInvite(null)} style={s.btnSmall(false)}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => { setPendingInvite(emp.id); setPendingRole(ROLE.EMPLOYEE) }} style={s.btnSmall(false)}>
                          Send invite
                        </button>
                      )}
                    </div>
                  ))
                )
              )}

              {inviteMode === 'manual' && (
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '8px', flexWrap: 'wrap', alignItems: isMobile ? 'stretch' : 'flex-end' }}>
                  <div style={{ flex: isMobile ? 'none' : undefined }}>
                    <div style={{ fontSize: '11px', color: '#70706b', marginBottom: '4px' }}>Email</div>
                    <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendManualInvite()}
                      placeholder="name@example.com"
                      style={{ border: '1px solid #e2e1dd', borderRadius: '7px', padding: '7px 10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', width: isMobile ? '100%' : 'auto', minWidth: isMobile ? 'none' : '220px', color: '#18181b', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#70706b', marginBottom: '4px' }}>Role</div>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...s.filterSelect, width: isMobile ? '100%' : 'auto' }}>
                      {CHANGEABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#70706b', marginBottom: '4px' }}>Brand</div>
                    <select value={inviteBrand} onChange={e => setInviteBrand(e.target.value)} style={{ ...s.filterSelect, width: isMobile ? '100%' : 'auto' }}>
                      <option value="">—</option>
                      <option value="ISL">ISL</option>
                      <option value="AS">AS</option>
                      <option value="ADS">ADS</option>
                    </select>
                  </div>
                  <button onClick={sendManualInvite} disabled={inviting || !inviteEmail.trim()}
                    style={{ background: 'linear-gradient(180deg, #222 0%, #111 100%)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: inviting || !inviteEmail.trim() ? 'default' : 'pointer', fontFamily: 'inherit', opacity: inviting || !inviteEmail.trim() ? 0.5 : 1 }}>
                    {inviting ? 'Sending…' : 'Send invite'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Users list ── */}
      {isMobile ? (
        <div>
          {users.map(u => (
            <div key={u.id} style={{ border: '1px solid #e2e1dd', borderRadius: '10px', padding: '14px', marginBottom: '10px', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={s.statusDot(!u.deactivated)} />
                  <div style={{ fontSize: '13px', color: '#18181b', wordBreak: 'break-all', lineHeight: '1.4' }}>{u.email}</div>
                </div>
                <span style={{ fontSize: '11px', color: u.deactivated ? '#c04040' : '#1a7a4a', fontWeight: 500, flexShrink: 0 }}>
                  {u.deactivated ? 'Deactivated' : 'Active'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {u.role === ROLE.SUPER_ADMIN ? (
                  <span style={s.badge(ROLE.SUPER_ADMIN)}>super_admin</span>
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
                {u.brand && <span style={{ fontSize: '11px', color: '#70706b', background: '#f4f3ef', borderRadius: '4px', padding: '2px 6px' }}>{u.brand}</span>}
              </div>

              <div style={{ fontSize: '11px', color: '#a4a39f', marginBottom: '10px' }}>
                Joined {u.created_at ? new Date(u.created_at).toLocaleDateString('en-CA') : '—'} · Last login {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-CA') : 'Never'}
              </div>

              {u.role !== ROLE.SUPER_ADMIN && u.role && u.role !== 'none' && (
                <button style={s.btnSmall(u.deactivated ? false : true)} onClick={() => handleToggleDeactivated(u.id, u.deactivated, u.email)}>
                  {u.deactivated ? 'Reactivate' : 'Deactivate'}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
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
                    <div style={{ fontSize: 13, color: '#18181b' }}>{u.email}</div>
                  </div>
                </td>
                <td style={s.td}>
                  {u.role === ROLE.SUPER_ADMIN ? (
                    <span style={s.badge(ROLE.SUPER_ADMIN)}>super_admin</span>
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
                <td style={s.td}><span style={{ fontSize: 12, color: '#70706b' }}>{u.brand || '—'}</span></td>
                <td style={s.td}><span style={{ fontSize: 12, color: '#70706b' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-CA') : '—'}</span></td>
                <td style={s.td}><span style={{ fontSize: 12, color: '#70706b' }}>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-CA') : 'Never'}</span></td>
                <td style={s.td}><span style={{ fontSize: 12, color: u.deactivated ? '#c04040' : '#1a7a4a', fontWeight: 500 }}>{u.deactivated ? 'Deactivated' : 'Active'}</span></td>
                <td style={s.td}>
                  {u.role !== ROLE.SUPER_ADMIN && u.role && u.role !== 'none' && (
                    <button style={s.btnSmall(u.deactivated ? false : true)} onClick={() => handleToggleDeactivated(u.id, u.deactivated, u.email)}>
                      {u.deactivated ? 'Reactivate' : 'Deactivate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {users.length === 0 && <div style={s.empty}>No users found.</div>}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </>
  )
}

function AuditLogTab({ isMobile }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [logLimit, setLogLimit] = useState(100)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(logLimit)

    if (filterAction) query = query.eq('action', filterAction)
    if (filterFrom) query = query.gte('created_at', filterFrom + 'T00:00:00')
    if (filterTo) query = query.lte('created_at', filterTo + 'T23:59:59')

    const { data } = await query
    setLogs(data || [])
    setLoading(false)
  }, [filterAction, filterFrom, filterTo, logLimit])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function formatTime(ts) {
    if (!ts) return '—'
    if (isMobile) {
      return new Date(ts).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    return new Date(ts).toLocaleString('en-CA', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
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
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select style={{ ...s.filterSelect, flex: isMobile ? '1 1 100%' : undefined }} value={filterAction} onChange={e => { setFilterAction(e.target.value); setLogLimit(100) }}>
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flex: isMobile ? '1 1 100%' : undefined }}>
          <input style={{ ...s.filterInput, flex: 1, minWidth: '120px' }} type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setLogLimit(100) }} />
          <span style={{ fontSize: 12, color: '#a4a39f', flexShrink: 0 }}>to</span>
          <input style={{ ...s.filterInput, flex: 1, minWidth: '120px' }} type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setLogLimit(100) }} />
        </div>
        {(filterAction || filterFrom || filterTo) && (
          <button
            style={{ fontSize: 12, color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => { setFilterAction(''); setFilterFrom(''); setFilterTo(''); setLogLimit(100) }}
          >Clear</button>
        )}
      </div>

      {loading ? (
        <div style={{ ...s.empty, display: 'flex', justifyContent: 'center' }}><div className="il-spinner" role="status" aria-label="Loading" /></div>
      ) : logs.length === 0 ? (
        <div style={s.empty}>No audit log entries yet.</div>
      ) : (
        <>
          {logs.map(log => {
            const entity = describeEntity(log)
            return isMobile ? (
              <div key={log.id} style={{ padding: '12px 0', borderBottom: '1px solid #f0efe9' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#18181b', marginBottom: '3px' }}>
                  {ACTION_LABELS[log.action] || log.action}
                </div>
                {entity && <div style={{ fontSize: '12px', color: '#70706b', marginBottom: '4px' }}>{entity}</div>}
                <div style={{ fontSize: '11px', color: '#a4a39f' }}>
                  {formatTime(log.created_at)} · {log.user_email || 'Unknown'}
                </div>
              </div>
            ) : (
              <div key={log.id} style={{ display: 'flex', gap: '16px', padding: '12px 0', borderBottom: '1px solid #f0efe9', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '12px', color: '#a4a39f', whiteSpace: 'nowrap', minWidth: '140px' }}>{formatTime(log.created_at)}</div>
                <div style={{ fontSize: '12px', color: '#70706b', minWidth: '160px' }}>{log.user_email || 'Unknown'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: '#18181b', fontWeight: 500 }}>{ACTION_LABELS[log.action] || log.action}</div>
                  {entity && <div style={{ fontSize: '12px', color: '#70706b', marginTop: '2px' }}>{entity}</div>}
                </div>
              </div>
            )
          })}
          {logs.length >= logLimit && (
            <button
              onClick={() => setLogLimit(l => l + 100)}
              style={{ fontSize: '13px', color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '16px 0', display: 'block', width: '100%', textAlign: 'center' }}>
              Load more
            </button>
          )}
        </>
      )}
    </>
  )
}

function SystemSettingsTab({ isMobile }) {
  const [settings, setSettings] = useState([])
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState({})
  const { toast, showToast, hideToast } = useToast()

  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchSettings is stable, mount-only fetch
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
        <div key={setting.key} style={{ padding: '16px 0', borderBottom: '1px solid #f0efe9' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#18181b', marginBottom: isMobile ? '10px' : '0' }}>
            {labelFor(setting.key)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: isMobile ? '0' : '10px', flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
            <input
              style={{ flex: 1, border: '1px solid #e2e1dd', borderRadius: '7px', padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit', background: '#fff', color: '#18181b', outline: 'none', minWidth: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
              type="text"
              value={values[setting.key] ?? ''}
              onChange={e => setValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSave(setting.key)}
            />
            <button style={s.btnSave} onClick={() => handleSave(setting.key)} disabled={saving[setting.key]}>
              {saving[setting.key] ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ))}
      {settings.length === 0 && <div style={s.empty}>No settings configured.</div>}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </>
  )
}
