/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { SkeletonLine, SkeletonTaskRow } from '../components/Skeleton'

const PHASES = ['Week 1', 'Week 2', '30 Day', '60 Day', '90 Day']

export default function EmployeePortal({ session, userProfile }) {
  const [instance, setInstance] = useState(null)
  const [tasksByPhase, setTasksByPhase] = useState({})
  const [completions, setCompletions] = useState({})
  const [expandedTasks, setExpandedTasks] = useState({})
  const [documents, setDocuments] = useState([])
  const [docCompletions, setDocCompletions] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('checklist')

  useEffect(() => {
    fetchMyOnboarding()
  }, [])

async function fetchMyOnboarding() {

  const { data: instanceData, error: instanceError } = await supabase
    .from('onboarding_instances')
    .select(`
      id, status,
      employees (id, full_name, hire_date, roles (name)),
      task_completions (
        id, completed, completed_at,
        onboarding_templates (id, task_name, phase, owner, parent_id)
      )
    `)
    .eq('employee_id', userProfile.employee_id)
    .eq('status', 'active')
    .single()

  console.log('Instance data:', instanceData)
  console.log('Instance error:', instanceError)

  if (instanceData) {
    setInstance(instanceData)
    const byPhase = {}
    const comp = {}
    PHASES.forEach(p => byPhase[p] = [])
    instanceData.task_completions.forEach(tc => {
      const phase = tc.onboarding_templates.phase
      if (byPhase[phase]) byPhase[phase].push(tc)
      comp[tc.id] = tc.completed
    })
    setTasksByPhase(byPhase)
    setCompletions(comp)
  }

  const { data: docs, error: docsError } = await supabase.from('documents').select('*')
  console.log('Docs:', docs, docsError)
  if (docs) setDocuments(docs)

  const { data: dc } = await supabase
    .from('document_completions')
    .select('*')
    .eq('employee_id', userProfile.employee_id)

  const map = {}
  if (dc) dc.forEach(d => map[d.document_id] = d)
  setDocCompletions(map)

  setLoading(false)
}

  async function toggleTask(completionId, current, e) {
    e.stopPropagation()
    const newVal = !current
    setCompletions(prev => ({ ...prev, [completionId]: newVal }))
    await supabase
      .from('task_completions')
      .update({ completed: newVal, completed_at: newVal ? new Date().toISOString() : null })
      .eq('id', completionId)
  }

  async function toggleDocument(docId) {
    const existing = docCompletions[docId]
    if (existing) {
      const newVal = !existing.signed
      setDocCompletions(prev => ({ ...prev, [docId]: { ...existing, signed: newVal } }))
      await supabase
        .from('document_completions')
        .update({ signed: newVal, completed_at: newVal ? new Date().toISOString() : null })
        .eq('id', existing.id)
    } else {
      const { data } = await supabase
        .from('document_completions')
        .insert({ employee_id: userProfile.employee_id, document_id: docId, signed: true, received: true, completed_at: new Date().toISOString() })
        .select().single()
      if (data) setDocCompletions(prev => ({ ...prev, [docId]: data }))
    }
  }

  function totalTasks() {
    return Object.values(tasksByPhase).flat().filter(tc => !tc.onboarding_templates.parent_id).length
  }

  function completedTasksCount() {
    const allTasks = Object.values(tasksByPhase).flat()
    const parentTasks = allTasks.filter(tc => !tc.onboarding_templates.parent_id)
    return parentTasks.filter(tc => {
      const subtasks = allTasks.filter(s => s.onboarding_templates.parent_id === tc.onboarding_templates.id)
      if (subtasks.length === 0) return completions[tc.id]
      return subtasks.every(s => completions[s.id])
    }).length
  }

  function pct() {
    const t = totalTasks()
    return t > 0 ? Math.round((completedTasksCount() / t) * 100) : 0
  }

  const checkIcon = (size = 9) => (
    <svg width={size} height={size - 2} viewBox="0 0 10 8" fill="none">
      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  const styles = {
    app: { minHeight: '100vh', background: '#fafaf9', fontFamily: 'Inter, -apple-system, sans-serif', color: '#1a1a1a' },
    topbar: { background: '#fff', borderBottom: '1px solid #ebebe8', padding: '0 32px', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    logo: { fontSize: '14px', fontWeight: 600, color: '#0070CA', letterSpacing: '-0.2px' },
    signout: { fontSize: '12px', color: '#a8a8a4', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
    hero: { padding: '40px 40px 0', maxWidth: '720px', margin: '0 auto' },
    name: { fontSize: '24px', fontWeight: 600, letterSpacing: '-0.4px', marginBottom: '4px' },
    sub: { fontSize: '13px', color: '#8a8a86' },
    progressWrap: { marginTop: '20px', marginBottom: '32px' },
    progressRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
    progressTrack: { height: '6px', background: '#ebebe8', borderRadius: '3px', overflow: 'hidden' },
    progressFill: { height: '100%', background: '#0070CA', borderRadius: '3px', transition: 'width 0.3s ease' },
    tabs: { display: 'flex', gap: '0', borderBottom: '1px solid #ebebe8', padding: '0 40px', maxWidth: '720px', margin: '0 auto' },
    tab: (active) => ({ fontSize: '13px', fontWeight: active ? 500 : 400, color: active ? '#1a1a1a' : '#8a8a86', padding: '10px 0', marginRight: '24px', background: 'none', border: 'none', borderBottom: active ? '2px solid #1a1a1a' : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit' }),
    content: { padding: '28px 40px', maxWidth: '720px', margin: '0 auto' },
    phaseLabel: { fontSize: '11px', fontWeight: 600, color: '#a8a8a4', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px', marginTop: '24px' },
    parentRow: { display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 0', borderBottom: '1px solid #f0efeb', cursor: 'pointer' },
    subtaskRow: { display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 0 10px 32px', borderBottom: '1px solid #f7f6f3', cursor: 'pointer', background: '#f7f6f4' },
    checkbox: (checked) => ({ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: checked ? 'none' : '1.5px solid #d4d3cf', background: checked ? '#0070CA' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', cursor: 'pointer' }),
    subtaskCheckbox: (checked) => ({ width: '15px', height: '15px', borderRadius: '50%', flexShrink: 0, border: checked ? 'none' : '1.5px solid #d4d3cf', background: checked ? '#0070CA' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }),
    taskName: (checked) => ({ fontSize: '14px', color: checked ? '#a8a8a4' : '#1a1a1a', textDecoration: checked ? 'line-through' : 'none', flex: 1 }),
    subtaskName: (checked) => ({ fontSize: '13px', color: checked ? '#a8a8a4' : '#5f5f5c', textDecoration: checked ? 'line-through' : 'none', flex: 1 }),
    chevron: (open) => ({ fontSize: '10px', color: '#a8a8a4', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }),
    subtaskCount: { fontSize: '11px', color: '#a8a8a4' },
    docRow: { display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 0', borderBottom: '1px solid #f0efeb', cursor: 'pointer' },
  }

  if (loading) return (
    <div style={styles.app}>
      <div style={styles.topbar}>
        <div style={styles.logo}>Integrated Launch</div>
      </div>
      <div style={{ padding: '40px', maxWidth: '720px', margin: '0 auto' }}>
        <SkeletonLine width="200px" height="24px" style={{ marginBottom: '8px' }} />
        <SkeletonLine width="280px" height="13px" style={{ marginBottom: '24px' }} />
        <SkeletonLine width="100%" height="6px" style={{ marginBottom: '32px' }} />
        <SkeletonTaskRow />
        <SkeletonTaskRow />
        <SkeletonTaskRow />
      </div>
    </div>
  )

  if (!instance) return (
    <div style={styles.app}>
      <div style={styles.topbar}>
        <div style={styles.logo}>Integrated Launch</div>
        <button style={styles.signout} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
      <div style={{ padding: '80px 40px', textAlign: 'center', color: '#8a8a86', fontSize: '14px' }}>
        No active onboarding found. Please contact HR.
      </div>
    </div>
  )

  return (
    <div style={styles.app}>
      <div style={styles.topbar}>
        <div style={styles.logo}>Integrated Launch</div>
        <button style={styles.signout} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>

      <div style={styles.hero}>
        <div style={styles.name}>Welcome, {instance.employees.full_name.split(' ')[0]}</div>
        <div style={styles.sub}>{instance.employees.roles.name} · Started {new Date(instance.employees.hire_date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        <div style={styles.progressWrap}>
          <div style={styles.progressRow}>
            <span style={{ fontSize: '12px', color: '#8a8a86' }}>{completedTasksCount()} of {totalTasks()} tasks complete</span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#0070CA' }}>{pct()}%</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${pct()}%` }} />
          </div>
        </div>
      </div>

      <div style={styles.tabs}>
        <button style={styles.tab(activeTab === 'checklist')} onClick={() => setActiveTab('checklist')}>My checklist</button>
        <button style={styles.tab(activeTab === 'documents')} onClick={() => setActiveTab('documents')}>Documents</button>
      </div>

      <div style={styles.content}>
        {activeTab === 'checklist' && (
          <>
            {PHASES.map(phase => {
              const allTasks = tasksByPhase[phase] || []
              const parentTasks = allTasks.filter(tc => !tc.onboarding_templates.parent_id)
              if (parentTasks.length === 0) return null
              return (
                <div key={phase}>
                  <div style={styles.phaseLabel}>{phase}</div>
                  {parentTasks.map(tc => {
                    const subtasks = allTasks.filter(s => s.onboarding_templates.parent_id === tc.onboarding_templates.id)
                    const hasSubtasks = subtasks.length > 0
                    const isExpanded = expandedTasks[tc.id]
                    const subtasksComplete = hasSubtasks ? subtasks.every(s => completions[s.id]) : false
                    const isChecked = hasSubtasks ? subtasksComplete : completions[tc.id]
                    const completedSubs = subtasks.filter(s => completions[s.id]).length

                    return (
                      <div key={tc.id}>
                        <div style={styles.parentRow} onClick={() => hasSubtasks ? setExpandedTasks(prev => ({ ...prev, [tc.id]: !prev[tc.id] })) : toggleTask(tc.id, completions[tc.id], { stopPropagation: () => {} })}>
                          <div style={styles.checkbox(isChecked)} onClick={(e) => { e.stopPropagation(); if (!hasSubtasks) toggleTask(tc.id, completions[tc.id], e) }}>
                            {isChecked && checkIcon()}
                          </div>
                          <div style={styles.taskName(isChecked)}>{tc.onboarding_templates.task_name}</div>
                          {hasSubtasks && <span style={styles.subtaskCount}>{completedSubs}/{subtasks.length}</span>}
                          {hasSubtasks && <span style={styles.chevron(isExpanded)}>▶</span>}
                        </div>
{hasSubtasks && isExpanded && (
  <div>
    {PHASES.map(phase => {
      const phaseSubtasks = subtasks.filter(s => s.onboarding_templates.phase === phase)
      if (phaseSubtasks.length === 0) return null
      return (
        <div key={phase}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: '#c0bfbb', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '8px 0 6px 32px', background: '#f7f6f4' }}>
            {phase}
          </div>
          {phaseSubtasks.map(s => (
            <div key={s.id} style={styles.subtaskRow} onClick={(e) => toggleTask(s.id, completions[s.id], e)}>
              <div style={styles.subtaskCheckbox(completions[s.id])}>
                {completions[s.id] && checkIcon(7)}
              </div>
              <div style={styles.subtaskName(completions[s.id])}>{s.onboarding_templates.task_name}</div>
            </div>
          ))}
        </div>
      )
    })}
  </div>
)}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </>
        )}

        {activeTab === 'documents' && (
          <>
            {documents.length === 0 && (
              <div style={{ fontSize: '13px', color: '#a8a8a4', padding: '20px 0' }}>No documents have been uploaded yet.</div>
            )}
            {documents.map(doc => {
              const signed = docCompletions[doc.id]?.signed || false
              return (
                <div key={doc.id} style={styles.docRow} onClick={() => toggleDocument(doc.id)}>
                  <div style={styles.checkbox(signed)}>
                    {signed && checkIcon()}
                  </div>
                  <div style={styles.taskName(signed)}>{doc.name}</div>
                  <a href={doc.file_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '12px', color: '#0070CA', textDecoration: 'none' }}>View</a>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}