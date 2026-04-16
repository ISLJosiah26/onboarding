import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Dashboard from './pages/Dashboard'
import NewOnboarding from './pages/NewOnboarding'
import OnboardingPlan from './pages/OnboardingPlan'

function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [page, setPage] = useState('dashboard')
  const [selectedRole, setSelectedRole] = useState(null)
  const [activeInstanceId, setActiveInstanceId] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    supabase.auth.onAuthStateChange((_event, session) => setSession(session))
  }, [])

  async function handleLogin() {
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
  }

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
        <div style={{ width: '340px' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#0070CA', marginBottom: '24px', letterSpacing: '-0.3px' }}>
            Integrated <span style={{ color: '#111', fontWeight: '500' }}>Launch</span>
          </div>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '10px 14px', border: '0.5px solid #e5e5e5', borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', color: '#111' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: '16px', padding: '10px 14px', border: '0.5px solid #e5e5e5', borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', color: '#111' }} />
          {error && <p style={{ color: 'red', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
          <button onClick={handleLogin}
            style={{ width: '100%', background: '#f0f0f0', color: '#444', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>
            Sign in
          </button>
        </div>
      </div>
    )
  }

  if (page === 'new-onboarding' && selectedRole) {
    return (
      <NewOnboarding
        roleId={selectedRole.id}
        roleName={selectedRole.name}
        onBack={() => { setRefreshKey(k => k + 1); setPage('dashboard') }}
        onComplete={(instanceId) => {
          setActiveInstanceId(instanceId)
          setPage('plan')
        }}
      />
    )
  }

  if (page === 'plan' && activeInstanceId) {
    return (
      <OnboardingPlan
        instanceId={activeInstanceId}
        onBack={() => { setRefreshKey(k => k + 1); setPage('dashboard') }}
      />
    )
  }

  return (
    <Dashboard
      session={session}
      refreshKey={refreshKey}
      onStartOnboarding={(role) => {
        setSelectedRole(role)
        setPage('new-onboarding')
      }}
      onViewOnboarding={(instanceId) => {
        setActiveInstanceId(instanceId)
        setPage('plan')
      }}
    />
  )
}

export default App