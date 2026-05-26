/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import { SkeletonRow } from '../components/Skeleton'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import { handleSupabaseError } from '../utils/handleError'

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
  const { toast, hideToast } = useToast()

  useEffect(() => {
    fetchOnboardings()
    fetchCompleted()
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

  async function fetchDocStats(onboardingData) {
    if (!onboardingData || onboardingData.length === 0) return
    const employeeIds = onboardingData.map(o => o.employees.id)
    const { data } = await supabase
      .from('document_completions')
      .select('employee_id, completed_file_url')
      .in('employee_id', employeeIds)
      .not('completed_file_url', 'is', null)

    const stats = {}
    if (data) {
      data.forEach(dc => {
        stats[dc.employee_id] = (stats[dc.employee_id] || 0) + 1
      })
    }
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

  const styles = {
    header: { padding: '28px 40px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #ebebe8' },
    title: { fontSize: '20px', fontWeight: 600, letterSpacing: '-0.4px' },
    sub: { fontSize: '13px', color: '#8a8a86', marginTop: '2px' },
    btn: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', padding: '8px 14px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#ebebe8', borderBottom: '1px solid #ebebe8' },
    stat: { background: '#fafaf9', padding: '20px 40px' },
    statLabel: { fontSize: '12px', color: '#8a8a86', marginBottom: '6px' },
    statValue: { fontSize: '22px', fontWeight: 600, letterSpacing: '-0.5px' },
    content: { padding: '0 40px', flex: 1 },
    tableHeader: { display: 'grid', gridTemplateColumns: '32px 2fr 1.5fr 1fr 1fr 100px', padding: '14px 0', borderBottom: '1px solid #ebebe8', fontSize: '11px', color: '#8a8a86', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', alignItems: 'center', gap: '16px' },
    tableRow: { display: 'grid', gridTemplateColumns: '32px 2fr 1.5fr 1fr 1fr 100px', padding: '14px 0', borderBottom: '1px solid #f0efeb', alignItems: 'center', gap: '16px', cursor: 'pointer' },
    avatar: { width: '26px', height: '26px', borderRadius: '50%', background: '#e8f0fe', color: '#0070CA', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    rowName: { fontSize: '13px', fontWeight: 500, color: '#1a1a1a' },
    rowMeta: { fontSize: '12px', color: '#8a8a86', marginTop: '1px' },
    rowText: { fontSize: '13px', color: '#1a1a1a' },
    rowTextMuted: { fontSize: '13px', color: '#8a8a86' },
    progressWrap: { display: 'flex', alignItems: 'center', gap: '10px' },
    progressTrack: { flex: 1, height: '4px', background: '#ebebe8', borderRadius: '2px', overflow: 'hidden' },
    progressFill: { height: '100%', background: '#0070CA' },
    progressText: { fontSize: '12px', fontWeight: 500, color: '#1a1a1a', minWidth: '32px' },
    phasePill: { fontSize: '11px', padding: '3px 9px', borderRadius: '4px', background: '#eef5ff', color: '#0070CA', fontWeight: 500, width: 'fit-content' },
    emptyState: { padding: '80px 40px', textAlign: 'center', color: '#8a8a86', fontSize: '14px' },
    errorState: { padding: '80px 40px', textAlign: 'center', fontSize: '14px' }
  }

  return (
    <Layout session={session} userProfile={userProfile} currentPage="dashboard" onNavigate={onNavigate}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Dashboard</div>
          <div style={styles.sub}>Overview of active employee onboardings.</div>
        </div>
        <button style={styles.btn} onClick={() => onNavigate('active')}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 2v10M2 7h10"/></svg>
          New onboarding
        </button>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Active</div>
          <div style={styles.statValue}>{onboardings.length}</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>90%+ complete</div>
          <div style={styles.statValue}>{completingThisWeek}</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Completed total</div>
          <div style={styles.statValue}>{completedCount}</div>
        </div>
      </div>

      <div style={styles.content}>
        {loading ? (
          <>
            <div style={styles.tableHeader}>
              <div></div><div>Employee</div><div>Role</div>
              <div>Progress</div><div>Phase</div>
              <div style={{ textAlign: 'right' }}>Started</div>
            </div>
            <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
          </>
        ) : fetchError ? (
          <div style={styles.errorState}>
            <div style={{ color: '#c74848', marginBottom: '12px' }}>{fetchError}</div>
            <button onClick={fetchOnboardings} style={{ fontSize: '13px', color: '#0070CA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              Try again
            </button>
          </div>
        ) : onboardings.length === 0 ? (
          <div style={styles.emptyState}>No active onboardings. Click "New onboarding" to start one.</div>
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
                <div key={o.id} style={styles.tableRow} onClick={() => onViewOnboarding(o.id)}>
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