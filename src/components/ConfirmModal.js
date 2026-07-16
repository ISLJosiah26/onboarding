import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Button from '../ui/Button'
import { T } from '../ui/theme'

export default function ConfirmModal({ title, message, confirmLabel, confirmDanger, onConfirm, onCancel }) {
  const [confirming, setConfirming] = useState(false)
  const mountedRef = useRef(true)
  const modalRef = useRef(null)

  useEffect(() => () => { mountedRef.current = false }, [])

  useLayoutEffect(() => {
    const focusable = modalRef.current?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')
    if (!focusable?.length) return
    // Danger modals focus Cancel so a stray Enter can't confirm a destructive action
    focusable[confirmDanger ? 0 : focusable.length - 1].focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          background: 'var(--glass-strong)',
          backdropFilter: 'var(--glass-filter)', WebkitBackdropFilter: 'var(--glass-filter)',
          borderRadius: '18px',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-highlight), var(--shadow-lg)',
          padding: '28px', width: '100%', maxWidth: '400px',
          margin: '0 24px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: '16px', fontWeight: 600, color: T.text, letterSpacing: '-0.3px', marginBottom: '8px' }}>
          {title}
        </div>
        <div style={{ fontSize: '13px', color: T.muted, lineHeight: '1.6', marginBottom: '24px' }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="secondary" onClick={onCancel} disabled={confirming}>
            Cancel
          </Button>
          <Button
            variant={confirmDanger ? 'danger' : 'primary'}
            onClick={handleConfirm}
            busy={confirming}
            busyLabel="Working…"
            style={{ minWidth: '80px' }}
          >
            {confirmLabel || 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  )
}
