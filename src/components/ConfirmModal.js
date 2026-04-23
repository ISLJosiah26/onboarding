export default function ConfirmModal({ title, message, confirmLabel, confirmDanger, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, -apple-system, sans-serif'
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px',
        border: '1px solid #ebebe8',
        padding: '28px', width: '100%', maxWidth: '400px',
        margin: '0 24px'
      }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.3px', marginBottom: '8px' }}>
          {title}
        </div>
        <div style={{ fontSize: '13px', color: '#8a8a86', lineHeight: '1.6', marginBottom: '24px' }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', color: '#5f5f5c', border: '1px solid #ebebe8', borderRadius: '7px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ background: confirmDanger ? '#c74848' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}