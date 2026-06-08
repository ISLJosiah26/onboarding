import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import useToast from './useToast'
import { handleSupabaseError } from '../utils/handleError'
import { logAudit } from '../utils/auditLog'
import { getHrEmail } from '../utils/getHrEmail'
import { PHASES } from '../config'

export function useOnboardingPlan({ instanceId, onBack }) {
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
  const [noteSaveState, setNoteSaveState] = useState({})
  const { toast, showToast, hideToast } = useToast()
  const noteTimers = useRef({})
  const pendingNoteSaves = useRef({})

  const fetchPlan = useCallback(async () => {
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
  }, [instanceId])

  const fetchDocuments = useCallback(async () => {
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
  }, [instanceId])

  useEffect(() => {
    fetchPlan()
    fetchDocuments()
  }, [fetchPlan, fetchDocuments])

  useEffect(() => {
    const timers = noteTimers.current
    const pendingSaves = pendingNoteSaves.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
      Object.entries(pendingSaves).forEach(([id, value]) => {
        supabase.from('task_completions').update({ notes: value }).eq('id', id)
      })
    }
  }, [])

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
    pendingNoteSaves.current[completionId] = value
    clearTimeout(noteTimers.current[completionId])
    noteTimers.current[completionId] = setTimeout(() => {
      saveNote(completionId, value)
      delete pendingNoteSaves.current[completionId]
    }, 1000)
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
        if (hrEmail) await supabase.functions.invoke('send-email', {
          body: {
            to: hrEmail,
            subject: `Onboarding complete: ${instance.employees.full_name}`,
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #18181b;">
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
      showToast(data?.error || 'Failed to send invite. Please try again.', 'error')
    } else {
      if (data?.alreadyInvited) {
        showToast('This employee already has portal access.', 'success')
      } else {
        setInviteSent(true)
      }
    }
    setInviting(false)
  }

  return {
    instance, setInstance,
    tasksByPhase,
    completions,
    notes,
    expanded, setExpanded,
    expandedTasks, setExpandedTasks,
    documents,
    docCompletions,
    loading,
    uploading,
    modal, setModal,
    inviteSent,
    inviting,
    editingEmployee, setEditingEmployee,
    showHiddenDocs, setShowHiddenDocs,
    fetchError,
    noteSaveState,
    toast, hideToast,
    noteTimers,
    fetchPlan,
    toggleTask,
    saveNote,
    handleNoteChange,
    toggleDocument,
    hideDocument,
    restoreDocument,
    handleUploadDocument,
    handleMarkComplete,
    handleArchive,
    handleDeleteEmployee,
    handleInviteEmployee,
    totalTasks,
    completedTasksCount,
    pct,
  }
}
