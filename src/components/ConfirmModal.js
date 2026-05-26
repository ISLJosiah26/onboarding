import { useEffect, useRef, useState } from 'react'

export default function ConfirmModal({ title, message, confirmLabel, confirmDanger, onConfirm, onCancel }) {
  const [confirming, setConfirming] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => () => { mountedRef.current = false }, [])

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape' && !confirming) onCancel() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel, confirming])

  async function handleConfirm() {
    setConfirming(true)
    try {
      await onConfirm()
    } finally {
      if (mountedRef.current) setConfirming(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, -apple-system, sans-serif'
      }}
      onClick={confirming ? undefined : onCancel}
    >
      <div
        style={{
          background: '#fff', borderRadius: '12px',
          border: '1px solid #ebebe8',
          padding: '28px', width: '100%', maxWidth: '400px',
          margin: '0 24px'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.3px', marginBottom: '8px' }}>
          {title}
        </div>
        <div style={{ fontSize: '13px', color: '#8a8a86', lineHeight: '1.6', marginBottom: '24px' }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onCancel}
            disabled={confirming}
            style={{ background: 'transparent', color: '#5f5f5c', border: '1px solid #ebebe8', borderRadius: '7px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: confirming ? 'default' : 'pointer', fontFamily: 'inherit', opacity: confirming ? 0.5 : 1 }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            style={{ background: confirmDanger ? '#c74848' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: confirming ? 'default' : 'pointer', fontFamily: 'inherit', opacity: confirming ? 0.7 : 1, minWidth: '80px' }}
          >
            {confirming ? 'Working…' : (confirmLabel || 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
