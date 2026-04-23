/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import { SkeletonRow } from '../components/Skeleton'

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function getPhase(hireDate) {
  const days = Math.floor((new Date() - new Date(hireDate)) / (1000 * 60 * 60 * 24))
  if (days <= 7) return 'Week 1'
  if (days <= 14) return 'Week 2'
  if (days <= 30) return '30 Day'
  if (days <= 60) return '60 Day'
  return '90 Day'
}

export default function Dashboard({ session, onStartOnboarding, onViewOnboarding, onNavigate, refreshKey }) {
  const [onboardings, setOnboardings] = useState([])
  const [completedCount, setCompletedCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOnboardings()
    fetchCompleted()
  }, [refreshKey])

async function fetchOnboardings() {
  const { data } = await supabase
    .from('onboarding_instances')
    .select(`
      id, started_at, status,
      employees (id, full_name, email, hire_date, roles (name)),
      task_completions (id, completed)
    `)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
  if (data) setOnboardings(data)
  setLoading(false)
}

  async function fetchCompleted() {
    const { count } = await supabase
      .from('onboarding_instances')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
    setCompletedCount(count || 0)
  }

  const completingThisWeek = onboardings.filter(o => {
    const total = o.task_completions.length
    const done = o.task_completions.filter(t => t.completed).length
    return total > 0 && (done / total) >= 0.9
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
    emptyState: { padding: '80px 40px', textAlign: 'center', color: '#8a8a86', fontSize: '14px' }
  }

  return (
    <Layout session={session} currentPage="dashboard" onNavigate={onNavigate}>

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
          <div style={styles.statLabel}>Completing soon</div>
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
      <div></div>
      <div>Employee</div>
      <div>Role</div>
      <div>Progress</div>
      <div>Phase</div>
      <div style={{ textAlign: 'right' }}>Started</div>
    </div>
    <SkeletonRow />
    <SkeletonRow />
    <SkeletonRow />
    <SkeletonRow />
  </>
) : onboardings.length === 0 ? (
  <div style={styles.emptyState}>No active onboardings. Click "New onboarding" to start one.</div>
) : (
  <>
    <div style={styles.tableHeader}>
      <div></div>
      <div>Employee</div>
      <div>Role</div>
      <div>Progress</div>
      <div>Phase</div>
      <div style={{ textAlign: 'right' }}>Started</div>
    </div>
    {onboardings.map(o => {
      const total = o.task_completions.length
      const completed = o.task_completions.filter(t => t.completed).length
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0
      const name = o.employees.full_name
      const phase = getPhase(o.employees.hire_date)
      return (
        <div key={o.id} style={styles.tableRow} onClick={() => onViewOnboarding(o.id)}>
          <div style={styles.avatar}>{getInitials(name)}</div>
          <div>
            <div style={styles.rowName}>{name}</div>
            <div style={styles.rowMeta}>{o.employees.email || ''}</div>
          </div>
          <div style={styles.rowText}>{o.employees.roles.name}</div>
          <div style={styles.progressWrap}>
            <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${pct}%` }}></div></div>
            <div style={styles.progressText}>{pct}%</div>
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

    </Layout>
  )
}