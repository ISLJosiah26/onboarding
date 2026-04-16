import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Dashboard from './pages/Dashboard'

function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  async function handleLogin() {
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
  }

  if (!session) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#f5f7fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
      }}>
        <div style={{ width: '340px' }}>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#0070CA', marginBottom: '24px' }}>
            Integrated <span style={{ color: '#111' }}>Launch</span>
          </div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '9px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '9px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
          />
          {error && <p style={{ color: 'red', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}
          <button
            onClick={handleLogin}
            style={{ width: '100%', background: '#0070CA', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  return <Dashboard session={session} />
}

export default App