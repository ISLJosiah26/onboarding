import Layout from '../components/Layout'
import { SkeletonLine, SkeletonTaskRow } from '../components/Skeleton'
import ConfirmModal from '../components/ConfirmModal'
import EditEmployeeModal from '../components/EditEmployeeModal'
import Toast from '../components/Toast'
import { useOnboardingPlan } from '../hooks/useOnboardingPlan'
import { PHASES } from '../config'

const STYLES = {
  header: { padding: '28px 40px 24px', borderBottom: '1px solid #e2e1dd' },
  backLink: { fontSize: '12px', color: '#70706b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' },
  title: { fontSize: '22px', fontWeight: 600, letterSpacing: '-0.4px' },
  sub: { fontSize: '13px', color: '#70706b', marginTop: '3px' },
  progressRow: { marginTop: '20px', display: 'flex', alignItems: 'center', gap: '16px' },
  progressTrack: { flex: 1, maxWidth: '320px', height: '6px', background: '#e2e1dd', borderRadius: '3px', overflow: 'hidden' },
  progressFill: { height: '100%', transition: 'width 0.3s ease' },
  progressText: { fontSize: '12px', color: '#70706b' },
  progressPct: { fontSize: '12px', fontWeight: 500 },
  content: { padding: '32px 40px', maxWidth: '780px' },
  sectionLabel: { fontSize: '11px', fontWeight: 600, color: '#a4a39f', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  uploadLink: { fontSize: '12px', color: '#0066cc', cursor: 'pointer', fontWeight: 500, textTransform: 'none', letterSpacing: 0 },
  parentRow: { display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0', borderBottom: '1px solid #f0efe9', cursor: 'pointer' },
  subtaskRow: { display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 0 10px 32px', borderBottom: '1px solid #f7f6f3', cursor: 'pointer', background: '#fafaf9' },
  checkbox: (checked) => ({ width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0, border: checked ? 'none' : '1.5px solid #e2e1dd', background: checked ? '#0066cc' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', cursor: 'pointer' }),
  subtaskCheckbox: (checked) => ({ width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0, border: checked ? 'none' : '1.5px solid #e2e1dd', background: checked ? '#0066cc' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', cursor: 'pointer' }),
  taskName: (checked) => ({ fontSize: '13px', color: checked ? '#a4a39f' : '#18181b', textDecoration: checked ? 'line-through' : 'none', flex: 1 }),
  subtaskName: (checked) => ({ fontSize: '12px', color: checked ? '#a4a39f' : '#70706b', textDecoration: checked ? 'line-through' : 'none', flex: 1 }),
  owner: { fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f4f3ef', color: '#70706b', fontWeight: 500 },
  chevron: (open) => ({ fontSize: '10px', color: '#a4a39f', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }),
  subtaskCount: { fontSize: '11px', color: '#a4a39f', flexShrink: 0 },
  expandedPanel: { background: '#fafaf9', border: '1px solid #e2e1dd', borderRadius: '8px', padding: '14px', marginTop: '2px', marginBottom: '4px' },
  noteLabel: { fontSize: '11px', color: '#70706b', marginBottom: '6px', fontWeight: 500 },
  noteInput: { width: '100%', border: '1px solid #e2e1dd', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#18181b', resize: 'vertical', minHeight: '60px', boxSizing: 'border-box' },
  noteHint: { fontSize: '11px', color: '#a4a39f', marginTop: '6px' },
  noteIndicator: { fontSize: '11px', color: '#0066cc', marginLeft: '4px' },
  section: { marginBottom: '36px' },
  footer: { borderTop: '1px solid #e2e1dd', padding: '24px 40px', display: 'flex', gap: '8px' },
  btnPrimary: { background: '#18181b', color: '#fff', border: 'none', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  btnSecondary: { background: 'transparent', color: '#70706b', border: '1px solid #e2e1dd', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
}

export default function OnboardingPlan({ session, userProfile, instanceId, onBack, onNavigate }) {
  const {
    instance, setInstance,
    tasksByPhase, completions, notes,
    expanded, setExpanded,
    expandedTasks, setExpandedTasks,
    documents, docCompletions,
    loading, uploading,
    modal, setModal,
    inviteSent, inviting,
    editingEmployee, setEditingEmployee,
    showHiddenDocs, setShowHiddenDocs,
    fetchError, noteSaveState,
    toast, hideToast,
    noteTimers,
    fetchPlan,
    toggleTask, saveNote, handleNoteChange,
    toggleDocument, hideDocument, restoreDocument, handleUploadDocument,
    handleMarkComplete, handleArchive, handleDeleteEmployee, handleInviteEmployee,
    totalTasks, completedTasksCount, pct,
  } = useOnboardingPlan({ instanceId, onBack })

  const checkIcon = (size = 9) => (
    <svg width={size} height={size - 2} viewBox="0 0 10 8" fill="none">
      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  if (loading) return (
    <Layout session={session} userProfile={userProfile} currentPage="dashboard" onNavigate={onNavigate}>
      <div style={{ padding: '28px 40px 24px', borderBottom: '1px solid #e2e1dd' }}>
        <SkeletonLine width="120px" height="12px" style={{ marginBottom: '16px' }} />
        <SkeletonLine width="220px" height="22px" style={{ marginBottom: '8px' }} />
        <SkeletonLine width="280px" height="13px" style={{ marginBottom: '20px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <SkeletonLine width="160px" height="12px" />
          <SkeletonLine width="240px" height="4px" />
          <SkeletonLine width="32px" height="12px" />
        </div>
      </div>
      <div style={{ padding: '32px 40px', maxWidth: '780px' }}>
        <SkeletonLine width="90px" height="11px" style={{ marginBottom: '14px' }} />
        <SkeletonTaskRow /><SkeletonTaskRow /><SkeletonTaskRow />
        <SkeletonLine width="100px" height="11px" style={{ margin: '28px 0 14px' }} />
        <SkeletonTaskRow /><SkeletonTaskRow />
        <SkeletonLine width="80px" height="11px" style={{ margin: '28px 0 14px' }} />
        <SkeletonTaskRow /><SkeletonTaskRow /><SkeletonTaskRow />
      </div>
    </Layout>
  )

  if (fetchError) return (
    <Layout session={session} userProfile={userProfile} currentPage="dashboard" onNavigate={onNavigate}>
      <div style={{ padding: '80px 40px', textAlign: 'center', fontFamily: 'Inter, -apple-system, sans-serif' }}>
        <div style={{ color: '#c04040', fontSize: '14px', marginBottom: '12px' }}>{fetchError}</div>
        <button onClick={fetchPlan} style={{ fontSize: '13px', color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          Try again
        </button>
      </div>
    </Layout>
  )

  const visibleDocs = documents.filter(doc => !docCompletions[doc.id]?.hidden)
  const hiddenDocs = documents.filter(doc => docCompletions[doc.id]?.hidden)

  return (
    <Layout session={session} userProfile={userProfile} currentPage="dashboard" onNavigate={onNavigate}>
      <div style={STYLES.header}>
        <button style={STYLES.backLink} onClick={onBack}>
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 2L4 7l5 5"/></svg>
          Back to dashboard
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={STYLES.title}>{instance.employees.full_name}</div>
          <button onClick={() => setEditingEmployee(true)} style={{ fontSize: '12px', color: '#70706b', background: 'none', border: '1px solid #e2e1dd', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
          <button onClick={handleDeleteEmployee} style={{ fontSize: '12px', color: '#c04040', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px' }}>Delete</button>
        </div>
        <div style={STYLES.sub}>
          {instance.employees.roles?.name} · Started {new Date(instance.employees.hire_date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <div style={STYLES.progressRow}>
          <span style={STYLES.progressText}>{completedTasksCount()} of {totalTasks()} tasks complete</span>
          <div style={STYLES.progressTrack}><div style={{ ...STYLES.progressFill, width: `${pct()}%`, background: pct() === 100 ? '#1a7a4a' : '#0066cc' }}></div></div>
          <span style={{ ...STYLES.progressPct, color: pct() === 100 ? '#1a7a4a' : '#0066cc' }}>{pct()}%</span>
        </div>
      </div>

      <div style={STYLES.content}>

        <div style={STYLES.section}>
          <div style={STYLES.sectionLabel}>
            <span>Documents</span>
            <label style={STYLES.uploadLink}>
              {uploading ? 'Uploading...' : '+ Upload document'}
              <input type="file" style={{ display: 'none' }} onChange={handleUploadDocument} accept=".pdf,.doc,.docx" />
            </label>
          </div>

          {visibleDocs.length === 0 && hiddenDocs.length === 0 && (
            <div style={{ fontSize: '13px', color: '#a4a39f', padding: '12px 0' }}>No documents in the library yet.</div>
          )}

          {visibleDocs.map(doc => {
            const dc = docCompletions[doc.id]
            const signed = dc?.signed || false
            const completedFileUrl = dc?.completed_file_url || null
            return (
              <div key={doc.id} style={{ borderBottom: '1px solid #f0efe9', paddingBottom: '12px', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0 4px' }} onClick={(e) => toggleDocument(doc.id, e)}>
                  <div style={STYLES.checkbox(signed)}>
                    {signed && checkIcon()}
                  </div>
                  <div style={STYLES.taskName(signed)}>{doc.name}</div>
                  <a href={doc.file_url} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: '12px', color: '#0066cc', textDecoration: 'none', flexShrink: 0 }}>
                    View
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); hideDocument(doc.id) }}
                    style={{ fontSize: '11px', color: '#a4a39f', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                    Hide
                  </button>
                </div>
                {completedFileUrl && (
                  <div style={{ paddingLeft: '32px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#1a7a4a' }}>✓ Employee uploaded</span>
                    <a href={completedFileUrl} target="_blank" rel="noreferrer"
                      style={{ fontSize: '12px', color: '#0066cc', textDecoration: 'none' }}>
                      Download
                    </a>
                  </div>
                )}
              </div>
            )
          })}

          {hiddenDocs.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={() => setShowHiddenDocs(prev => !prev)}
                style={{ fontSize: '12px', color: '#70706b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                {showHiddenDocs ? `Collapse (${hiddenDocs.length} shown)` : `Show hidden (${hiddenDocs.length})`}
              </button>
              {showHiddenDocs && hiddenDocs.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 0', borderBottom: '1px solid #f0efe9', opacity: 0.5 }}>
                  <div style={{ flex: 1, fontSize: '13px', color: '#70706b', textDecoration: 'line-through' }}>{doc.name}</div>
                  <button
                    onClick={() => restoreDocument(doc.id)}
                    style={{ fontSize: '12px', color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {PHASES.map(phase => {
          const allTasks = tasksByPhase[phase] || []
          const parentTasks = allTasks.filter(tc => !tc.onboarding_templates.parent_id)
          if (parentTasks.length === 0) return null
          const phaseComplete = parentTasks.every(tc => {
            const subtasks = allTasks.filter(s => s.onboarding_templates.parent_id === tc.onboarding_templates.id)
            if (subtasks.length === 0) return completions[tc.id]
            return subtasks.every(s => completions[s.id])
          })

          const completedInPhase = parentTasks.filter(tc => {
            const subtasks = allTasks.filter(s => s.onboarding_templates.parent_id === tc.onboarding_templates.id)
            if (subtasks.length === 0) return completions[tc.id]
            return subtasks.every(s => completions[s.id])
          }).length

          return (
            <div key={phase} style={STYLES.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: `1px solid ${phaseComplete ? '#c3e8d1' : '#f0efe9'}`, transition: 'border-color 0.25s ease' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: phaseComplete ? '#1a7a4a' : '#a4a39f', textTransform: 'uppercase', letterSpacing: '0.4px', transition: 'color 0.25s ease' }}>{phase}</span>
                <span style={{ fontSize: '11px', color: phaseComplete ? '#1a7a4a' : '#a4a39f', fontWeight: 400, transition: 'color 0.25s ease' }}>
                  {completedInPhase}/{parentTasks.length}{phaseComplete ? ' · Complete' : ''}
                </span>
              </div>

              {parentTasks.map(tc => {
                const subtasks = allTasks.filter(s => s.onboarding_templates.parent_id === tc.onboarding_templates.id)
                const hasSubtasks = subtasks.length > 0
                const isTaskExpanded = expandedTasks[tc.id]
                const subtasksComplete = hasSubtasks ? subtasks.every(s => completions[s.id]) : false
                const isChecked = hasSubtasks ? subtasksComplete : completions[tc.id]
                const completedSubtasks = subtasks.filter(s => completions[s.id]).length
                const hasNote = notes[tc.id] && notes[tc.id].trim().length > 0
                const isNoteExpanded = expanded === tc.id

                return (
                  <div key={tc.id}>
                    <div className="il-row" style={STYLES.parentRow} onClick={() => hasSubtasks ? setExpandedTasks(prev => ({ ...prev, [tc.id]: !prev[tc.id] })) : setExpanded(isNoteExpanded ? null : tc.id)}>
                      {hasSubtasks ? (
                        <div style={{ ...STYLES.checkbox(isChecked), cursor: 'default' }} onClick={e => e.stopPropagation()} title="Completion is driven by subtasks">
                          {isChecked && checkIcon()}
                        </div>
                      ) : (
                        <div style={STYLES.checkbox(isChecked)} onClick={(e) => toggleTask(tc.id, completions[tc.id], e)}>
                          {isChecked && checkIcon()}
                        </div>
                      )}
                      <div style={STYLES.taskName(isChecked)}>
                        {tc.onboarding_templates.task_name}
                        {!hasSubtasks && hasNote && !isNoteExpanded && (
                          <span style={STYLES.noteIndicator}>· note</span>
                        )}
                      </div>
                      {hasSubtasks && <span style={STYLES.subtaskCount}>{completedSubtasks}/{subtasks.length}</span>}
                      <div style={STYLES.owner}>{tc.onboarding_templates.owner}</div>
                      {hasSubtasks && <span style={STYLES.chevron(isTaskExpanded)}>▶</span>}
                    </div>

                    {hasSubtasks && isTaskExpanded && (
                      <div>
                        {PHASES.map(p => {
                          const phaseSubtasks = subtasks.filter(s => s.onboarding_templates.phase === p)
                          if (phaseSubtasks.length === 0) return null
                          return (
                            <div key={p}>
                              <div style={{ fontSize: '10px', fontWeight: 600, color: '#c0bfbb', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '8px 0 6px 32px', background: '#fafaf9' }}>
                                {p}
                              </div>
                              {phaseSubtasks.map(s => (
                                <div key={s.id} className="il-row" style={STYLES.subtaskRow} onClick={(e) => toggleTask(s.id, completions[s.id], e)}>
                                  <div className="il-checkbox" style={STYLES.subtaskCheckbox(completions[s.id])}>
                                    {completions[s.id] && checkIcon(7)}
                                  </div>
                                  <div style={STYLES.subtaskName(completions[s.id])}>{s.onboarding_templates.task_name}</div>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {!hasSubtasks && isNoteExpanded && (
                      <div style={STYLES.expandedPanel} onClick={e => e.stopPropagation()}>
                        <div style={STYLES.noteLabel}>Note</div>
                        <textarea
                          style={STYLES.noteInput}
                          value={notes[tc.id] || ''}
                          onChange={e => handleNoteChange(tc.id, e.target.value)}
                          onBlur={e => { clearTimeout(noteTimers.current[tc.id]); saveNote(tc.id, e.target.value) }}
                          placeholder="Add a note about this task..."
                        />
                        <div style={{ ...STYLES.noteHint, color: noteSaveState[tc.id] === 'saved' ? '#1a7a4a' : '#a4a39f' }}>
                          {noteSaveState[tc.id] === 'saving' ? 'Saving…' : noteSaveState[tc.id] === 'saved' ? '✓ Saved' : 'Saves automatically.'}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div style={STYLES.footer}>
        <button style={STYLES.btnPrimary} onClick={handleMarkComplete}>Mark as complete</button>
        <button style={STYLES.btnSecondary} onClick={handleArchive}>Archive</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {inviteSent ? (
            <span style={{ fontSize: '13px', color: '#1a7a4a' }}>Invite sent</span>
          ) : (
            <button onClick={handleInviteEmployee} disabled={inviting}
              style={{ background: 'transparent', color: '#0066cc', border: '1px solid #0066cc', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              {inviting ? 'Sending...' : 'Invite to portal'}
            </button>
          )}
        </div>
      </div>

      {modal && (
        <ConfirmModal
          title={modal.title}
          message={modal.message}
          confirmLabel={modal.confirmLabel}
          confirmDanger={modal.confirmDanger}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal(null)}
        />
      )}

      {editingEmployee && (
        <EditEmployeeModal
          employee={instance.employees}
          instanceId={instanceId}
          onClose={() => setEditingEmployee(false)}
          onSave={(updated) => {
            setInstance(prev => ({ ...prev, employees: { ...prev.employees, ...updated } }))
            setEditingEmployee(false)
            fetchPlan()
          }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </Layout>
  )
}