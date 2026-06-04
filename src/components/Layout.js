import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWindowSize } from '../hooks/useWindowSize'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'active', label: 'New onboarding', icon: 'people' },
]

const SETTINGS_ITEMS = [
  { id: 'history', label: 'History', icon: 'check' },
  { id: 'templates', label: 'Task templates', icon: 'lines' },
  { id: 'documents', label: 'My Documents', icon: 'doc' },
  { id: 'company-resources', label: 'Company Resources', icon: 'folder' },
  { id: 'roles', label: 'Roles', icon: 'circle' },
]

const EMPLOYEE_HUB_ITEMS = [
  { id: 'time-off', label: 'Time Off', icon: 'calendar' },
]

const SYSTEM_ITEMS = [
  { id: 'super-admin-users', label: 'Users', icon: 'shield' },
  { id: 'super-admin-audit', label: 'Audit log', icon: 'audit' },
  { id: 'super-admin-settings', label: 'System settings', icon: 'gear' },
]

const PRIMARY_PAGES = ['dashboard', 'active', 'new-onboarding-select', 'time-off']

function Icon({ type, size = 14 }) {
  const c = { width: size, height: size, viewBox: '0 0 14 14', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 }
  if (type === 'dashboard') return <svg {...c}><rect x="1" y="1" width="5" height="5"/><rect x="8" y="1" width="5" height="5"/><rect x="1" y="8" width="5" height="5"/><rect x="8" y="8" width="5" height="5"/></svg>
  if (type === 'people') return <svg {...c}><circle cx="7" cy="5" r="2.5"/><path d="M2 13c0-2.5 2.5-4.5 5-4.5s5 2 5 4.5"/></svg>
  if (type === 'check') return <svg {...c}><path d="M2 7l3 3 7-7"/></svg>
  if (type === 'lines') return <svg {...c}><path d="M2 3h10M2 7h10M2 11h10"/></svg>
  if (type === 'doc') return <svg {...c}><path d="M3 2h6l3 3v7H3z"/><path d="M9 2v3h3"/></svg>
  if (type === 'circle') return <svg {...c}><rect x="3" y="5" width="8" height="7" rx="1"/><path d="M5 5V3.5h4V5"/></svg>
  if (type === 'shield') return <svg {...c}><path d="M7 1L2 3.5v3.5c0 3 2.3 5.5 5 6.5 2.7-1 5-3.5 5-6.5V3.5L7 1z"/></svg>
  if (type === 'audit') return <svg {...c}><path d="M2 2h10v10H2z"/><path d="M4 5h6M4 7h4M4 9h5"/></svg>
  if (type === 'gear') return <svg {...c}><circle cx="7" cy="7" r="2"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.9 2.9l1.4 1.4M9.7 9.7l1.4 1.4M2.9 11.1l1.4-1.4M9.7 4.3l1.4-1.4"/></svg>
  if (type === 'calendar') return <svg {...c}><rect x="1" y="3" width="12" height="10" rx="1"/><path d="M1 6h12M4 1v4M10 1v4"/></svg>
  if (type === 'folder') return <svg {...c}><path d="M1 4a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1z"/></svg>
  if (type === 'person') return <svg {...c}><circle cx="7" cy="4.5" r="2.5"/><path d="M1.5 13c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/></svg>
  if (type === 'dots') return <svg width={size} height={size} viewBox="0 0 14 14" fill="currentColor"><circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11" cy="7" r="1.3"/></svg>
  return null
}

