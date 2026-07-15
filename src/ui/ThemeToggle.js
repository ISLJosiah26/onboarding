import { useTheme } from '../hooks/useTheme'
import { T } from './theme'

// Sun/moon toggle. Reads the resolved theme (accounting for 'system') so the
// icon always reflects what's on screen.
export default function ThemeToggle({ compact = false }) {
  const { toggle } = useTheme()
  const isDark = typeof document !== 'undefined' && (
    document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  )

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="il-btn-ghost"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: compact ? '32px' : '30px', height: compact ? '32px' : '30px',
        borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
        background: 'transparent', color: T.muted, cursor: 'pointer',
        fontFamily: 'inherit', flexShrink: 0,
      }}
    >
      {isDark ? (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="8" cy="8" r="3.4" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M13.5 9.2A5.5 5.5 0 1 1 6.8 2.5a4.3 4.3 0 0 0 6.7 6.7z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
