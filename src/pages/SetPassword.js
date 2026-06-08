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
    <div style={{ minHeight: '100vh', background: '#fafaf9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, -apple-system, sans-serif', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
          <div style={{ width: '44px', height: '44px', background: '#0070CA', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>IL</div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.5px', marginBottom: '4px' }}>Set your password</div>
          <div style={{ fontSize: '13px', color: '#8a8a86', textAlign: 'center' }}>Create a password to access your onboarding portal.</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #ebebe8', borderRadius: '12px', padding: '28px' }}>
          <label style={{ fontSize: '12px', color: '#8a8a86', marginBottom: '6px', display: 'block' }}>New password</label>
          <input
            type="password"
            placeholder="At least 8 characters"
            value={password}
            autoFocus
            onChange={e => setPassword(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: '16px', padding: '10px 14px', border: '1px solid #ebebe8', borderRadius: '7px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', color: '#1a1a1a', background: '#fff', boxSizing: 'border-box' }}
          />
          <label style={{ fontSize: '12px', color: '#8a8a86', marginBottom: '6px', display: 'block' }}>Confirm password</label>
          <input
            type="password"
            placeholder="Repeat your password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && handleSetPassword()}
            style={{ display: 'block', width: '100%', marginBottom: '20px', padding: '10px 14px', border: '1px solid #ebebe8', borderRadius: '7px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', color: '#1a1a1a', background: '#fff', boxSizing: 'border-box' }}
          />
          {error && (
            <div style={{ fontSize: '12px', color: '#c74848', marginBottom: '16px', padding: '10px 12px', background: '#fdf0f0', border: '1px solid #f5d6d6', borderRadius: '6px' }}>
              {error}
            </div>
          )}
          <button
            onClick={handleSetPassword}
            disabled={loading}
            style={{ width: '100%', background: loading ? '#6b6b67' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', padding: '11px', fontSize: '13px', fontWeight: 500, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'background 0.12s ease' }}
          >
            {loading ? 'Saving…' : 'Set password'}
          </button>
        </div>
      </div>
    </div>
  )
}
