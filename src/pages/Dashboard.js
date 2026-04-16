import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase()
}

function getPhase(hireDate) {
  const days = Math.floor((new Date() - new Date(hireDate)) / (1000 * 60 * 60 * 24))
  if (days <= 7) return 'Week 1'
  if (days <= 14) return 'Week 2'
  if (days <= 30) return '30 Day'
  if (days <= 60) return '60 Day'
  return '90 Day'
}

export default function Dashboard({ session, onStartOnboarding, onViewOnboarding, refreshKey }) {
  const [onboardings, setOnboardings] = useState([])
  const [roles, setRoles] = useState([])
  const [selectedRole, setSelectedRole] = useState('')

useEffect(() => {
  console.log('refreshing with key', refreshKey)
  fetchOnboardings()
  fetchRoles()
}, [refreshKey])

  async function fetchOnboardings() {
    const { data, error } = await supabase
      .from('onboarding_instances')
      .select(`
        id, started_at, status,
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
    const role = roles.find(r => r.id === selectedRole)
    onStartOnboarding(role)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '54px', borderBottom: '0.5px solid #f0f0f0' }}>
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#0070CA', letterSpacing: '-0.3px' }}>
          Integrated <span style={{ color: '#111', fontWeight: '500' }}>Launch</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#999' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#0070CA', color: '#fff', fontSize: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>HR</div>
          {session.user.email}
          <button onClick={() => supabase.auth.signOut()} style={{ marginLeft: '8px', fontSize: '12px', color: '#ccc', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: '1', padding: '36px 32px', gap: '48px' }}>

        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#ccc', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' }}>Active onboardings</div>
          {onboardings.length === 0 && (
            <p style={{ fontSize: '14px', color: '#ccc' }}>No active onboardings yet.</p>
          )}
          {onboardings.map(o => {
            const total = o.task_completions.length
            const completed = o.task_completions.filter(t => t.completed).length
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0
            const name = o.employees.full_name
            const phase = getPhase(o.employees.hire_date)
            return (
              <div key={o.id} onClick={() => onViewOnboarding(o.id)} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0', borderBottom: '0.5px solid #f5f5f5', cursor: 'pointer' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f0f7ff', color: '#0070CA', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {getInitials(name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#111' }}>{name}</div>
                  <div style={{ fontSize: '12px', color: '#bbb', marginTop: '2px' }}>
                    {o.employees.roles.name} · Started {new Date(o.employees.hire_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </div>
                  <div style={{ height: '3px', background: '#f5f5f5', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#0070CA', borderRadius: '2px' }}></div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#ccc', marginTop: '4px' }}>{pct}% complete</div>
                </div>
                <div style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: '#f0f7ff', color: '#0070CA', fontWeight: '500', flexShrink: 0 }}>{phase}</div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '18px' }}>
          <div style={{ fontSize: '22px', fontWeight: '600', color: '#111', letterSpacing: '-0.4px' }}>Start new onboarding</div>
          <div style={{ fontSize: '13px', color: '#bbb', marginTop: '-10px' }}>Select a role to begin.</div>
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            style={{ width: '100%', maxWidth: '240px', background: '#fff', border: '0.5px solid #e5e5e5', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', color: '#333', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
          >
            <option value="">Select a role...</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button onClick={handleGo} style={{ background: '#f0f0f0', color: '#444', border: 'none', borderRadius: '10px', padding: '10px 36px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>Go</button>
        </div>

      </div>
    </div>
  )
}