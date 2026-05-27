/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { SkeletonLine, SkeletonTaskRow } from '../components/Skeleton'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import { handleSupabaseError } from '../utils/handleError'

const PHASES = ['Week 1', 'Week 2', '30 Day', '60 Day', '90 Day']

function isPhaseUpcoming(phase, hireDate) {
  if (phase === 'Week 1') return false
  const days = Math.floor((new Date() - new Date(hireDate)) / 86400000)
  const startDays = { 'Week 2': 7, '30 Day': 14, '60 Day': 30, '90 Day': 60 }
  return days < (startDays[phase] ?? 0)
}

export default function EmployeePortal({ session, userProfile }) {
  const [instance, setInstance] = useState(null)
  const [tasksByPhase, setTasksByPhase] = useState({})
  const [completions, setCompletions] = useState({})
  const [expandedTasks, setExpandedTasks] = useState({})
  const [documents, setDocuments] = useState([])
  const [docCompletions, setDocCompletions] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('checklist')
  const [celebration, setCelebration] = useState(null)
  const { toast, showToast, hideToast } = useToast()
  const [uploadingDocId, setUploadingDocId] = useState(null)
  const celebrationTimer = useRef(null)

  useEffect(() => {
    fetchMyOnboarding()
  }, [])

async function fetchMyOnboarding() {
  try {
    const { data: instanceData, error: instanceError } = await supabase
      .from('onboarding_instances')
      .select(`
        id, status,
        employees (id, full_name, hire_date, role_id, roles (name)),
        task_completions (
          id, completed, completed_at,
          onboarding_templates (id, task_name, phase, owner, parent_id)
        )
      `)
      .eq('employee_id', userProfile.employee_id)
      .eq('status', 'active')
      .single()

    if (instanceError && instanceError.code !== 'PGRST116') {
      showToast(handleSupabaseError(instanceError, 'Failed to load your onboarding.'), 'error')
    }

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

   const roleId = instanceData?.employees?.role_id
if (roleId) {
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .or(`role_id.is.null,role_id.eq.${roleId}`)
  if (docs) setDocuments(docs)
} else {
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .is('role_id', null)
  if (docs) setDocuments(docs)
}

    const { data: dc } = await supabase
      .from('document_completions')
      .select('*')
      .eq('employee_id', userProfile.employee_id)

    const map = {}
    if (dc) dc.forEach(d => map[d.document_id] = d)
    setDocCompletions(map)
  } catch (err) {
    showToast('Failed to load your onboarding. Please refresh.', 'error')
    console.error('Failed to load onboarding:', err)
  } finally {
    setLoading(false)
  }
}

async function toggleTask(completionId, current, e) {
  if (e && e.stopPropagation) e.stopPropagation()
  const newVal = !current
  const newCompletions = { ...completions, [completionId]: newVal }
  setCompletions(newCompletions)

  const { error } = await supabase
    .from('task_completions')
    .update({ completed: newVal, completed_at: newVal ? new Date().toISOString() : null })
    .eq('id', completionId)

  if (error) {
    setCompletions(prev => ({ ...prev, [completionId]: current }))
    showToast(handleSupabaseError(error, 'Failed to save. Please try again.'), 'error')
    return
  }

  if (newVal) {
    const allTasks = Object.values(tasksByPhase).flat()
    const parentTasks = allTasks.filter(tc => !tc.onboarding_templates.parent_id)
    const completedCount = parentTasks.filter(tc => {
      const subtasks = allTasks.filter(s => s.onboarding_templates.parent_id === tc.onboarding_templates.id)
      if (subtasks.length === 0) return newCompletions[tc.id]
      return subtasks.every(s => newCompletions[s.id])
    }).length

    if (completedCount === parentTasks.length) {
      setCelebration('all')
    } else {
      PHASES.forEach(phase => {
        const phaseTasks = allTasks.filter(tc => tc.onboarding_templates.phase === phase && !tc.onboarding_templates.parent_id)
        if (phaseTasks.length === 0) return
        const phaseComplete = phaseTasks.every(tc => {
          const subtasks = allTasks.filter(s => s.onboarding_templates.parent_id === tc.onboarding_templates.id)
          if (subtasks.length === 0) return newCompletions[tc.id]
          return subtasks.every(s => newCompletions[s.id])
        })
        if (phaseComplete) {
          const prevPhaseComplete = phaseTasks.every(tc => {
            const subtasks = allTasks.filter(s => s.onboarding_templates.parent_id === tc.onboarding_templates.id)
            if (subtasks.length === 0) return completions[tc.id]
            return subtasks.every(s => completions[s.id])
          })
          if (!prevPhaseComplete) setCelebration(phase)
        }
      })
    }
    clearTimeout(celebrationTimer.current)
    celebrationTimer.current = setTimeout(() => setCelebration(null), 3000)
  }
}

async function toggleDocument(docId) {
  const existing = docCompletions[docId]
  if (existing) {
    const newVal = !existing.signed
    setDocCompletions(prev => ({ ...prev, [docId]: { ...existing, signed: newVal } }))
    const { error } = await supabase
      .from('document_completions')
      .update({ signed: newVal, completed_at: newVal ? new Date().toISOString() : null })
      .eq('id', existing.id)
    if (error) {
      setDocCompletions(prev => ({ ...prev, [docId]: existing }))
      showToast(handleSupabaseError(error, 'Failed to save. Please try again.'), 'error')
    }
  } else {
    const { data, error } = await supabase
      .from('document_completions')
      .insert({ employee_id: userProfile.employee_id, document_id: docId, signed: true, received: true, completed_at: new Date().toISOString() })
      .select().single()
    if (error) {
      showToast(handleSupabaseError(error, 'Failed to save. Please try again.'), 'error')
    } else if (data) {
      setDocCompletions(prev => ({ ...prev, [docId]: data }))
    }
  }
}

async function handleEmployeeDocumentUpload(e, docId) {
  const file = e.target.files[0]
  if (!file) return
  setUploadingDocId(docId)

  const employeeId = userProfile.employee_id
  const filePath = `${employeeId}/${docId}_${Date.now()}_${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('employee-documents')
    .upload(filePath, file, { upsert: true })

  if (uploadError) {
    showToast('Upload failed. Please try again.', 'error')
    setUploadingDocId(null)
    return
  }

  const { data: urlData } = await supabase.storage
    .from('employee-documents')
    .createSignedUrl(filePath, 60 * 60 * 24 * 365)

  const fileUrl = urlData?.signedUrl

  const existing = docCompletions[docId]
  if (existing) {
    const { error } = await supabase
      .from('document_completions')
      .update({ completed_file_url: fileUrl, signed: true, completed_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) { showToast('Failed to save upload.', 'error'); setUploadingDocId(null); return }
    setDocCompletions(prev => ({ ...prev, [docId]: { ...existing, completed_file_url: fileUrl, signed: true } }))
  } else {
    const { data, error } = await supabase
      .from('document_completions')
      .insert({ employee_id: employeeId, document_id: docId, signed: true, received: true, completed_at: new Date().toISOString(), completed_file_url: fileUrl })
      .select().single()
    if (error) { showToast('Failed to save upload.', 'error'); setUploadingDocId(null); return }
    if (data) setDocCompletions(prev => ({ ...prev, [docId]: data }))
  }

   showToast('Document uploaded successfully')
   setUploadingDocId(null)
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
      <button style={styles.signout} onClick={() => supabase.auth.signOut()}>Sign out</button>
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
      <div style={{ padding: '80px 40px', textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
        <div style={{ fontSize: '22px', marginBottom: '16px' }}>👋</div>
        <div style={{ fontSize: '17px', fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.3px', marginBottom: '8px' }}>No active onboarding</div>
        <div style={{ fontSize: '13px', color: '#8a8a86', lineHeight: 1.7, marginBottom: '24px' }}>
          Your onboarding plan hasn't been set up yet.<br />Reach out to HR to get started.
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{ fontSize: '13px', color: '#5f5f5c', background: 'none', border: '1px solid #ebebe8', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Sign out
        </button>
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
        <div style={styles.sub}>{instance.employees.roles?.name} · Started {new Date(instance.employees.hire_date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
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
              const upcoming = isPhaseUpcoming(phase, instance.employees.hire_date)
              return (
                <div key={phase} style={{ opacity: upcoming ? 0.4 : 1, pointerEvents: upcoming ? 'none' : 'auto' }}>
                  <div style={{ ...styles.phaseLabel, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{phase}</span>
                    {upcoming && <span style={{ fontSize: '10px', color: '#a8a8a4', fontWeight: 500, background: '#f4f3f1', padding: '1px 6px', borderRadius: '3px', textTransform: 'none', letterSpacing: 0 }}>Upcoming</span>}
                  </div>
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
            {documents.filter(doc => !docCompletions[doc.id]?.hidden).length === 0 && (
              <div style={{ fontSize: '13px', color: '#a8a8a4', padding: '20px 0' }}>No documents have been assigned yet.</div>
            )}
            {documents.filter(doc => !docCompletions[doc.id]?.hidden).map(doc => {
              const dc = docCompletions[doc.id]
              const signed = dc?.signed || false
              const completedFileUrl = dc?.completed_file_url || null
              const isUploading = uploadingDocId === doc.id
              return (
                <div key={doc.id} style={{ padding: '16px 0', borderBottom: '1px solid #f0efeb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, fontSize: '14px', color: '#1a1a1a', fontWeight: 500 }}>{doc.name}</div>
                    <a href={doc.file_url} target="_blank" rel="noreferrer"
                      style={{ fontSize: '12px', color: '#8a8a86', textDecoration: 'underline', flexShrink: 0 }}>
                      View
                    </a>
                    {signed ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', color: '#2d7a4a', fontWeight: 500 }}>✓ Received</span>
                        <button onClick={() => toggleDocument(doc.id)} style={{ fontSize: '11px', color: '#a8a8a4', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Undo</button>
                      </div>
                    ) : (
                      <button onClick={() => toggleDocument(doc.id)} style={{ fontSize: '12px', color: '#5f5f5c', border: '1px solid #d4d3cf', borderRadius: '5px', padding: '4px 10px', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                        Mark as received
                      </button>
                    )}
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    {completedFileUrl ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '12px', color: '#2d7a4a' }}>✓ Uploaded</span>
                        <a href={completedFileUrl} target="_blank" rel="noreferrer"
                          style={{ fontSize: '12px', color: '#0070CA', textDecoration: 'none' }}>
                          View file
                        </a>
                        <label style={{ fontSize: '12px', color: isUploading ? '#a8a8a4' : '#8a8a86', cursor: isUploading ? 'default' : 'pointer' }}>
                          {isUploading ? 'Uploading...' : 'Replace'}
                          <input type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx"
                            onChange={e => handleEmployeeDocumentUpload(e, doc.id)} disabled={!!uploadingDocId} />
                        </label>
                      </div>
                    ) : (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: isUploading ? '#a8a8a4' : '#0070CA', cursor: isUploading ? 'default' : 'pointer', border: '1px solid ' + (isUploading ? '#ebebe8' : '#cce0f5'), borderRadius: '6px', padding: '6px 12px', background: isUploading ? '#f7f6f4' : '#f0f7ff' }}>
                        {!isUploading && (
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 10V4M4 7l3-3 3 3"/><path d="M2 12h10"/></svg>
                        )}
                        {isUploading ? 'Uploading...' : 'Upload completed document'}
                        <input type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx"
                          onChange={e => handleEmployeeDocumentUpload(e, doc.id)} disabled={!!uploadingDocId} />
                      </label>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {celebration && (
  <div style={{
    position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
    background: '#1a1a1a', color: '#fff', borderRadius: '12px',
    padding: '16px 24px', fontSize: '14px', fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: '10px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    animation: 'slideUp 0.3s ease',
    zIndex: 1000, fontFamily: 'Inter, -apple-system, sans-serif'
  }}>
    <span style={{ fontSize: '20px' }}>
      {celebration === 'all' ? '🎉' : '✓'}
    </span>
    <span>
      {celebration === 'all'
        ? 'Onboarding complete! Great work.'
        : `${celebration} complete!`}
    </span>
  </div>
)}
{toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  )
}