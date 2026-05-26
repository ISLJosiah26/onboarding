import { useEffect } from 'react'

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const colors = {
    success: { bg: '#1a1a1a', color: '#fff' },
    error: { bg: '#c74848', color: '#fff' },
    warning: { bg: '#d4901a', color: '#fff' }
  }

  const { bg, color } = colors[type] || colors.success

  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', bottom: '32px', left: '50%',
      transform: 'translateX(-50%)',
      background: bg, color,
      borderRadius: '10px', padding: '12px 20px',
      fontSize: '13px', fontWeight: 500,
      display: 'flex', alignItems: 'center', gap: '10px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      zIndex: 1000, fontFamily: 'Inter, -apple-system, sans-serif',
      whiteSpace: 'nowrap',
      animation: 'slideUp 0.3s ease'
    }}>
      {type === 'success' && <span>✓</span>}
      {type === 'error' && <span>✕</span>}
      {type === 'warning' && <span>⚠</span>}
      {message}
    </div>
  )
}