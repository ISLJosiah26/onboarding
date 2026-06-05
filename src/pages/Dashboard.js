/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import { SkeletonRow } from '../components/Skeleton'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import { handleSupabaseError } from '../utils/handleError'
import { useWindowSize } from '../hooks/useWindowSize'

const TODAY = new Date().toISOString().slice(0, 10)

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?'
}

function getPhase(hireDate) {
  const days = Math.floor((new Date() - new Date(hireDate)) / (1000 * 60 * 60 * 24))
  if (days <= 7) return 'Week 1'
  if (days <= 14) return 'Week 2'
  if (days <= 30) return '30 Day'
  if (days <= 60) return '60 Day'
  return '90 Day'
}

export default function Dashboard({ session, userProfile, onStartOnboarding, onViewOnboarding, onNavigate, refreshKey }) {
  const [onboardings, setOnboardings] = useState([])
  const [completedCount, setCompletedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [docStats, setDocStats] = useState({})
  const [offToday, setOffToday] = useState([])
  const { toast, hideToast } = useToast()
  const { isMobile } = useWindowSize()

  useEffect(() => {
    fetchOnboardings()
    fetchCompleted()
    fetchOffToday()
  }, [refreshKey])

  async function fetchOnboardings() {
    setLoading(true)
    setFetchError(null)
    const { data, error } = await supabase
      .from('onboarding_instances')
      .select(`
        id, started_at, status,
        employees (id, full_name, email, hire_date, roles (name)),
        task_completions (id, completed, onboarding_templates (id, parent_id))
      `)
      .eq('status', 'active')
      .order('started_at', { ascending: false })

    if (error) {
      setFetchError(handleSupabaseError(error, 'Failed to load onboardings.'))
    } else {
      setOnboardings(data || [])
      fetchDocStats(data || [])
    }
    setLoading(false)
  }

  async function fetchCompleted() {
    const { count, error } = await supabase
      .from('onboarding_instances')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
    if (!error) setCompletedCount(count || 0)
  }

  async function fetchOffToday() {
    const { data } = await supabase
      .from('time_off_requests')
      .select('employee_id, employees!time_off_requests_employee_id_fkey(full_name)')
      .eq('status', 'approved')
      .lte('start_date', TODAY)
      .gte('end_date', TODAY)
    setOffToday(data || [])
  }

  async function fetchDocStats(onboardingData) {
    if (!onboardingData || onboardingData.length === 0) return
    const employeeIds = onboardingData.map(o => o.employees.id)
    const { data } = await supabase
      .from('document_completions')
      .select('employee_id, completed_file_url')
      .in('employee_id', employeeIds)
      .not('completed_file_url', 'is', null)

    const stats = {}
    if (data) data.forEach(dc => { stats[dc.employee_id] = (stats[dc.employee_id] || 0) + 1 })
    setDocStats(stats)
  }

  function calcProgress(taskCompletions) {
    const parentTc = taskCompletions.filter(tc => !tc.onboarding_templates?.parent_id)
    const total = parentTc.length
    if (total === 0) return { total: 0, done: 0, pct: 0 }
    const done = parentTc.filter(tc => {
      const subtasks = taskCompletions.filter(s => s.onboarding_templates?.parent_id === tc.onboarding_templates?.id)
      if (subtasks.length === 0) return tc.completed
      return subtasks.every(s => s.completed)
    }).length
    return { total, done, pct: Math.round((done / total) * 100) }
  }

  const completingThisWeek = onboardings.filter(o => {
    const { total, pct } = calcProgress(o.task_completions)
    return total > 0 && pct >= 90
  }).length

  const p = isMobile ? '16px' : '40px'

  const styles = {
    header: { padding: isMobile ? '16px 16px 14px' : '28px 40px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e8e8e4', background: '#fff' },
    title: { fontSize: '20px', fontWeight: 600, letterSpacing: '-0.4px' },
    sub: { fontSize: '13px', color: '#8a8a86', marginTop: '2px' },
    btn: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', padding: '8px 14px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#e8e8e4', borderBottom: '1px solid #e8e8e4' },
    stat: { background: '#fff', padding: isMobile ? '14px 16px' : '20px 40px' },
    statLabel: { fontSize: '11px', color: '#8a8a86', marginBottom: '4px' },
    statValue: { fontSize: isMobile ? '20px' : '22px', fontWeight: 600, letterSpacing: '-0.5px' },
    content: { padding: isMobile ? '0' : `0 ${p}`, flex: 1 },
    tableHeader: { display: 'grid', gridTemplateColumns: '32px 2fr 1.5fr 1fr 1fr 100px', padding: '14px 0', borderBottom: '1px solid #ebebe8', fontSize: '11px', color: '#8a8a86', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', alignItems: 'center', gap: '16px' },
    tableRow: { display: 'grid', gridTemplateColumns: '32px 2fr 1.5fr 1fr 1fr 100px', padding: '14px 0', borderBottom: '1px solid #f0efeb', alignItems: 'center', gap: '16px', cursor: 'pointer', borderRadius: '4px' },
    avatar: { width: '26px', height: '26px', borderRadius: '50%', background: '#e8f0fe', color: '#0070CA', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    avatarLg: { width: '36px', height: '36px', borderRadius: '9px', background: '#e8f0fe', color: '#0070CA', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    rowName: { fontSize: '13px', fontWeight: 500, color: '#1a1a1a' },
    rowMeta: { fontSize: '12px', color: '#8a8a86', marginTop: '1px' },
    rowText: { fontSize: '13px', color: '#1a1a1a' },
    rowTextMuted: { fontSize: '13px', color: '#8a8a86' },
    progressWrap: { display: 'flex', alignItems: 'center', gap: '10px' },
    progressTrack: { flex: 1, height: '4px', background: '#ebebe8', borderRadius: '2px', overflow: 'hidden' },
    progressFill: { height: '100%', background: '#0070CA' },
    progressText: { fontSize: '12px', fontWeight: 500, color: '#1a1a1a', minWidth: '32px' },
    phasePill: { fontSize: '11px', padding: '2px 7px', borderRadius: '4px', background: '#eef5ff', color: '#0070CA', fontWeight: 500 },
    emptyState: { padding: isMobile ? '60px 16px' : '80px 40px', textAlign: 'center' },
    errorState: { padding: isMobile ? '60px 16px' : '80px 40px', textAlign: 'center', fontSize: '14px' }
  }

  return (
    <Layout session={session} userProfile={userProfile} currentPage="dashboard" onNavigate={onNavigate}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Dashboard</div>
          {!isMobile && <div style={styles.sub}>Overview of active employee onboardings.</div>}
        </div>
        <button style={styles.btn} onClick={() => onNavigate('active')}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 2v10M2 7h10"/></svg>
          {isMobile ? 'New' : 'New onboarding'}
        </button>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Active</div>
          <div style={styles.statValue}>{onboardings.length}</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>90%+ done</div>
          <div style={styles.statValue}>{completingThisWeek}</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Completed</div>
          <div style={styles.statValue}>{completedCount}</div>
        </div>
      </div>

      {offToday.length > 0 && (
        <div style={{ background: '#f0faf4', borderBottom: '1px solid #c3e8d1', padding: `10px ${p}`, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="#2d7a4a" strokeWidth="1.5" style={{ flexShrink: 0 }}>
            <rect x="1" y="3" width="12" height="10" rx="1"/><path d="M1 6h12M4 1v4M10 1v4"/>
          </svg>
          <span style={{ fontSize: '12px', color: '#2d7a4a', fontWeight: 500 }}>Off today:</span>
          <span style={{ fontSize: '12px', color: '#2d7a4a' }}>
            {offToday.map(r => r.employees?.full_name).filter(Boolean).join(', ')}
          </span>
        </div>
      )}

      <div style={styles.content}>
        {loading ? (
          isMobile ? (
            [1,2,3,4].map(i => (
              <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid #f0efeb', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ ...styles.avatarLg, background: '#f0efeb' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: '13px', background: '#f0efeb', borderRadius: '4px', width: '55%', marginBottom: '8px' }} />
                  <div style={{ height: '4px', background: '#f0efeb', borderRadius: '2px', width: '80%' }} />
                </div>
              </div>
            ))
          ) : (
            <>
              <div style={{ ...styles.tableHeader, padding: '14px 0' }}>
                <div></div><div>Employee</div><div>Role</div>
                <div>Progress</div><div>Phase</div>
                <div style={{ textAlign: 'right' }}>Started</div>
              </div>
              <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
            </>
          )
        ) : fetchError ? (
          <div style={styles.errorState}>
            <div style={{ color: '#c74848', marginBottom: '12px' }}>{fetchError}</div>
            <button onClick={fetchOnboardings} style={{ fontSize: '13px', color: '#0070CA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              Try again
            </button>
          </div>
        ) : onboardings.length === 0 ? (
          <div style={styles.emptyState}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ marginBottom: '14px', color: '#d4d3cf' }}>
              <circle cx="18" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 34c0-7.2 5.8-13 13-13s13 5.8 13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="27" cy="27" r="6" fill="#f7f6f3" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M24.5 27l1.5 1.5 3-3" stroke="#2d7a4a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.2px', marginBottom: '6px' }}>No active onboardings</div>
            <div style={{ fontSize: '13px', color: '#6b6b67', lineHeight: '1.6', marginBottom: '20px' }}>Start a new onboarding to get someone up to speed.</div>
            <button className="il-btn" onClick={() => onNavigate('active')} style={{ background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              New onboarding
            </button>
          </div>
        ) : isMobile ? (
          onboardings.map(o => {
            const { pct } = calcProgress(o.task_completions)
            const name = o.employees.full_name
            const phase = getPhase(o.employees.hire_date)
            return (
              <div key={o.id} style={{ padding: '14px 16px', borderBottom: '1px solid #f0efeb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }} onClick={() => onViewOnboarding(o.id)}>
                <div style={styles.avatarLg}>{getInitials(name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>{name}</span>
                    <span style={styles.phasePill}>{phase}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#8a8a86', marginBottom: '8px' }}>{o.employees.roles?.name || 'Unknown role'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={styles.progressTrack}>
                      <div style={{ ...styles.progressFill, width: `${pct}%`, background: pct === 100 ? '#2d7a4a' : '#0070CA' }} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: pct === 100 ? '#2d7a4a' : '#1a1a1a', flexShrink: 0 }}>{pct}%</span>
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#d4d3cf" strokeWidth="1.5" style={{ flexShrink: 0 }}><path d="M5 3l4 4-4 4"/></svg>
              </div>
            )
          })
        ) : (
          <>
            <div style={styles.tableHeader}>
              <div></div><div>Employee</div><div>Role</div>
              <div>Progress</div><div>Phase</div>
              <div style={{ textAlign: 'right' }}>Started</div>
            </div>
            {onboardings.map(o => {
              const { pct } = calcProgress(o.task_completions)
              const name = o.employees.full_name
              const phase = getPhase(o.employees.hire_date)
              const uploadedDocs = docStats[o.employees.id] || 0
              return (
                <div key={o.id} className="il-row" style={styles.tableRow} onClick={() => onViewOnboarding(o.id)}>
                  <div style={styles.avatar}>{getInitials(name)}</div>
                  <div>
                    <div style={styles.rowName}>{name}</div>
                    <div style={styles.rowMeta}>
                      {o.employees.email || ''}
                      {uploadedDocs > 0 && (
                        <span style={{ marginLeft: '8px', color: '#2d7a4a', fontSize: '11px' }}>
                          · {uploadedDocs} doc{uploadedDocs > 1 ? 's' : ''} uploaded
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={styles.rowText}>{o.employees.roles?.name || 'Unknown role'}</div>
                  <div style={styles.progressWrap}>
                    <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${pct}%`, background: pct === 100 ? '#2d7a4a' : '#0070CA' }}></div></div>
                    <div style={{ ...styles.progressText, color: pct === 100 ? '#2d7a4a' : '#1a1a1a' }}>{pct}%</div>
                  </div>
                  <div><span style={styles.phasePill}>{phase}</span></div>
                  <div style={{ ...styles.rowTextMuted, textAlign: 'right' }}>
                    {new Date(o.employees.hire_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </Layout>
  )
}
