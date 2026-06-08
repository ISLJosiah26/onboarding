import { useState } from 'react'
import { supabase } from '../supabaseClient'

const AUTH_ERROR_MAP = {
  'Auth session missing':       'Your invite link has expired. Please request a new one.',
  'New password should be different from the old password': 'Please choose a different password from your previous one.',
  'Password should be at least 6 characters': 'Password must be at least 8 characters.',
  'Token has expired or is invalid': 'Your invite link has expired. Please request a new one.',
}

function friendlyAuthError(msg) {
  for (const [key, friendly] of Object.entries(AUTH_ERROR_MAP)) {
    if (msg.includes(key)) return friendly
  }
  return msg || 'Something went wrong. Please try again.'
}

export default function SetPassword({ onComplete }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSetPassword() {
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(friendlyAuthError(error.message))
      setLoading(false)
    } else {
      onComplete()
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f3ef', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, -apple-system, sans-serif', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
          <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #004db3 0%, #0080ff 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', fontWeight: 700, marginBottom: '18px', boxShadow: '0 4px 16px rgba(0,102,204,0.3)' }}>IL</div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#18181b', letterSpacing: '-0.6px', marginBottom: '4px' }}>Set your password</div>
          <div style={{ fontSize: '13px', color: '#70706b', textAlign: 'center' }}>Create a password to access your onboarding portal.</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e1dd', borderRadius: '14px', padding: '28px', boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)' }}>
          <label style={{ fontSize: '12px', color: '#70706b', marginBottom: '6px', display: 'block', fontWeight: 500 }}>New password</label>
          <input
            type="password"
            placeholder="At least 8 characters"
            value={password}
            autoFocus
            onChange={e => setPassword(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: '16px', padding: '10px 14px', border: '1px solid #e2e1dd', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', color: '#18181b', background: '#fff', boxSizing: 'border-box' }}
          />
          <label style={{ fontSize: '12px', color: '#70706b', marginBottom: '6px', display: 'block', fontWeight: 500 }}>Confirm password</label>
          <input
            type="password"
            placeholder="Repeat your password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && handleSetPassword()}
            style={{ display: 'block', width: '100%', marginBottom: '20px', padding: '10px 14px', border: '1px solid #e2e1dd', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', color: '#18181b', background: '#fff', boxSizing: 'border-box' }}
          />
          {error && (
            <div style={{ fontSize: '12px', color: '#c04040', marginBottom: '16px', padding: '10px 12px', background: '#fdf0f0', border: '1px solid #f5d6d6', borderRadius: '7px' }}>
              {error}
            </div>
          )}
          <button
            className="il-btn"
            onClick={handleSetPassword}
            disabled={loading}
            style={{ width: '100%', background: loading ? '#9ca3af' : 'linear-gradient(180deg, #222 0%, #111 100%)', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px', fontSize: '13px', fontWeight: 500, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', letterSpacing: '0.1px' }}
          >
            {loading ? 'Saving…' : 'Set password'}
          </button>
        </div>
      </div>
    </div>
  )
}
