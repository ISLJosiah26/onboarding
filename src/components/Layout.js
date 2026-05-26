import { supabase } from '../supabaseClient'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'active', label: 'New onboarding', icon: 'people' },
  { id: 'history', label: 'History', icon: 'check' },
]

const SETTINGS_ITEMS = [
  { id: 'templates', label: 'Task templates', icon: 'lines' },
  { id: 'documents', label: 'Documents', icon: 'doc' },
  { id: 'roles', label: 'Roles', icon: 'circle' },
]

const SYSTEM_ITEMS = [
  { id: 'super-admin-users', label: 'Users', icon: 'shield' },
  { id: 'super-admin-audit', label: 'Audit log', icon: 'audit' },
  { id: 'super-admin-settings', label: 'System settings', icon: 'gear' },
]

function Icon({ type }) {
  const common = { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 }
  if (type === 'dashboard') return <svg {...common}><rect x="1" y="1" width="5" height="5"/><rect x="8" y="1" width="5" height="5"/><rect x="1" y="8" width="5" height="5"/><rect x="8" y="8" width="5" height="5"/></svg>
  if (type === 'people') return <svg {...common}><circle cx="7" cy="5" r="2.5"/><path d="M2 13c0-2.5 2.5-4.5 5-4.5s5 2 5 4.5"/></svg>
  if (type === 'check') return <svg {...common}><path d="M2 7l3 3 7-7"/></svg>
  if (type === 'lines') return <svg {...common}><path d="M2 3h10M2 7h10M2 11h10"/></svg>
  if (type === 'doc') return <svg {...common}><path d="M3 2h6l3 3v7H3z"/><path d="M9 2v3h3"/></svg>
  if (type === 'circle') return <svg {...common}><rect x="3" y="5" width="8" height="7" rx="1"/><path d="M5 5V3.5h4V5"/></svg>
  if (type === 'shield') return <svg {...common}><path d="M7 1L2 3.5v3.5c0 3 2.3 5.5 5 6.5 2.7-1 5-3.5 5-6.5V3.5L7 1z"/></svg>
  if (type === 'audit') return <svg {...common}><path d="M2 2h10v10H2z"/><path d="M4 5h6M4 7h4M4 9h5"/></svg>
  if (type === 'gear') return <svg {...common}><circle cx="7" cy="7" r="2"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.9 2.9l1.4 1.4M9.7 9.7l1.4 1.4M2.9 11.1l1.4-1.4M9.7 4.3l1.4-1.4"/></svg>
  return null
}

export default function Layout({ session, userProfile, currentPage, onNavigate, children }) {
  const styles = {
    app: {
      minHeight: '100vh',
      background: '#fafaf9',
      display: 'grid',
      gridTemplateColumns: '220px 1fr',
      fontFamily: 'Inter, -apple-system, sans-serif',
      color: '#1a1a1a'
    },
    sidebar: {
      background: '#fff',
      borderRight: '1px solid #ebebe8',
      padding: '20px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      position: 'sticky',
      top: 0,
      height: '100vh'
    },
    brand: { padding: '4px 12px 24px', display: 'flex', alignItems: 'center', gap: '8px' },
    brandMark: { width: '22px', height: '22px', background: '#0070CA', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 600 },
    brandText: { fontSize: '14px', fontWeight: 600, letterSpacing: '-0.2px' },
    navSection: { fontSize: '11px', color: '#a8a8a4', fontWeight: 500, padding: '12px 12px 4px', letterSpacing: '0.2px' },
    navItem: (active) => ({
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '7px 12px', borderRadius: '6px',
      fontSize: '13px',
      color: active ? '#1a1a1a' : '#5f5f5c',
      background: active ? '#eeeae4' : 'transparent',
      fontWeight: active ? 500 : 400,
      cursor: 'pointer',
      transition: 'all 0.1s',
      border: 'none',
      fontFamily: 'inherit',
      width: '100%',
      textAlign: 'left'
    }),
    sidebarBottom: { marginTop: 'auto', borderTop: '1px solid #ebebe8', paddingTop: '12px' },
    userChip: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer' },
    userAvatar: { width: '24px', height: '24px', borderRadius: '6px', background: '#0070CA', color: '#fff', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    userName: { fontSize: '13px', fontWeight: 500, color: '#1a1a1a' },
    userEmail: { fontSize: '11px', color: '#a8a8a4' },
    main: { display: 'flex', flexDirection: 'column', minWidth: 0 }
  }

  const email = session?.user?.email || ''
  const initials = email.substring(0, 2).toUpperCase()

  return (
    <div style={styles.app}>
      <div style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandMark}>IL</div>
          <div style={styles.brandText}>Integrated Launch</div>
        </div>

        {NAV_ITEMS.map(item => (
          <button key={item.id} aria-current={currentPage === item.id ? 'page' : undefined} style={styles.navItem(currentPage === item.id)} onClick={() => onNavigate(item.id)}>
            <Icon type={item.icon} />
            {item.label}
          </button>
        ))}

        <div style={styles.navSection}>Settings</div>
        {SETTINGS_ITEMS.map(item => (
          <button key={item.id} aria-current={currentPage === item.id ? 'page' : undefined} style={styles.navItem(currentPage === item.id)} onClick={() => onNavigate(item.id)}>
            <Icon type={item.icon} />
            {item.label}
          </button>
        ))}

        {userProfile?.role === 'super_admin' && (
          <>
            <div style={styles.navSection}>System</div>
            {SYSTEM_ITEMS.map(item => (
              <button key={item.id} aria-current={currentPage === item.id ? 'page' : undefined} style={styles.navItem(currentPage === item.id)} onClick={() => onNavigate(item.id)}>
                <Icon type={item.icon} />
                {item.label}
              </button>
            ))}
          </>
        )}

        <div style={styles.sidebarBottom}>
          <div style={styles.userChip}>
            <div style={styles.userAvatar}>{initials}</div>
            <div>
              <div style={styles.userName}>{email.split('@')[0]}</div>
              <button
                onClick={() => supabase.auth.signOut()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', color: '#a8a8a4', fontSize: '11px', display: 'block', textAlign: 'left' }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.main}>
        {children}
      </div>
    </div>
  )
}