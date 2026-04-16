import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const styles = {
  app: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f5f7fa', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' },
  topbar: { background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' },
  logo: { fontSize: '15px', fontWeight: '500', color: '#0070CA' },
  avatar: { width: '28px', height: '28px', borderRadius: '50%', background: '#0070CA', color: '#fff', fontSize: '11px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  userPill: { fontSize: '13px', color: '#888', display: 'flex', alignItems: 'center', gap: '8px' },
  main: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', padding: '32px 24px', flex: '1' },
  sectionTitle: { fontSize: '13px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '16px' },
  empCard: { background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: '10px', padding: '14px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' },
  empInitials: { width: '36px', height: '36px', borderRadius: '50%', background: '#e8f3fd', color: '#0070CA', fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' },
  empName: { fontSize: '14px', fontWeight: '500', color: '#111' },
  empMeta: { fontSize: '12px', color: '#888', marginTop: '2px' },
  progressBar: { height: '4px', background: '#eee', borderRadius: '2px', overflow: 'hidden', marginTop: '8px' },
  progressFill: { height: '100%', background: '#0070CA', borderRadius: '2px' },
  progressLabel: { fontSize: '11px', color: '#aaa', marginTop: '4px' },
  phaseBadge: { fontSize: '11px', padding: '3px 8px', borderRadius: '20px', background: '#e8f3fd', color: '#0070CA', fontWeight: '500', flexShrink: '0' },
  newSide: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '16px', paddingTop: '40px' },
  newTitle: { fontSize: '20px', fontWeight: '500', color: '#111' },
  newSub: { fontSize: '13px', color: '#888' },
  select: { width: '100%', maxWidth: '260px', border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#fff' },
  btnGo: { background: '#0070CA', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 28px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' },
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase()
}

function getPhase(startDate, totalTasks, completedTasks) {
  const days = Math.floor((new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24))
  if (days <= 7) return 'Week 1'
  if (days <= 14) return 'Week 2'
  if (days <= 30) return '30 Day'
  if (days <= 60) return '60 Day'
  return '90 Day'
}

export default function Dashboard({ session }) {
  const [onboardings, setOnboardings] = useState([])
  const [roles, setRoles] = useState([])
  const [selectedRole, setSelectedRole] = useState('')

  useEffect(() => {
    fetchOnboardings()
    fetchRoles()
  }, [])

  async function fetchOnboardings() {
    const { data, error } = await supabase
      .from('onboarding_instances')
      .select(`
        id,
        started_at,
        status,
        employees (id, full_name, hire_date, roles (name)),
        task_completions (id, completed)
      `)
      .eq('status', 'active')

    if (!error) setOnboardings(data)
  }

  async function fetchRoles() {
    const { data, error } = await supabase.from('roles').select('*')
    if (!error) setRoles(data)
  }

  function handleGo() {
    if (!selectedRole) return
    alert(`Next: employee details page for role ${selectedRole}`)
  }

  return (
    <div style={styles.app}>
      <div style={styles.topbar}>
        <div style={styles.logo}>
          Integrated <span style={{ color: '#111' }}>Launch</span>
        </div>
        <div style={styles.userPill}>
          <div style={styles.avatar}>HR</div>
          <span>{session.user.email}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ marginLeft: '8px', fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={styles.main}>
        <div>
          <div style={styles.sectionTitle}>Active onboardings</div>
          {onboardings.length === 0 && (
            <p style={{ fontSize: '14px', color: '#aaa' }}>No active onboardings yet.</p>
          )}
          {onboardings.map(o => {
            const total = o.task_completions.length
            const completed = o.task_completions.filter(t => t.completed).length
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0
            const name = o.employees.full_name
            const phase = getPhase(o.employees.hire_date, total, completed)
            return (
              <div key={o.id} style={styles.empCard}>
                <div style={styles.empInitials}>{getInitials(name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={styles.empName}>{name}</div>
                  <div style={styles.empMeta}>{o.employees.roles.name} · Started {new Date(o.employees.hire_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</div>
                  <div style={styles.progressBar}>
                    <div style={{ ...styles.progressFill, width: `${pct}%` }}></div>
                  </div>
                  <div style={styles.progressLabel}>{pct}% complete</div>
                </div>
                <div style={styles.phaseBadge}>{phase}</div>
              </div>
            )
          })}
        </div>

        <div style={styles.newSide}>
          <div style={styles.newTitle}>Start new onboarding</div>
          <div style={styles.newSub}>Select a role to begin.</div>
          <select
            style={styles.select}
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          >
            <option value="">Select a role...</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button style={styles.btnGo} onClick={handleGo}>Go</button>
        </div>
      </div>
    </div>
  )
}