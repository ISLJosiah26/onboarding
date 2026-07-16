import { T } from './theme'

// One place for every button in the app. Variants: primary (dark solid),
// secondary (outlined), ghost (borderless), danger (destructive). Sizes: sm|md.
// Renders a real <button> with focus rings from index.css and a busy state.
const VARIANTS = {
  primary: { background: T.btnPrimaryBg, color: '#fff', border: '1px solid transparent' },
  secondary: { background: T.surface, color: T.muted, border: `1px solid ${T.border}` },
  glass: { background: 'var(--glass-strong)', color: T.text, border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-highlight)' },
  ghost: { background: 'transparent', color: T.muted, border: '1px solid transparent' },
  danger: { background: T.danger, color: '#fff', border: '1px solid transparent' },
}

const SIZES = {
  sm: { padding: '6px 12px', fontSize: '12px', borderRadius: T.radiusSm },
  md: { padding: '10px 18px', fontSize: '13px', borderRadius: T.radiusMd },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  busy = false,
  busyLabel,
  disabled = false,
  fullWidth = false,
  className = '',
  style = {},
  children,
  ...rest
}) {
  const isDisabled = disabled || busy
  const v = VARIANTS[variant] || VARIANTS.primary
  const s = SIZES[size] || SIZES.md
  const ghostClass = variant === 'secondary' || variant === 'ghost' ? 'il-btn-ghost' : 'il-btn'

  return (
    <button
      className={`${ghostClass} ${className}`.trim()}
      disabled={isDisabled}
      aria-busy={busy || undefined}
      style={{
        ...v,
        ...s,
        fontWeight: 500,
        fontFamily: 'inherit',
        letterSpacing: '0.1px',
        cursor: isDisabled ? 'default' : 'pointer',
        opacity: isDisabled && !busy ? 0.55 : 1,
        width: fullWidth ? '100%' : undefined,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        ...style,
      }}
      {...rest}
    >
      {busy && <span className="il-spinner-sm" aria-hidden="true" />}
      {busy && busyLabel ? busyLabel : children}
    </button>
  )
}
