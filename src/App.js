import { useState, useEffect } from 'react'
import { supabase, getUserProfile } from './supabaseClient'
import Dashboard from './pages/Dashboard'
import NewOnboarding from './pages/NewOnboarding'
import OnboardingPlan from './pages/OnboardingPlan'
import Admin from './pages/Admin'
import SuperAdmin from './pages/SuperAdmin'
import TimeOff from './pages/TimeOff'
import EmployeePortal from './pages/EmployeePortal'
import SetPassword from './pages/SetPassword'
import { pageToPath, pathToPage, planPath, parseInstanceId, ROLE } from './config'
import Button from './ui/Button'
import { T } from './ui/theme'


function App() {
  const [session, setSession] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [page, setPage] = useState(() => {
    const hash = window.location.hash
    if (hash.includes('type=invite') || hash.includes('type=recovery')) return 'set-password'
    return pathToPage(window.location.pathname)
  })
  const [selectedRole, setSelectedRole] = useState(null)
  // Hydrate from the URL so /onboarding/plan/<id> restores on refresh/deep-link.
  const [activeInstanceId, setActiveInstanceId] = useState(() => parseInstanceId(window.location.pathname))
  const [refreshKey, setRefreshKey] = useState(0)
  const [forgotPassword, setForgotPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [employeeView, setEmployeeView] = useState(() => localStorage.getItem('il-view-mode') === 'employee')

  useEffect(() => {
    const onPopState = () => {
      setPage(pathToPage(window.location.pathname))
      const id = parseInstanceId(window.location.pathname)
      if (id) setActiveInstanceId(id)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])


useEffect(() => {
  const hash = window.location.hash
  const isInviteLink = hash.includes('type=invite') || hash.includes('type=recovery')

  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session)
    if (session) {
      fetchProfile(session.user.id)
      if (isInviteLink) {
        navigate('set-password', { replace: true })
      }
    } else {
      setProfileLoading(false)
    }
  })

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    setSession(session)
    if (session) {
      fetchProfile(session.user.id)
      if (_event === 'SIGNED_IN' && (hash.includes('type=invite') || hash.includes('type=recovery'))) {
        navigate('set-password', { replace: true })
      }
    } else {
      setUserProfile(null)
      setProfileLoading(false)
    }
  })

  return () => subscription.unsubscribe()
}, [])

  async function fetchProfile(userId) {
    setProfileLoading(true)
    const profile = await getUserProfile(userId)
    setUserProfile(profile)
    setProfileLoading(false)
  }

  async function handleLogin() {
    if (authBusy) return
    setError('')
    setAuthBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message.includes('Invalid login credentials')
        ? 'Incorrect email or password.'
        : error.message)
    }
    setAuthBusy(false)
  }

  async function handleForgotPassword() {
    if (authBusy) return
    if (!email) { setError('Please enter your email address first.'); return }
    setError('')
    setAuthBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    })
    if (error) setError(error.message)
    else setResetSent(true)
    setAuthBusy(false)
  }

  function navigate(targetPage, opts = {}) {
    const nextPath = targetPage === 'plan' && opts.instanceId
      ? planPath(opts.instanceId)
      : pageToPath(targetPage)
    if (opts.replace) window.history.replaceState({}, '', nextPath + window.location.hash)
    else if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath)
    setPage(targetPage)
  }

  function handleNavigate(target) {
    if (target === 'employee-hub') {
      localStorage.setItem('il-view-mode', 'employee')
      setEmployeeView(true)
      return
    }
    setRefreshKey(k => k + 1)
    navigate(target === 'active' ? 'new-onboarding-select' : target)
  }

