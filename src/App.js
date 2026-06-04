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
import { pageToPath, pathToPage } from './config'


function App() {
  const [session, setSession] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [page, setPage] = useState(pathToPage(window.location.pathname))
  const [selectedRole, setSelectedRole] = useState(null)
  const [activeInstanceId, setActiveInstanceId] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [forgotPassword, setForgotPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    const onPopState = () => setPage(pathToPage(window.location.pathname))
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
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
  }

  async function handleForgotPassword() {
  if (!email) { setError('Please enter your email address first.'); return }
  setError('')
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  })
  if (error) setError(error.message)
  else setResetSent(true)
}

  function navigate(targetPage, opts = {}) {
    const nextPath = pageToPath(targetPage)
    if (opts.replace) window.history.replaceState({}, '', nextPath)
    else if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath)
    setPage(targetPage)
  }

  function handleNavigate(target) {
    setRefreshKey(k => k + 1)
    navigate(target === 'active' ? 'new-onboarding-select' : target)
  }

if (!session) {
  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, -apple-system, sans-serif', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
          <div style={{ width: '44px', height: '44px', background: '#0070CA', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>IL</div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.5px', marginBottom: '4px' }}>Welcome back</div>
          <div style={{ fontSize: '13px', color: '#8a8a86' }}>Sign in to Integrated Launch</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #ebebe8', borderRadius: '12px', padding: '28px' }}>
          {resetSent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a', marginBottom: '8px' }}>Check your email</div>
              <div style={{ fontSize: '13px', color: '#8a8a86', lineHeight: '1.6', marginBottom: '20px' }}>
                We sent a password reset link to {email}. Click the link to set a new password.
              </div>
              <button onClick={() => { setResetSent(false); setForgotPassword(false) }}
                style={{ fontSize: '13px', color: '#0070CA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Back to sign in
              </button>
            </div>
          ) : forgotPassword ? (
            <>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a', marginBottom: '4px' }}>Reset your password</div>
              <div style={{ fontSize: '13px', color: '#8a8a86', marginBottom: '20px' }}>Enter your email and we'll send you a reset link.</div>
              <label style={{ fontSize: '12px', color: '#8a8a86', marginBottom: '6px', display: 'block' }}>Email</label>
              <input type="email" placeholder="you@integratedstaffing.ca" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                style={{ display: 'block', width: '100%', marginBottom: '16px', padding: '10px 14px', border: '1px solid #ebebe8', borderRadius: '7px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', color: '#1a1a1a', background: '#fff', boxSizing: 'border-box' }} />
              {error && (
                <div style={{ fontSize: '12px', color: '#c74848', marginBottom: '16px', padding: '10px 12px', background: '#fdf0f0', border: '1px solid #f5d6d6', borderRadius: '6px' }}>
                  {error}
                </div>
              )}
              <button onClick={handleForgotPassword}
                style={{ width: '100%', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', padding: '11px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginBottom: '12px' }}>
                Send reset link
              </button>
              <button onClick={() => { setForgotPassword(false); setError('') }}
                style={{ width: '100%', background: 'transparent', color: '#8a8a86', border: 'none', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', padding: '4px' }}>
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <label style={{ fontSize: '12px', color: '#8a8a86', marginBottom: '6px', display: 'block' }}>Email</label>
              <input type="email" placeholder="you@integratedstaffing.ca" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ display: 'block', width: '100%', marginBottom: '16px', padding: '10px 14px', border: '1px solid #ebebe8', borderRadius: '7px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', color: '#1a1a1a', background: '#fff', boxSizing: 'border-box' }} />
              <label style={{ fontSize: '12px', color: '#8a8a86', marginBottom: '6px', display: 'block' }}>Password</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ display: 'block', width: '100%', marginBottom: '20px', padding: '10px 14px', border: '1px solid #ebebe8', borderRadius: '7px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', color: '#1a1a1a', background: '#fff', boxSizing: 'border-box' }} />
              {error && (
                <div style={{ fontSize: '12px', color: '#c74848', marginBottom: '16px', padding: '10px 12px', background: '#fdf0f0', border: '1px solid #f5d6d6', borderRadius: '6px' }}>
                  {error}
                </div>
              )}
              <button onClick={handleLogin}
                style={{ width: '100%', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', padding: '11px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginBottom: '12px' }}>
                Sign in
              </button>
              <button onClick={() => { setForgotPassword(true); setError('') }}
                style={{ width: '100%', background: 'transparent', color: '#8a8a86', border: 'none', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', padding: '4px' }}>
                Forgot password?
              </button>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#a8a8a4' }}>
          Integrated Staffing Limited · onboarding portal
        </div>
      </div>
    </div>
  )
}

  if (profileLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, -apple-system, sans-serif', color: '#a8a8a4', fontSize: '13px' }}>
        Loading...
      </div>
    )
  }

  if (page === 'set-password') {
    return <SetPassword onComplete={() => navigate('dashboard')} />
  }

  if (userProfile?.deactivated) {
    return (
      <div style={{ minHeight: '100vh', background: '#fafaf9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, -apple-system, sans-serif', padding: '20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginBottom: '8px' }}>Account deactivated</div>
          <div style={{ fontSize: '13px', color: '#8a8a86', marginBottom: '24px', lineHeight: 1.6 }}>Your account has been deactivated. Please contact HR if you believe this is an error.</div>
          <button onClick={() => supabase.auth.signOut()} style={{ fontSize: '13px', color: '#0070CA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
        </div>
      </div>
    )
  }

  if (userProfile?.role === 'employee') {
    return <EmployeePortal session={session} userProfile={userProfile} />
  }

  if (page === 'super-admin-users' || page === 'super-admin-audit' || page === 'super-admin-settings') {
    if (userProfile?.role !== 'super_admin') return null
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
          navigate('plan')
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
    if (userProfile?.role !== 'admin' && userProfile?.role !== 'super_admin') {
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
          navigate('plan')
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
        navigate('plan')
      }}
    />
  )
}

export default App