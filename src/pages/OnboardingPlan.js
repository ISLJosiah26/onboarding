/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import { SkeletonLine, SkeletonTaskRow } from '../components/Skeleton'
import ConfirmModal from '../components/ConfirmModal'
import EditEmployeeModal from '../components/EditEmployeeModal'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import { handleSupabaseError } from '../utils/handleError'
import { logAudit } from '../utils/auditLog'
import { getHrEmail } from '../utils/getHrEmail'

const PHASES = ['Week 1', 'Week 2', '30 Day', '60 Day', '90 Day']

export default function OnboardingPlan({ session, userProfile, instanceId, onBack, onNavigate }) {
  const [instance, setInstance] = useState(null)
  const [tasksByPhase, setTasksByPhase] = useState({})
  const [completions, setCompletions] = useState({})
  const [notes, setNotes] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [expandedTasks, setExpandedTasks] = useState({})
  const [documents, setDocuments] = useState([])
  const [docCompletions, setDocCompletions] = useState({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [modal, setModal] = useState(null)
  const [inviteSent, setInviteSent] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(false)
  const [showHiddenDocs, setShowHiddenDocs] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const { toast, showToast, hideToast } = useToast()
  const noteTimers = useRef({})
  const [noteSaveState, setNoteSaveState] = useState({})

  useEffect(() => {
    fetchPlan()
    fetchDocuments()
  }, [instanceId])

  async function fetchPlan() {
    setFetchError(null)
    const { data, error } = await supabase
      .from('onboarding_instances')
      .select(`
        id, status,
        employees (id, full_name, email, hire_date, role_id, roles (name)),
        task_completions (
          id, completed, completed_at, notes,
          onboarding_templates (id, task_name, phase, owner, parent_id)
        )
      `)
      .eq('id', instanceId)
      .single()

    if (error) {
      setFetchError(handleSupabaseError(error, 'Failed to load onboarding plan.'))
      setLoading(false)
      return
    }

    setInstance(data)
    const byPhase = {}
    const comp = {}
    const nts = {}
    PHASES.forEach(p => byPhase[p] = [])
    data.task_completions.forEach(tc => {
      const phase = tc.onboarding_templates.phase
      if (byPhase[phase]) byPhase[phase].push(tc)
      comp[tc.id] = tc.completed
      nts[tc.id] = tc.notes || ''
    })
    setTasksByPhase(byPhase)
    setCompletions(comp)
    setNotes(nts)
    setLoading(false)
  }

  async function fetchDocuments() {
    const { data: inst, error: instError } = await supabase
      .from('onboarding_instances')
      .select('employees (id, role_id)')
      .eq('id', instanceId)
      .single()

    if (instError || !inst) return

    const employeeId = inst.employees.id
    const roleId = inst.employees.role_id

    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .eq('is_company_resource', false)
      .or(`role_id.is.null,role_id.eq.${roleId}`)

    if (docs) setDocuments(docs)

    const { data: dc } = await supabase
      .from('document_completions')
      .select('*')
      .eq('employee_id', employeeId)

    const map = {}
    if (dc) dc.forEach(d => map[d.document_id] = d)
    setDocCompletions(map)
  }

  async function toggleTask(completionId, current, e) {
    e.stopPropagation()
    const newVal = !current
    setCompletions(prev => ({ ...prev, [completionId]: newVal }))
    const { error } = await supabase
      .from('task_completions')
      .update({ completed: newVal, completed_at: newVal ? new Date().toISOString() : null })
      .eq('id', completionId)
    if (error) {
      setCompletions(prev => ({ ...prev, [completionId]: current }))
      showToast(handleSupabaseError(error, 'Failed to save task. Please try again.'), 'error')
    }
  }

  async function saveNote(completionId, value) {
    setNoteSaveState(prev => ({ ...prev, [completionId]: 'saving' }))
    const { error } = await supabase
      .from('task_completions')
      .update({ notes: value })
      .eq('id', completionId)
    if (error) {
      showToast(handleSupabaseError(error, 'Failed to save note.'), 'error')
      setNoteSaveState(prev => ({ ...prev, [completionId]: null }))
    } else {
      setNoteSaveState(prev => ({ ...prev, [completionId]: 'saved' }))
      setTimeout(() => setNoteSaveState(prev => {
        const next = { ...prev }
        if (next[completionId] === 'saved') delete next[completionId]
        return next
      }), 2000)
    }
  }

  function handleNoteChange(completionId, value) {
    setNotes(prev => ({ ...prev, [completionId]: value }))
    clearTimeout(noteTimers.current[completionId])
    noteTimers.current[completionId] = setTimeout(() => saveNote(completionId, value), 1000)
  }

  async function toggleDocument(docId, e) {
    e.stopPropagation()
    const employeeId = instance.employees.id
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
        .insert({ employee_id: employeeId, document_id: docId, signed: true, received: true, completed_at: new Date().toISOString() })
        .select().single()
      if (data) setDocCompletions(prev => ({ ...prev, [docId]: data }))
    }
  }

  async function hideDocument(docId) {
    const docName = documents.find(d => d.id === docId)?.name || 'this document'
    setModal({
      title: 'Hide document',
      message: `"${docName}" will be hidden for this employee. You can restore it using "Show hidden."`,
      confirmLabel: 'Hide',
      confirmDanger: false,
      onConfirm: async () => {
        const employeeId = instance.employees.id
        const existing = docCompletions[docId]
        if (existing) {
          await supabase.from('document_completions').update({ hidden: true }).eq('id', existing.id)
          setDocCompletions(prev => ({ ...prev, [docId]: { ...existing, hidden: true } }))
        } else {
          const { data } = await supabase
            .from('document_completions')
            .insert({ employee_id: employeeId, document_id: docId, hidden: true, signed: false, received: false })
            .select().single()
          if (data) setDocCompletions(prev => ({ ...prev, [docId]: data }))
        }
        await logAudit('document_hidden', 'document', docId, { employee_name: instance.employees.full_name })
        setModal(null)
        showToast('Document hidden for this employee')
      }
    })
  }

  async function restoreDocument(docId) {
    const existing = docCompletions[docId]
    if (existing) {
      await supabase.from('document_completions').update({ hidden: false }).eq('id', existing.id)
      setDocCompletions(prev => ({ ...prev, [docId]: { ...existing, hidden: false } }))
      await logAudit('document_restored', 'document', docId, { employee_name: instance.employees.full_name })
      showToast('Document restored')
    }
  }

  async function handleUploadDocument(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const filePath = `documents/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file)
    if (uploadError) {
      showToast(handleSupabaseError(uploadError, 'Upload failed. Please try again.'), 'error')
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)
    const { error: insertError } = await supabase.from('documents').insert({ name: file.name, file_url: urlData.publicUrl })
    if (insertError) {
      showToast(handleSupabaseError(insertError, 'Failed to save document.'), 'error')
      await supabase.storage.from('documents').remove([filePath])
    } else {
      showToast('Document uploaded')
      await fetchDocuments()
    }
    setUploading(false)
  }

  async function handleMarkComplete() {
    setModal({
      title: 'Mark as complete',
      message: `This will mark ${instance.employees.full_name}'s onboarding as complete and remove it from the active list.`,
      confirmLabel: 'Mark complete',
      confirmDanger: false,
      onConfirm: async () => {
        await supabase.from('onboarding_instances').update({ status: 'completed' }).eq('id', instanceId)
        await logAudit('onboarding_completed', 'onboarding_instance', instanceId, { employee_name: instance.employees.full_name })
        const hrEmail = await getHrEmail()
        await supabase.functions.invoke('send-email', {
          body: {
            to: hrEmail,
            subject: `Onboarding complete: ${instance.employees.full_name}`,
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
                <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Onboarding marked complete</h2>
                <p style="font-size: 14px; color: #444; line-height: 1.6;"><strong>${instance.employees.full_name}</strong> has completed their onboarding plan.</p>
                <table style="font-size: 14px; color: #444; margin-top: 16px;">
                  <tr><td style="padding: 4px 16px 4px 0; color: #888;">Role</td><td>${instance.employees.roles?.name || 'N/A'}</td></tr>
                  <tr><td style="padding: 4px 16px 4px 0; color: #888;">Started</td><td>${new Date(instance.employees.hire_date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</td></tr>
                  <tr><td style="padding: 4px 16px 4px 0; color: #888;">Completed</td><td>${new Date().toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</td></tr>
                  <tr><td style="padding: 4px 16px 4px 0; color: #888;">Tasks completed</td><td>${completedTasksCount()} of ${totalTasks()}</td></tr>
                </table>
                <p style="font-size: 13px; color: #888; margin-top: 32px;">Sent by Integrated Launch</p>
              </div>
            `
          }
        })
        setModal(null)
        onBack()
      }
    })
  }

  async function handleArchive() {
    setModal({
      title: 'Archive onboarding',
      message: `This will archive ${instance.employees.full_name}'s onboarding and remove it from the active list. You can still view it in History.`,
      confirmLabel: 'Archive',
      confirmDanger: true,
      onConfirm: async () => {
        await supabase.from('onboarding_instances').update({ status: 'archived' }).eq('id', instanceId)
        await logAudit('onboarding_archived', 'onboarding_instance', instanceId, { employee_name: instance.employees.full_name })
        setModal(null)
        onBack()
      }
    })
  }

  async function handleDeleteEmployee() {
    setModal({
      title: 'Delete employee',
      message: `This will permanently delete ${instance.employees.full_name} and all their onboarding data including their portal access. This cannot be undone.`,
      confirmLabel: 'Delete permanently',
      confirmDanger: true,
      onConfirm: async () => {
        await logAudit('employee_deleted', 'employee', instance.employees.id, { employee_name: instance.employees.full_name })
        await supabase.functions.invoke('delete-user', { body: { employeeId: instance.employees.id } })
        await supabase.from('onboarding_instances').delete().eq('id', instanceId)
        await supabase.from('employees').delete().eq('id', instance.employees.id)
        setModal(null)
        onBack()
      }
    })
  }

  async function handleInviteEmployee() {
    if (!instance.employees.email) {
      showToast('This employee has no email address on file.', 'error')
      return
    }
    setInviting(true)
    const { data, error } = await supabase.functions.invoke('invite-employee', {
      body: { email: instance.employees.email, employeeId: instance.employees.id, brand: instance.employees.roles?.brand || 'ISL' }
    })
    if (error || data?.error) {
      showToast('Failed to send invite. Please try again.', 'error')
    } else {
      setInviteSent(true)
    }
    setInviting(false)
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
    header: { padding: '28px 40px 24px', borderBottom: '1px solid #ebebe8' },
    backLink: { fontSize: '12px', color: '#8a8a86', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' },
    title: { fontSize: '22px', fontWeight: 600, letterSpacing: '-0.4px' },
    sub: { fontSize: '13px', color: '#8a8a86', marginTop: '3px' },
    progressRow: { marginTop: '20px', display: 'flex', alignItems: 'center', gap: '16px' },
    progressTrack: { flex: 1, maxWidth: '320px', height: '6px', background: '#ebebe8', borderRadius: '3px', overflow: 'hidden' },
    progressFill: { height: '100%', transition: 'width 0.3s ease' },
    progressText: { fontSize: '12px', color: '#8a8a86' },
    progressPct: { fontSize: '12px', fontWeight: 500 },
    content: { padding: '32px 40px', maxWidth: '780px' },
    sectionLabel: { fontSize: '11px', fontWeight: 600, color: '#a8a8a4', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    uploadLink: { fontSize: '12px', color: '#0070CA', cursor: 'pointer', fontWeight: 500, textTransform: 'none', letterSpacing: 0 },
    taskRow: { display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0', borderBottom: '1px solid #f0efeb', cursor: 'pointer' },
    parentRow: { display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0', borderBottom: '1px solid #f0efeb', cursor: 'pointer' },
    subtaskRow: { display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 0 10px 32px', borderBottom: '1px solid #f7f6f3', cursor: 'pointer', background: '#fafaf9' },
    checkbox: (checked) => ({ width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0, border: checked ? 'none' : '1.5px solid #d4d3cf', background: checked ? '#0070CA' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', cursor: 'pointer' }),
    subtaskCheckbox: (checked) => ({ width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0, border: checked ? 'none' : '1.5px solid #d4d3cf', background: checked ? '#0070CA' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', cursor: 'pointer' }),
    taskName: (checked) => ({ fontSize: '13px', color: checked ? '#a8a8a4' : '#1a1a1a', textDecoration: checked ? 'line-through' : 'none', flex: 1 }),
    subtaskName: (checked) => ({ fontSize: '12px', color: checked ? '#a8a8a4' : '#5f5f5c', textDecoration: checked ? 'line-through' : 'none', flex: 1 }),
    owner: { fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f4f3f1', color: '#8a8a86', fontWeight: 500 },
    chevron: (open) => ({ fontSize: '10px', color: '#a8a8a4', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }),
    subtaskCount: { fontSize: '11px', color: '#a8a8a4', flexShrink: 0 },
    expandedPanel: { background: '#fafaf9', border: '1px solid #ebebe8', borderRadius: '8px', padding: '14px', marginTop: '2px', marginBottom: '4px' },
    noteLabel: { fontSize: '11px', color: '#8a8a86', marginBottom: '6px', fontWeight: 500 },
    noteInput: { width: '100%', border: '1px solid #ebebe8', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#1a1a1a', resize: 'vertical', minHeight: '60px', boxSizing: 'border-box' },
    noteHint: { fontSize: '11px', color: '#a8a8a4', marginTop: '6px' },
    noteIndicator: { fontSize: '11px', color: '#0070CA', marginLeft: '4px' },
    section: { marginBottom: '36px' },
    footer: { borderTop: '1px solid #ebebe8', padding: '24px 40px', display: 'flex', gap: '8px' },
    btnPrimary: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    btnSecondary: { background: 'transparent', color: '#5f5f5c', border: '1px solid #ebebe8', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
  }

  if (loading) return (
    <Layout session={session} userProfile={userProfile} currentPage="dashboard" onNavigate={onNavigate}>
      <div style={{ padding: '28px 40px 24px', borderBottom: '1px solid #ebebe8' }}>
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
        <div style={{ color: '#c74848', fontSize: '14px', marginBottom: '12px' }}>{fetchError}</div>
        <button onClick={fetchPlan} style={{ fontSize: '13px', color: '#0070CA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          Try again
        </button>
      </div>
    </Layout>
  )

  const visibleDocs = documents.filter(doc => !docCompletions[doc.id]?.hidden)
  const hiddenDocs = documents.filter(doc => docCompletions[doc.id]?.hidden)

  return (
    <Layout session={session} userProfile={userProfile} currentPage="dashboard" onNavigate={onNavigate}>
      <div style={styles.header}>
        <button style={styles.backLink} onClick={onBack}>
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 2L4 7l5 5"/></svg>
          Back to dashboard
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={styles.title}>{instance.employees.full_name}</div>
          <button onClick={() => setEditingEmployee(true)} style={{ fontSize: '12px', color: '#5f5f5c', background: 'none', border: '1px solid #d4d3cf', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
          <button onClick={handleDeleteEmployee} style={{ fontSize: '12px', color: '#c74848', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px' }}>Delete</button>
        </div>
        <div style={styles.sub}>
          {instance.employees.roles?.name} · Started {new Date(instance.employees.hire_date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <div style={styles.progressRow}>
          <span style={styles.progressText}>{completedTasksCount()} of {totalTasks()} tasks complete</span>
          <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${pct()}%`, background: pct() === 100 ? '#2d7a4a' : '#0070CA' }}></div></div>
          <span style={{ ...styles.progressPct, color: pct() === 100 ? '#2d7a4a' : '#0070CA' }}>{pct()}%</span>
        </div>
      </div>

      <div style={styles.content}>

        <div style={styles.section}>
          <div style={styles.sectionLabel}>
            <span>Documents</span>
            <label style={styles.uploadLink}>
              {uploading ? 'Uploading...' : '+ Upload document'}
              <input type="file" style={{ display: 'none' }} onChange={handleUploadDocument} accept=".pdf,.doc,.docx" />
            </label>
          </div>

          {visibleDocs.length === 0 && hiddenDocs.length === 0 && (
            <div style={{ fontSize: '13px', color: '#a8a8a4', padding: '12px 0' }}>No documents in the library yet.</div>
          )}

          {visibleDocs.map(doc => {
            const dc = docCompletions[doc.id]
            const signed = dc?.signed || false
            const completedFileUrl = dc?.completed_file_url || null
            return (
              <div key={doc.id} style={{ borderBottom: '1px solid #f0efeb', paddingBottom: '12px', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0 4px' }} onClick={(e) => toggleDocument(doc.id, e)}>
                  <div style={styles.checkbox(signed)}>
                    {signed && checkIcon()}
                  </div>
                  <div style={styles.taskName(signed)}>{doc.name}</div>
                  <a href={doc.file_url} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: '12px', color: '#0070CA', textDecoration: 'none', flexShrink: 0 }}>
                    View
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); hideDocument(doc.id) }}
                    style={{ fontSize: '11px', color: '#a8a8a4', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                    Hide
                  </button>
                </div>
                {completedFileUrl && (
                  <div style={{ paddingLeft: '32px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#2d7a4a' }}>✓ Employee uploaded</span>
                    <a href={completedFileUrl} target="_blank" rel="noreferrer"
                      style={{ fontSize: '12px', color: '#0070CA', textDecoration: 'none' }}>
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
                style={{ fontSize: '12px', color: '#8a8a86', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                {showHiddenDocs ? `Collapse (${hiddenDocs.length} shown)` : `Show hidden (${hiddenDocs.length})`}
              </button>
              {showHiddenDocs && hiddenDocs.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 0', borderBottom: '1px solid #f0efeb', opacity: 0.5 }}>
                  <div style={{ flex: 1, fontSize: '13px', color: '#8a8a86', textDecoration: 'line-through' }}>{doc.name}</div>
                  <button
                    onClick={() => restoreDocument(doc.id)}
                    style={{ fontSize: '12px', color: '#0070CA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
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
            <div key={phase} style={styles.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: `1px solid ${phaseComplete ? '#c3e8d1' : '#f0efeb'}`, transition: 'border-color 0.25s ease' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: phaseComplete ? '#2d7a4a' : '#a0a09c', textTransform: 'uppercase', letterSpacing: '0.4px', transition: 'color 0.25s ease' }}>{phase}</span>
                <span style={{ fontSize: '11px', color: phaseComplete ? '#2d7a4a' : '#a0a09c', fontWeight: 400, transition: 'color 0.25s ease' }}>
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
                    <div className="il-row" style={styles.parentRow} onClick={() => hasSubtasks ? setExpandedTasks(prev => ({ ...prev, [tc.id]: !prev[tc.id] })) : setExpanded(isNoteExpanded ? null : tc.id)}>
                      {hasSubtasks ? (
                        <div style={{ ...styles.checkbox(isChecked), cursor: 'default' }} onClick={e => e.stopPropagation()} title="Completion is driven by subtasks">
                          {isChecked && checkIcon()}
                        </div>
                      ) : (
                        <div style={styles.checkbox(isChecked)} onClick={(e) => toggleTask(tc.id, completions[tc.id], e)}>
                          {isChecked && checkIcon()}
                        </div>
                      )}
                      <div style={styles.taskName(isChecked)}>
                        {tc.onboarding_templates.task_name}
                        {!hasSubtasks && hasNote && !isNoteExpanded && (
                          <span style={styles.noteIndicator}>· note</span>
                        )}
                      </div>
                      {hasSubtasks && <span style={styles.subtaskCount}>{completedSubtasks}/{subtasks.length}</span>}
                      <div style={styles.owner}>{tc.onboarding_templates.owner}</div>
                      {hasSubtasks && <span style={styles.chevron(isTaskExpanded)}>▶</span>}
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
                                <div key={s.id} className="il-row" style={styles.subtaskRow} onClick={(e) => toggleTask(s.id, completions[s.id], e)}>
                                  <div className="il-checkbox" style={styles.subtaskCheckbox(completions[s.id])}>
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

                    {!hasSubtasks && isNoteExpanded && (
                      <div style={styles.expandedPanel} onClick={e => e.stopPropagation()}>
                        <div style={styles.noteLabel}>Note</div>
                        <textarea
                          style={styles.noteInput}
                          value={notes[tc.id] || ''}
                          onChange={e => handleNoteChange(tc.id, e.target.value)}
                          onBlur={e => { clearTimeout(noteTimers.current[tc.id]); saveNote(tc.id, e.target.value) }}
                          placeholder="Add a note about this task..."
                        />
                        <div style={{ ...styles.noteHint, color: noteSaveState[tc.id] === 'saved' ? '#2d7a4a' : '#a8a8a4' }}>
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

      <div style={styles.footer}>
        <button style={styles.btnPrimary} onClick={handleMarkComplete}>Mark as complete</button>
        <button style={styles.btnSecondary} onClick={handleArchive}>Archive</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {inviteSent ? (
            <span style={{ fontSize: '13px', color: '#2d7a4a' }}>Invite sent</span>
          ) : (
            <button onClick={handleInviteEmployee} disabled={inviting}
              style={{ background: 'transparent', color: '#0070CA', border: '1px solid #0070CA', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
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