export default function Layout({ session, userProfile, currentPage, onNavigate, children }) {
  const { isMobile } = useWindowSize()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const email = session?.user?.email || ''
  const initials = email.substring(0, 2).toUpperCase()
  const isMoreActive = !PRIMARY_PAGES.includes(currentPage)

  // ── MOBILE LAYOUT ──
  if (isMobile) {
    const tab = (active) => ({
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '3px', height: '56px',
      background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      color: active ? '#0070CA' : '#8a8a86',
      fontSize: '10px', fontWeight: active ? 600 : 400,
      padding: '6px 4px 4px',
    })

    const drawerSection = {
      fontSize: '11px', color: '#a8a8a4', fontWeight: 500,
      padding: '12px 20px 4px', letterSpacing: '0.2px', textTransform: 'uppercase',
    }

    const drawerBtn = (active) => ({
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '13px 20px', width: '100%',
      background: active ? '#f4f3f1' : 'none',
      border: 'none', fontSize: '15px',
      fontWeight: active ? 500 : 400, color: '#1a1a1a',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    })

    return (
      <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'Inter, -apple-system, sans-serif', color: '#1a1a1a' }}>
        {/* Sticky top bar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: '#fff', borderBottom: '1px solid #ebebe8',
          height: '52px', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '10px',
        }}>
          <div style={{ width: '22px', height: '22px', background: '#0070CA', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}>IL</div>
          <div style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.2px' }}>Integrated Launch</div>
        </div>

        {/* Page content — bottom padding clears the tab bar */}
        <div style={{ paddingBottom: '64px' }}>{children}</div>

        {/* Fixed bottom tab bar */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #ebebe8',
          display: 'flex', zIndex: 40,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          <button style={tab(currentPage === 'dashboard')} onClick={() => { setDrawerOpen(false); onNavigate('dashboard') }}>
            <Icon type="dashboard" size={19} />
            <span>Dashboard</span>
          </button>
          <button style={tab(currentPage === 'active' || currentPage === 'new-onboarding-select')} onClick={() => { setDrawerOpen(false); onNavigate('active') }}>
            <Icon type="people" size={19} />
            <span>Onboarding</span>
          </button>
          {(userProfile?.role === 'admin' || userProfile?.role === 'super_admin') && (
            <button style={tab(currentPage === 'time-off')} onClick={() => { setDrawerOpen(false); onNavigate('time-off') }}>
              <Icon type="calendar" size={19} />
              <span>Time Off</span>
            </button>
          )}
          <button style={tab(isMoreActive || drawerOpen)} onClick={() => setDrawerOpen(o => !o)}>
            <Icon type="dots" size={19} />
            <span>More</span>
          </button>
        </div>

        {/* Slide-up drawer */}
        {drawerOpen && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.35)' }}
            onClick={() => setDrawerOpen(false)}
          >
            <div
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: '#fff', borderRadius: '16px 16px 0 0',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
                maxHeight: '80vh', overflowY: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ width: '36px', height: '4px', background: '#d4d3cf', borderRadius: '2px', margin: '12px auto 4px' }} />

              <div style={{ padding: '4px 0 8px' }}>
                <div style={drawerSection}>Settings</div>
                {SETTINGS_ITEMS.map(item => (
                  <button key={item.id} style={drawerBtn(currentPage === item.id)} onClick={() => { onNavigate(item.id); setDrawerOpen(false) }}>
                    <Icon type={item.icon} size={17} />
                    {item.label}
                  </button>
                ))}

                {(userProfile?.role === 'admin' || userProfile?.role === 'super_admin' || userProfile?.role === 'manager') && (
                  <>
                    <div style={drawerSection}>Employee Hub</div>
                    {(userProfile?.role === 'admin' || userProfile?.role === 'super_admin') && EMPLOYEE_HUB_ITEMS.map(item => (
                      <button key={item.id} style={drawerBtn(currentPage === item.id)} onClick={() => { onNavigate(item.id); setDrawerOpen(false) }}>
                        <Icon type={item.icon} size={17} />
                        {item.label}
                      </button>
                    ))}
                    {userProfile?.employee_id && (
                      <button style={drawerBtn(false)} onClick={() => { onNavigate('employee-hub'); setDrawerOpen(false) }}>
                        <Icon type="person" size={17} />
                        My portal
                      </button>
                    )}
                  </>
                )}

                {userProfile?.role === 'super_admin' && (
                  <>
                    <div style={drawerSection}>System</div>
                    {SYSTEM_ITEMS.map(item => (
                      <button key={item.id} style={drawerBtn(currentPage === item.id)} onClick={() => { onNavigate(item.id); setDrawerOpen(false) }}>
                        <Icon type={item.icon} size={17} />
                        {item.label}
                      </button>
                    ))}
                  </>
                )}
              </div>

              <div style={{ borderTop: '1px solid #ebebe8', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '7px', background: '#0070CA', color: '#fff', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>{email.split('@')[0]}</div>
                    <div style={{ fontSize: '11px', color: '#a8a8a4' }}>{email}</div>
                  </div>
                </div>
                <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: '1px solid #ebebe8', borderRadius: '7px', padding: '7px 14px', fontSize: '13px', color: '#5f5f5c', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── DESKTOP LAYOUT ──
  const styles = {
    app: {
      minHeight: '100vh', background: '#fafaf9',
      display: 'grid', gridTemplateColumns: '220px 1fr',
      fontFamily: 'Inter, -apple-system, sans-serif', color: '#1a1a1a'
    },
    sidebar: {
      background: '#fff', borderRight: '1px solid #ebebe8',
      padding: '20px 12px', display: 'flex', flexDirection: 'column',
      gap: '4px', position: 'sticky', top: 0, height: '100vh',
    },
    brand: { padding: '4px 12px 24px', display: 'flex', alignItems: 'center', gap: '8px' },
    brandMark: { width: '22px', height: '22px', background: '#0070CA', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 600 },
    brandText: { fontSize: '14px', fontWeight: 600, letterSpacing: '-0.2px' },
    navSection: { fontSize: '11px', color: '#a8a8a4', fontWeight: 500, padding: '12px 12px 4px', letterSpacing: '0.2px' },
    navItem: (active) => ({
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '7px 12px', borderRadius: '6px', fontSize: '13px',
      color: active ? '#1a1a1a' : '#5f5f5c',
      background: active ? '#eeeae4' : 'transparent',
      fontWeight: active ? 500 : 400,
      cursor: 'pointer', transition: 'all 0.1s',
      border: 'none', fontFamily: 'inherit', width: '100%', textAlign: 'left',
    }),
    sidebarBottom: { marginTop: 'auto', borderTop: '1px solid #ebebe8', paddingTop: '12px' },
    userChip: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '6px' },
    userAvatar: { width: '24px', height: '24px', borderRadius: '6px', background: '#0070CA', color: '#fff', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    userName: { fontSize: '13px', fontWeight: 500, color: '#1a1a1a' },
    main: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  }

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

        {(userProfile?.role === 'admin' || userProfile?.role === 'super_admin' || userProfile?.role === 'manager') && (
          <>
            <div style={styles.navSection}>Employee Hub</div>
            {(userProfile?.role === 'admin' || userProfile?.role === 'super_admin') && EMPLOYEE_HUB_ITEMS.map(item => (
              <button key={item.id} aria-current={currentPage === item.id ? 'page' : undefined} style={styles.navItem(currentPage === item.id)} onClick={() => onNavigate(item.id)}>
                <Icon type={item.icon} />
                {item.label}
              </button>
            ))}
            {userProfile?.employee_id && (
              <button style={styles.navItem(false)} onClick={() => onNavigate('employee-hub')}>
                <Icon type="person" />
                My portal
              </button>
            )}
          </>
        )}

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
              <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', color: '#a8a8a4', fontSize: '11px', display: 'block', textAlign: 'left' }}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.main}>{children}</div>
    </div>
  )
}
