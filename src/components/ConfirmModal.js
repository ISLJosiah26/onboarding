import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export default function ConfirmModal({ title, message, confirmLabel, confirmDanger, onConfirm, onCancel }) {
  const [confirming, setConfirming] = useState(false)
  const mountedRef = useRef(true)
  const modalRef = useRef(null)

  useEffect(() => () => { mountedRef.current = false }, [])

  useLayoutEffect(() => {
    const focusable = modalRef.current?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')
    if (focusable?.length) focusable[focusable.length - 1].focus()
  }, [])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && !confirming) { onCancel(); return }
      if (e.key !== 'Tab' || !modalRef.current) return
      const focusable = [...modalRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
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
      className="il-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
      onClick={confirming ? undefined : onCancel}
    >
      <div
        ref={modalRef}
        className="il-modal"
        style={{
          background: '#fff', borderRadius: '14px',
          border: '1px solid #e8e8e4',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          padding: '28px', width: '100%', maxWidth: '400px',
          margin: '0 24px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.3px', marginBottom: '8px' }}>
          {title}
        </div>
        <div style={{ fontSize: '13px', color: '#6b6b67', lineHeight: '1.6', marginBottom: '24px' }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            className="il-btn-ghost"
            onClick={onCancel}
            disabled={confirming}
            style={{ background: 'transparent', color: '#5f5f5c', border: '1px solid #e8e8e4', borderRadius: '7px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: confirming ? 'default' : 'pointer', fontFamily: 'inherit', opacity: confirming ? 0.5 : 1 }}
          >
            Cancel
          </button>
          <button
            className="il-btn"
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