if (!session) {
  const inputStyle = { display: 'block', width: '100%', marginBottom: '16px', padding: '10px 14px', border: `1px solid ${T.border}`, borderRadius: T.radiusMd, fontSize: '13px', fontFamily: 'inherit', color: T.text, background: T.surface, boxSizing: 'border-box' }
  const labelStyle = { fontSize: '12px', color: T.muted, marginBottom: '6px', display: 'block', fontWeight: 500 }
  const errorStyle = { fontSize: '12px', color: T.danger, marginBottom: '16px', padding: '10px 12px', background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, borderRadius: '7px' }
  const linkBtn = { width: '100%', background: 'transparent', color: T.muted, border: 'none', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', padding: '4px', marginTop: '4px' }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.font, padding: '20px' }}>
      <div className="il-auth" style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
          <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #004db3 0%, #0080ff 100%)', borderRadius: T.radiusLg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', fontWeight: 700, marginBottom: '18px', boxShadow: '0 4px 16px rgba(0,102,204,0.3)' }}>IL</div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: T.text, letterSpacing: '-0.6px', marginBottom: '4px' }}>Welcome back</div>
          <div style={{ fontSize: '13px', color: T.muted }}>Sign in to Integrated Launch</div>
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: '14px', padding: '28px', boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)' }}>
          {resetSent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: T.text, marginBottom: '8px' }}>Check your email</div>
              <div style={{ fontSize: '13px', color: T.muted, lineHeight: '1.6', marginBottom: '20px' }}>
                We sent a password reset link to {email}. Click the link to set a new password.
              </div>
              <Button variant="ghost" fullWidth onClick={() => { setResetSent(false); setForgotPassword(false) }} style={{ color: T.brand }}>
                Back to sign in
              </Button>
            </div>
          ) : forgotPassword ? (
            <>
              <div style={{ fontSize: '14px', fontWeight: 500, color: T.text, marginBottom: '4px' }}>Reset your password</div>
              <div style={{ fontSize: '13px', color: T.muted, marginBottom: '20px' }}>Enter your email and we'll send you a reset link.</div>
              <label htmlFor="login-email" style={labelStyle}>Email</label>
              <input id="login-email" type="email" autoComplete="email" placeholder="you@integratedstaffing.ca" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                style={inputStyle} />
              {error && (
                <div role="alert" style={errorStyle}>
                  {error}
                </div>
              )}
              <Button fullWidth busy={authBusy} busyLabel="Sending…" onClick={handleForgotPassword}>
                Send reset link
              </Button>
              <button onClick={() => { setForgotPassword(false); setError('') }} style={linkBtn}>
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <label htmlFor="login-email" style={labelStyle}>Email</label>
              <input id="login-email" type="email" autoComplete="email" placeholder="you@integratedstaffing.ca" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={inputStyle} />
              <label htmlFor="login-password" style={labelStyle}>Password</label>
              <input id="login-password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ ...inputStyle, marginBottom: '20px' }} />
              {error && (
                <div role="alert" style={errorStyle}>
                  {error}
                </div>
              )}
              <Button fullWidth busy={authBusy} busyLabel="Signing in…" onClick={handleLogin}>
                Sign in
              </Button>
              <button onClick={() => { setForgotPassword(true); setError('') }} style={linkBtn}>
                Forgot password?
              </button>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: T.subtle }}>
          Integrated Staffing Limited · onboarding portal
        </div>
      </div>
    </div>
  )
}

  if (profileLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Loading">
        <div className="il-spinner" />
      </div>
    )
  }

  if (page === 'set-password') {
    return <SetPassword onComplete={() => navigate('dashboard')} />
  }

  if (userProfile?.deactivated) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, -apple-system, sans-serif', padding: '20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>Account deactivated</div>
          <div style={{ fontSize: '13px', color: '#8a8a86', marginBottom: '24px', lineHeight: 1.6 }}>Your account has been deactivated. Please contact HR if you believe this is an error.</div>
          <button onClick={() => supabase.auth.signOut()} style={{ fontSize: '13px', color: '#0070CA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
        </div>
      </div>
    )
  }

  if (userProfile?.role === ROLE.EMPLOYEE) {
    return <EmployeePortal session={session} userProfile={userProfile} />
  }

  if (employeeView && userProfile?.employee_id) {
    return (
      <EmployeePortal
        session={session}
        userProfile={userProfile}
        onSwitchToAdmin={() => {
          localStorage.removeItem('il-view-mode')
          setEmployeeView(false)
        }}
      />
    )
  }

  if (page === 'super-admin-users' || page === 'super-admin-audit' || page === 'super-admin-settings') {
    if (userProfile?.role !== ROLE.SUPER_ADMIN) return null
    return (
      <SuperAdmin
        session={session}
        userProfile={userProfile}
        currentPage={page}
        onNavigate={handleNavigate}
      />
    )
  }

  if (page === 'new-onboarding' && selectedRole) {
    return (
      <NewOnboarding
        session={session}
        userProfile={userProfile}
        roleId={selectedRole.id}
        roleName={selectedRole.name}
        onBack={() => { setRefreshKey(k => k + 1); navigate('dashboard') }}
        onNavigate={handleNavigate}
        onComplete={(instanceId) => {
          setActiveInstanceId(instanceId)
          navigate('plan', { instanceId })
        }}
      />
    )
  }

  if (page === 'plan' && activeInstanceId) {
    return (
      <OnboardingPlan
        session={session}
        userProfile={userProfile}
        instanceId={activeInstanceId}
        onBack={() => { setRefreshKey(k => k + 1); navigate('dashboard') }}
        onNavigate={handleNavigate}
      />
    )
  }

  if (page === 'time-off') {
    if (userProfile?.role !== ROLE.ADMIN && userProfile?.role !== ROLE.SUPER_ADMIN) {
      navigate('dashboard')
      return null
    }
    return (
      <TimeOff
        session={session}
        userProfile={userProfile}
        onNavigate={handleNavigate}
      />
    )
  }

  if (page === 'new-onboarding-select' || page === 'templates' || page === 'documents' || page === 'company-resources' || page === 'roles' || page === 'history') {
    return (
      <Admin
        session={session}
        userProfile={userProfile}
        initialTab={page}
        onBack={() => { setRefreshKey(k => k + 1); navigate('dashboard') }}
        onNavigate={handleNavigate}
        onStartOnboarding={(role) => {
          setSelectedRole(role)
          navigate('new-onboarding')
        }}
        onViewOnboarding={(instanceId) => {
          setActiveInstanceId(instanceId)
          navigate('plan', { instanceId })
        }}
      />
    )
  }

  return (
    <Dashboard
      session={session}
      userProfile={userProfile}
      refreshKey={refreshKey}
      onNavigate={handleNavigate}
      onStartOnboarding={(role) => {
        setSelectedRole(role)
        navigate('new-onboarding')
      }}
      onViewOnboarding={(instanceId) => {
        setActiveInstanceId(instanceId)
        navigate('plan', { instanceId })
      }}
    />
  )
}

export default App