import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWindowSize } from '../hooks/useWindowSize'
import { ROLE } from '../config'
import ThemeToggle from '../ui/ThemeToggle'

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
  const name = email.split('@')[0]
  const initials = name.substring(0, 2).toUpperCase()
  const isMoreActive = !PRIMARY_PAGES.includes(currentPage)

  // ── MOBILE LAYOUT ──
  if (isMobile) {
    const tab = (active) => ({
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '3px', height: '56px',
      background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      color: active ? 'var(--brand)' : 'var(--subtle)',
      fontSize: '10px', fontWeight: active ? 600 : 400,
      padding: '6px 4px 4px',
    })

    const drawerSection = {
      fontSize: '11px', color: 'var(--subtle)', fontWeight: 500,
      padding: '12px 20px 4px', letterSpacing: '0.3px', textTransform: 'uppercase',
    }

    const drawerBtn = (active) => ({
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '13px 20px', width: '100%',
      background: active ? 'var(--hover-bg)' : 'none',
      border: 'none', fontSize: '15px',
      fontWeight: active ? 500 : 400, color: 'var(--text)',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    })

    return (
      <div style={{ minHeight: '100vh', background: 'transparent', fontFamily: "'Inter', -apple-system, sans-serif", color: 'var(--text)' }}>
        <div className="il-header" data-topbar="true" style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: 'var(--surface)', boxShadow: '0 1px 0 var(--border)',
          height: '54px', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '10px',
        }}>
          <div style={{ width: '24px', height: '24px', background: 'linear-gradient(135deg, #004db3 0%, #0080ff 100%)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 700, flexShrink: 0, letterSpacing: '-0.2px' }}>IL</div>
          <div style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--text)' }}>Integrated Launch</div>
        </div>

        <div style={{ paddingBottom: '64px' }}>
          <div key={currentPage} className="il-page">{children}</div>
        </div>

        <div className="il-tabbar" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)', boxShadow: '0 -1px 0 var(--border)',
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
          {(userProfile?.role === ROLE.ADMIN || userProfile?.role === ROLE.SUPER_ADMIN) && (
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

        {drawerOpen && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.35)' }}
            onClick={() => setDrawerOpen(false)}
          >
            <div
              className="il-drawer"
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'var(--surface)', borderRadius: '16px 16px 0 0',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
                maxHeight: '80vh', overflowY: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ width: '36px', height: '4px', background: 'var(--border)', borderRadius: '2px', margin: '12px auto 4px' }} />
              <div style={{ padding: '4px 0 8px' }}>
                <div style={drawerSection}>Manage</div>
                {SETTINGS_ITEMS.map(item => (
                  <button key={item.id} style={drawerBtn(currentPage === item.id)} onClick={() => { onNavigate(item.id); setDrawerOpen(false) }}>
                    <Icon type={item.icon} size={17} />
                    {item.label}
                  </button>
                ))}
                {(userProfile?.role === ROLE.ADMIN || userProfile?.role === ROLE.SUPER_ADMIN || userProfile?.role === ROLE.MANAGER) && (
                  <>
                    <div style={drawerSection}>Employee Hub</div>
                    {(userProfile?.role === ROLE.ADMIN || userProfile?.role === ROLE.SUPER_ADMIN) && EMPLOYEE_HUB_ITEMS.map(item => (
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
                {userProfile?.role === ROLE.SUPER_ADMIN && (
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
              <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #1a1a2e 0%, #374151 100%)', color: '#fff', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.1px' }}>{name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--subtle)' }}>{email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ThemeToggle compact />
                  <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '7px', padding: '7px 14px', fontSize: '13px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── DESKTOP LAYOUT ──
  const navItem = (active) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '7px 12px',
    borderRadius: '7px', fontSize: '13px',
    color: active ? 'var(--brand)' : 'var(--muted)',
    background: active ? 'var(--brand-light)' : 'transparent',
    fontWeight: active ? 500 : 400,
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'inherit', width: '100%', textAlign: 'left',
    letterSpacing: '-0.1px',
  })

  return (
    <div style={{
      minHeight: '100vh', background: 'transparent',
      display: 'grid', gridTemplateColumns: '240px 1fr',
      fontFamily: "'Inter', -apple-system, sans-serif", color: 'var(--text)',
    }}>
      <div style={{
        background: 'var(--glass)', backdropFilter: 'var(--glass-filter)', WebkitBackdropFilter: 'var(--glass-filter)',
        borderRight: '1px solid var(--glass-border)',
        padding: '0 10px', display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        {/* Brand */}
        <div style={{ padding: '22px 12px 20px', display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{ width: '26px', height: '26px', background: 'linear-gradient(135deg, #004db3 0%, #0080ff 100%)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.2px', flexShrink: 0 }}>IL</div>
          <div style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--text)' }}>Integrated Launch</div>
        </div>

        {/* Primary nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '4px' }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} className={`il-nav-item${currentPage === item.id ? ' il-nav-active' : ''}`} aria-current={currentPage === item.id ? 'page' : undefined} style={navItem(currentPage === item.id)} onClick={() => onNavigate(item.id)}>
              <Icon type={item.icon} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Manage */}
        <div style={{ fontSize: '11px', color: 'var(--subtle)', fontWeight: 500, padding: '14px 12px 4px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Manage</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '4px' }}>
          {SETTINGS_ITEMS.map(item => (
            <button key={item.id} className={`il-nav-item${currentPage === item.id ? ' il-nav-active' : ''}`} aria-current={currentPage === item.id ? 'page' : undefined} style={navItem(currentPage === item.id)} onClick={() => onNavigate(item.id)}>
              <Icon type={item.icon} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Employee Hub */}
        {(userProfile?.role === ROLE.ADMIN || userProfile?.role === ROLE.SUPER_ADMIN || userProfile?.role === ROLE.MANAGER) && (
          <>
            <div style={{ fontSize: '11px', color: 'var(--subtle)', fontWeight: 500, padding: '14px 12px 4px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Employee Hub</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '4px' }}>
              {(userProfile?.role === ROLE.ADMIN || userProfile?.role === ROLE.SUPER_ADMIN) && EMPLOYEE_HUB_ITEMS.map(item => (
                <button key={item.id} className={`il-nav-item${currentPage === item.id ? ' il-nav-active' : ''}`} aria-current={currentPage === item.id ? 'page' : undefined} style={navItem(currentPage === item.id)} onClick={() => onNavigate(item.id)}>
                  <Icon type={item.icon} />
                  {item.label}
                </button>
              ))}
              {userProfile?.employee_id && (
                <button className="il-nav-item" style={navItem(false)} onClick={() => onNavigate('employee-hub')}>
                  <Icon type="person" />
                  My portal
                </button>
              )}
            </div>
          </>
        )}

        {/* System */}
        {userProfile?.role === ROLE.SUPER_ADMIN && (
          <>
            <div style={{ fontSize: '11px', color: 'var(--subtle)', fontWeight: 500, padding: '14px 12px 4px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>System</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '4px' }}>
              {SYSTEM_ITEMS.map(item => (
                <button key={item.id} className={`il-nav-item${currentPage === item.id ? ' il-nav-active' : ''}`} aria-current={currentPage === item.id ? 'page' : undefined} style={navItem(currentPage === item.id)} onClick={() => onNavigate(item.id)}>
                  <Icon type={item.icon} />
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* User / sign out */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', padding: '14px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #1a1a2e 0%, #374151 100%)', color: '#fff', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
              <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', color: 'var(--subtle)', fontSize: '11px', display: 'block', textAlign: 'left', letterSpacing: 0 }}>
                Sign out
              </button>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div key={currentPage} className="il-page" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}
