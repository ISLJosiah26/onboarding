import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

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
      <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
        <h2>Onboarding Portal</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }}
        />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button onClick={handleLogin} style={{ padding: '8px 16px' }}>Sign In</button>
      </div>
    )
  }

  return (
    <div style={{ padding: '40px' }}>
      <h1>Welcome back</h1>
      <p>Logged in as: {session.user.email}</p>
      <button onClick={() => supabase.auth.signOut()}>Sign Out</button>
    </div>
  )
}

export default App