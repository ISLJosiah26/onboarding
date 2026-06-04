/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { SkeletonLine, SkeletonTaskRow } from '../components/Skeleton'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import useToast from '../hooks/useToast'
import { handleSupabaseError } from '../utils/handleError'
import { getHrEmail } from '../utils/getHrEmail'
import { logAudit } from '../utils/auditLog'

const PHASES = ['Week 1', 'Week 2', '30 Day', '60 Day', '90 Day']
const CURRENT_YEAR = new Date().getFullYear()

const TYPE_OPTIONS = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'sick', label: 'Sick Day' },
  { value: 'personal', label: 'Personal' },
  { value: 'other', label: 'Other' },
]
const TYPE_LABELS = { vacation: 'Vacation', sick: 'Sick Day', personal: 'Personal', other: 'Other' }

const STATUS_STYLES = {
  pending:   { background: '#fffbf0', color: '#d4901a' },
  approved:  { background: '#f0faf4', color: '#2d7a4a' },
  denied:    { background: '#fdf0f0', color: '#c74848' },
  cancelled: { background: '#f4f3f1', color: '#8a8a86' },
}

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending
  return (
    <span style={{ ...s, fontSize: '11px', fontWeight: 500, padding: '2px 9px', borderRadius: '10px', display: 'inline-block' }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function TypeIcon({ type, size = 13 }) {
  const vb = '0 0 14 14'
  const st = { display: 'block', flexShrink: 0 }
  if (type === 'vacation') return (
    <svg width={size} height={size} viewBox={vb} fill="none" stroke="currentColor" strokeWidth={1.5} style={st}>
      <circle cx="7" cy="7" r="2.5"/>
      <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.05 3.05l1.41 1.41M9.54 9.54l1.41 1.41M3.05 10.95l1.41-1.41M9.54 4.46l1.41-1.41"/>
    </svg>
  )
  if (type === 'sick') return (
    <svg width={size} height={size} viewBox={vb} fill="none" stroke="currentColor" strokeWidth={1.5} style={st}>
      <circle cx="7" cy="7" r="5"/><path d="M7 4.5v5M4.5 7h5"/>
    </svg>
  )
  if (type === 'personal') return (
    <svg width={size} height={size} viewBox={vb} fill="none" stroke="currentColor" strokeWidth={1.5} style={st}>
      <circle cx="7" cy="5" r="2.5"/><path d="M2 13c0-2.5 2.5-4.5 5-4.5s5 2 5 4.5"/>
    </svg>
  )
  return (
    <svg width={size} height={size} viewBox={vb} fill="currentColor" style={st}>
      <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="11" cy="7" r="1.2"/>
    </svg>
  )
}

function fmtDateRange(start, end) {
  const s = new Date(start + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
  const e = new Date(end + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  return s === e.replace(/,.*/, '') ? e : `${s} – ${e}`
}

function isPhaseUpcoming(phase, hireDate) {
  if (phase === 'Week 1') return false
  const days = Math.floor((new Date() - new Date(hireDate)) / 86400000)
  const startDays = { 'Week 2': 7, '30 Day': 14, '60 Day': 30, '90 Day': 60 }
  return days < (startDays[phase] ?? 0)
}

export default function EmployeePortal({ session, userProfile, onSwitchToAdmin }) {
  const [instance, setInstance] = useState(null)
  const [tasksByPhase, setTasksByPhase] = useState({})
  const [completions, setCompletions] = useState({})
  const [expandedTasks, setExpandedTasks] = useState({})
  const [documents, setDocuments] = useState([])
  const [companyResources, setCompanyResources] = useState([])
  const [docCompletions, setDocCompletions] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('checklist')
  const [employee, setEmployee] = useState(null)
  const [celebration, setCelebration] = useState(null)
  const { toast, showToast, hideToast } = useToast()
  const [uploadingDocId, setUploadingDocId] = useState(null)
  const celebrationTimer = useRef(null)

  // Time off state
  const [timeOffBalance, setTimeOffBalance] = useState(null)
  const [timeOffRequests, setTimeOffRequests] = useState([])
  const [timeOffLoading, setTimeOffLoading] = useState(false)
  const [timeOffFetched, setTimeOffFetched] = useState(false)
  const [torStartDate, setTorStartDate] = useState('')
  const [torEndDate, setTorEndDate] = useState('')
  const [torType, setTorType] = useState('vacation')
  const [torNotes, setTorNotes] = useState('')
  const [torBusinessDays, setTorBusinessDays] = useState(null)
  const [torCalculating, setTorCalculating] = useState(false)
  const [torSubmitting, setTorSubmitting] = useState(false)
  const [torIsHalfDay, setTorIsHalfDay] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)
  const [confirmCancelReq, setConfirmCancelReq] = useState(null)

  useEffect(() => { fetchMyOnboarding() }, [])

  useEffect(() => {
    if (activeTab === 'time-off' && !timeOffFetched) fetchTimeOffData()
  }, [activeTab])

  async function fetchMyOnboarding() {
    try {
      // Always fetch the employee record so we have name/role in all cases
      const { data: empData } = await supabase
        .from('employees')
        .select('id, full_name, hire_date, brand, role_id, roles(name)')
        .eq('id', userProfile.employee_id)
        .single()
      if (empData) setEmployee(empData)

      const { data: instanceData, error: instanceError } = await supabase
        .from('onboarding_instances')
        .select(`
          id, status,
          employees (id, full_name, hire_date, role_id, manager_id, roles (name)),
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

        const roleId = instanceData.employees?.role_id
        if (roleId) {
          const { data: docs } = await supabase.from('documents').select('*').eq('is_company_resource', false).or(`role_id.is.null,role_id.eq.${roleId}`)
          if (docs) setDocuments(docs)
        } else {
          const { data: docs } = await supabase.from('documents').select('*').eq('is_company_resource', false).is('role_id', null)
          if (docs) setDocuments(docs)
        }

        const { data: dc } = await supabase.from('document_completions').select('*').eq('employee_id', userProfile.employee_id)
        const map = {}
        if (dc) dc.forEach(d => map[d.document_id] = d)
        setDocCompletions(map)
      }

      const { data: resources } = await supabase.from('documents').select('*').eq('is_company_resource', true).order('uploaded_at', { ascending: false })
      if (resources) setCompanyResources(resources)

      // Default tab: onboarding checklist if active, otherwise company resources
      setActiveTab(instanceData ? 'checklist' : 'company-resources')
    } catch (err) {
      showToast('Failed to load your portal. Please refresh.', 'error')
      console.error('Failed to load portal:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchTimeOffData() {
    setTimeOffLoading(true)
    const [{ data: bal }, { data: reqs, error: reqsErr }] = await Promise.all([
      supabase.from('time_off_balances').select('*').eq('employee_id', userProfile.employee_id).eq('year', CURRENT_YEAR).maybeSingle(),
      supabase.from('time_off_requests').select('*').eq('employee_id', userProfile.employee_id).order('created_at', { ascending: false }),
    ])
    setTimeOffBalance(bal || null)
    if (reqsErr) showToast(handleSupabaseError(reqsErr, 'Failed to load requests.'), 'error')
    setTimeOffRequests(reqs || [])
    setTimeOffFetched(true)
    setTimeOffLoading(false)
  }

  async function calculateBusinessDays(start, end) {
    if (!start || !end || end < start) { setTorBusinessDays(null); return }
    setTorCalculating(true)
    const { data, error } = await supabase.rpc('calculate_business_days', { p_start: start, p_end: end })
    if (error) { showToast(handleSupabaseError(error, 'Failed to calculate days.'), 'error'); setTorCalculating(false); return }
    setTorBusinessDays(data)
    setTorCalculating(false)
  }

  function toggleHalfDay() {
    const next = !torIsHalfDay
    setTorIsHalfDay(next)
    if (next) {
      if (torStartDate) setTorEndDate(torStartDate)
      setTorBusinessDays(0.5)
      setTorCalculating(false)
    } else {
      setTorBusinessDays(null)
      if (torStartDate && torEndDate) calculateBusinessDays(torStartDate, torEndDate)
    }
  }

  async function submitTimeOffRequest() {
    if (!torStartDate || !torEndDate) { showToast('Please select start and end dates.', 'error'); return }
    if (torEndDate < torStartDate) { showToast('End date must be on or after start date.', 'error'); return }

    const startDate = torStartDate
    const endDate = torEndDate
    const type = torType
    const notesVal = torNotes.trim()
    const isHalfDay = torIsHalfDay
    const businessDaysVal = isHalfDay ? 0.5 : torBusinessDays

    if (businessDaysVal === null || torCalculating) { showToast('Calculating business days, please wait.', 'error'); return }

    setTorSubmitting(true)

    // Optimistic add to list
    const tempId = `temp-${Date.now()}`
    setTimeOffRequests(prev => [{
      id: tempId,
      employee_id: userProfile.employee_id,
      start_date: startDate,
      end_date: endDate,
      business_days: businessDaysVal,
      type,
      notes: notesVal || null,
      status: 'pending',
      is_half_day: isHalfDay,
      created_at: new Date().toISOString(),
    }, ...prev])

    // Reset form immediately
    setTorStartDate('')
    setTorEndDate('')
    setTorType('vacation')
    setTorNotes('')
    setTorBusinessDays(null)
    setTorIsHalfDay(false)
    setTorSubmitting(false)

    const { data: newReq, error } = await supabase
      .from('time_off_requests')
      .insert({
        employee_id: userProfile.employee_id,
        start_date: startDate,
        end_date: endDate,
        business_days: businessDaysVal,
        type,
        notes: notesVal || null,
        status: 'pending',
        is_half_day: isHalfDay,
      })
      .select()
      .single()

    if (error) {
      setTimeOffRequests(prev => prev.filter(r => r.id !== tempId))
      showToast(handleSupabaseError(error, 'Failed to submit request.'), 'error')
      return
    }

    // Replace temp with real record
    setTimeOffRequests(prev => prev.map(r => r.id === tempId ? { ...newReq } : r))
    logAudit('time_off_requested', 'time_off_request', newReq.id, { type, days: businessDaysVal, start_date: startDate, end_date: endDate })

    // Send email to HR and manager (fire and forget)
    const employeeName = instance?.employees?.full_name || employee?.full_name || 'Employee'
    const total = timeOffBalance ? Number(timeOffBalance.total_days) : 0
    const used = timeOffBalance ? Number(timeOffBalance.used_days) : 0
    const currentPending = timeOffRequests.filter(r => r.status === 'pending' && r.id !== tempId).reduce((s, r) => s + Number(r.business_days), 0)
    const remainingAfter = total - used - currentPending - businessDaysVal

    const { data: overlapping } = await supabase
      .from('time_off_requests')
      .select('employee_id, start_date, end_date, employees!time_off_requests_employee_id_fkey(full_name)')
      .eq('status', 'approved')
      .neq('employee_id', userProfile.employee_id)
      .lte('start_date', endDate)
      .gte('end_date', startDate)

    const overlapList = (overlapping || [])
      .map(r => `${r.employees?.full_name}: ${fmtDateRange(r.start_date, r.end_date)}`)
      .join('<br/>')

    const emailBody = `
<p><strong>${employeeName}</strong> has submitted a time off request.</p>
<p>
  <strong>Dates:</strong> ${fmtDateRange(startDate, endDate)}<br/>
  <strong>Type:</strong> ${TYPE_LABELS[type]}<br/>
  <strong>Business days:</strong> ${businessDaysVal}${isHalfDay ? ' (half day)' : ''}<br/>
  <strong>Remaining balance if approved:</strong> ${remainingAfter}d${notesVal ? `<br/><strong>Notes:</strong> ${notesVal}` : ''}
</p>
${overlapList ? `<p><strong>Others approved off during this period:</strong><br/>${overlapList}</p>` : ''}
<p>Please review in the admin panel.</p>`

    const hrEmail = await getHrEmail()
    if (hrEmail) {
      supabase.functions.invoke('send-email', { body: { to: hrEmail, subject: `Time off request: ${employeeName}`, html: emailBody } })
    }

    const managerId = instance?.employees?.manager_id || employee?.manager_id
    if (managerId) {
      const { data: mgr } = await supabase.from('employees').select('email').eq('id', managerId).maybeSingle()
      if (mgr?.email) {
        supabase.functions.invoke('send-email', { body: { to: mgr.email, subject: `Time off request: ${employeeName}`, html: emailBody } })
      }
    }

    showToast('Request submitted.')
  }

  async function cancelTimeOffRequest(req) {
    setCancellingId(req.id)

    if (req.status === 'approved' && timeOffBalance) {
      const newUsed = Math.max(0, Number(timeOffBalance.used_days) - Number(req.business_days))
      const { error: balErr } = await supabase
        .from('time_off_balances')
        .update({ used_days: newUsed, updated_at: new Date().toISOString() })
        .eq('id', timeOffBalance.id)
      if (balErr) { showToast(handleSupabaseError(balErr, 'Failed to update balance.'), 'error'); setCancellingId(null); return }
    }

    const { error } = await supabase
      .from('time_off_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', req.id)

    if (error) { showToast(handleSupabaseError(error, 'Failed to cancel request.'), 'error'); setCancellingId(null); return }

    logAudit('time_off_cancelled', 'time_off_request', req.id, { type: req.type, days: req.business_days, previous_status: req.status })

    // Notify HR and manager (fire and forget)
    const employeeName = instance?.employees?.full_name || employee?.full_name || 'Employee'
    const cancelBody = `
<p><strong>${employeeName}</strong> has cancelled their time off request.</p>
<p>
  <strong>Dates:</strong> ${fmtDateRange(req.start_date, req.end_date)}<br/>
  <strong>Type:</strong> ${TYPE_LABELS[req.type]}<br/>
  <strong>Business days:</strong> ${req.business_days}<br/>
  <strong>Previous status:</strong> ${req.status}
</p>`

    const hrEmail = await getHrEmail()
    if (hrEmail) {
      supabase.functions.invoke('send-email', { body: { to: hrEmail, subject: `Time off cancelled: ${employeeName}`, html: cancelBody } })
    }

    const managerId = instance?.employees?.manager_id || employee?.manager_id
    if (managerId) {
      const { data: mgr } = await supabase.from('employees').select('email').eq('id', managerId).maybeSingle()
      if (mgr?.email) {
        supabase.functions.invoke('send-email', { body: { to: mgr.email, subject: `Time off cancelled: ${employeeName}`, html: cancelBody } })
      }
    }

    showToast('Request cancelled.')
    setCancellingId(null)
    setTimeOffFetched(false)
    await fetchTimeOffData()
  }

  function pendingDays() {
    return timeOffRequests.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.business_days), 0)
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
    balCard: { background: '#fff', border: '1px solid #ebebe8', borderRadius: '10px', padding: '20px', marginBottom: '24px' },
    balGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
    balStat: { textAlign: 'center' },
    balNum: (warn) => ({ fontSize: '24px', fontWeight: 600, color: warn ? '#c74848' : '#1a1a1a', letterSpacing: '-0.5px' }),
    balLabel: { fontSize: '11px', color: '#8a8a86', marginTop: '4px' },
    formCard: { background: '#fff', border: '1px solid #ebebe8', borderRadius: '10px', padding: '20px', marginBottom: '24px' },
    fieldLabel: { fontSize: '12px', color: '#8a8a86', marginBottom: '6px', display: 'block' },
    fieldInput: { width: '100%', background: '#fff', border: '1px solid #ebebe8', borderRadius: '7px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
    submitBtn: (disabled) => ({ background: disabled ? '#d4d3cf' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', padding: '10px 20px', fontSize: '13px', fontWeight: 500, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit' }),
    torRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 0', borderBottom: '1px solid #f0efeb', flexWrap: 'wrap' },
    cancelBtn: { fontSize: '12px', color: '#8a8a86', background: 'none', border: '1px solid #ebebe8', borderRadius: '5px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  }

  if (loading) return (
    <div style={styles.app}>
      <div style={styles.topbar}>
        <div style={styles.logo}>Integrated Launch</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onSwitchToAdmin && (
            <button onClick={onSwitchToAdmin} style={{ fontSize: '12px', color: '#0070CA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
              ← Admin view
            </button>
          )}
          <button style={styles.signout} onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
      <div style={{ padding: '40px', maxWidth: '720px', margin: '0 auto' }}>
        <SkeletonLine width="200px" height="24px" style={{ marginBottom: '8px' }} />
        <SkeletonLine width="280px" height="13px" style={{ marginBottom: '24px' }} />
        <SkeletonLine width="100%" height="6px" style={{ marginBottom: '32px' }} />
        <SkeletonTaskRow /><SkeletonTaskRow /><SkeletonTaskRow />
      </div>
    </div>
  )

  // Derive display values regardless of whether there is an active instance
  const displayName = instance?.employees?.full_name || employee?.full_name || ''
  const displayRole = instance?.employees?.roles?.name || employee?.roles?.name || ''
  const displayHireDate = instance?.employees?.hire_date || employee?.hire_date

  const torTotal = timeOffBalance ? Number(timeOffBalance.total_days) : 0
  const torUsed = timeOffBalance ? Number(timeOffBalance.used_days) : 0
  const torPending = pendingDays()
  const torRemaining = torTotal - torUsed - torPending
  const businessDaysPreview = torIsHalfDay ? 0.5 : torBusinessDays
  const torExceedsBalance = businessDaysPreview !== null && torRemaining - businessDaysPreview < 0
  const submitDisabled = torSubmitting || !torStartDate || !torEndDate || (!torIsHalfDay && (torBusinessDays === null || torCalculating))

  return (
    <div style={styles.app}>
      <div style={styles.topbar}>
        <div style={styles.logo}>Integrated Launch</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onSwitchToAdmin && (
            <button onClick={onSwitchToAdmin} style={{ fontSize: '12px', color: '#0070CA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
              ← Admin view
            </button>
          )}
          <button style={styles.signout} onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>

      <div style={styles.hero}>
        <div style={styles.name}>Welcome, {displayName.split(' ')[0]}</div>
        <div style={styles.sub}>
          {displayRole && `${displayRole} · `}
          {instance && displayHireDate
            ? `Started ${new Date(displayHireDate).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}`
            : (employee?.brand || userProfile?.brand || '')}
        </div>
        {instance && (
          <div style={styles.progressWrap}>
            <div style={styles.progressRow}>
              <span style={{ fontSize: '12px', color: '#8a8a86' }}>{completedTasksCount()} of {totalTasks()} tasks complete</span>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#0070CA' }}>{pct()}%</span>
            </div>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${pct()}%` }} />
            </div>
          </div>
        )}
      </div>

      <div style={styles.tabs}>
        {instance && <button style={styles.tab(activeTab === 'checklist')} onClick={() => setActiveTab('checklist')}>My checklist</button>}
        {instance && <button style={styles.tab(activeTab === 'documents')} onClick={() => setActiveTab('documents')}>My Documents</button>}
        <button style={styles.tab(activeTab === 'company-resources')} onClick={() => setActiveTab('company-resources')}>Company Resources</button>
        <button style={styles.tab(activeTab === 'time-off')} onClick={() => setActiveTab('time-off')}>Time Off</button>
      </div>

      <div style={styles.content}>
        {activeTab === 'checklist' && (
          <>
            {PHASES.map(phase => {
              const allTasks = tasksByPhase[phase] || []
              const parentTasks = allTasks.filter(tc => !tc.onboarding_templates.parent_id)
              if (parentTasks.length === 0) return null
              const upcoming = isPhaseUpcoming(phase, displayHireDate)
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
                            {PHASES.map(p => {
                              const phaseSubtasks = subtasks.filter(s => s.onboarding_templates.phase === p)
                              if (phaseSubtasks.length === 0) return null
                              return (
                                <div key={p}>
                                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#c0bfbb', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '8px 0 6px 32px', background: '#f7f6f4' }}>
                                    {p}
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
                    <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#8a8a86', textDecoration: 'underline', flexShrink: 0 }}>View</a>
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
                        <a href={completedFileUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0070CA', textDecoration: 'none' }}>View file</a>
                        <label style={{ fontSize: '12px', color: isUploading ? '#a8a8a4' : '#8a8a86', cursor: isUploading ? 'default' : 'pointer' }}>
                          {isUploading ? 'Uploading...' : 'Replace'}
                          <input type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx" onChange={e => handleEmployeeDocumentUpload(e, doc.id)} disabled={!!uploadingDocId} />
                        </label>
                      </div>
                    ) : (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: isUploading ? '#a8a8a4' : '#0070CA', cursor: isUploading ? 'default' : 'pointer', border: '1px solid ' + (isUploading ? '#ebebe8' : '#cce0f5'), borderRadius: '6px', padding: '6px 12px', background: isUploading ? '#f7f6f4' : '#f0f7ff' }}>
                        {!isUploading && <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 10V4M4 7l3-3 3 3"/><path d="M2 12h10"/></svg>}
                        {isUploading ? 'Uploading...' : 'Upload completed document'}
                        <input type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx" onChange={e => handleEmployeeDocumentUpload(e, doc.id)} disabled={!!uploadingDocId} />
                      </label>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {activeTab === 'company-resources' && (
          <>
            {companyResources.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#a8a8a4', padding: '20px 0' }}>No company resources have been added yet.</div>
            ) : (
              companyResources.map(doc => (
                <div key={doc.id} style={{ padding: '14px 0', borderBottom: '1px solid #f0efeb', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, fontSize: '14px', color: '#1a1a1a', fontWeight: 500 }}>{doc.name}</div>
                  <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0070CA', textDecoration: 'none', flexShrink: 0 }}>View</a>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'time-off' && (
          <>
            {timeOffLoading ? (
              <>
                <SkeletonLine width="100%" height="100px" style={{ marginBottom: '20px', borderRadius: '10px' }} />
                <SkeletonLine width="100%" height="160px" style={{ marginBottom: '20px', borderRadius: '10px' }} />
                <SkeletonTaskRow /><SkeletonTaskRow />
              </>
            ) : (
              <>
                {/* Balance card or empty state */}
                {!timeOffBalance && timeOffRequests.length === 0 ? (
                  <div style={{ ...styles.balCard, textAlign: 'center', padding: '28px 20px' }}>
                    <div style={{ fontSize: '13px', color: '#8a8a86', lineHeight: 1.6 }}>
                      Your entitlement hasn't been set yet — contact HR.
                    </div>
                  </div>
                ) : (
                  <div style={styles.balCard}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#a8a8a4', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                      {CURRENT_YEAR} Balance
                    </div>
                    <div style={styles.balGrid}>
                      <div style={styles.balStat}>
                        <div style={styles.balNum(false)}>{torTotal}</div>
                        <div style={styles.balLabel}>Total days</div>
                      </div>
                      <div style={styles.balStat}>
                        <div style={styles.balNum(false)}>{torUsed}</div>
                        <div style={styles.balLabel}>Used</div>
                      </div>
                      <div style={styles.balStat}>
                        <div style={{ ...styles.balNum(false), color: torPending > 0 ? '#d4901a' : '#1a1a1a' }}>{torPending}</div>
                        <div style={styles.balLabel}>Pending</div>
                      </div>
                      <div style={styles.balStat}>
                        <div style={styles.balNum(torRemaining < 0)}>{torRemaining}</div>
                        <div style={styles.balLabel}>Remaining</div>
                        {torRemaining < 0 && <div style={{ fontSize: '10px', color: '#c74848', marginTop: '2px' }}>Over limit</div>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Request form */}
                <div style={styles.formCard}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a', marginBottom: '16px' }}>Request time off</div>

                  {/* Date pickers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                    <div>
                      <label style={styles.fieldLabel}>Start date</label>
                      <input
                        type="date"
                        style={styles.fieldInput}
                        value={torStartDate}
                        onChange={e => {
                          setTorStartDate(e.target.value)
                          if (torIsHalfDay) {
                            setTorEndDate(e.target.value)
                          } else if (torEndDate) {
                            calculateBusinessDays(e.target.value, torEndDate)
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label style={styles.fieldLabel}>End date</label>
                      <input
                        type="date"
                        style={{ ...styles.fieldInput, background: torIsHalfDay ? '#f4f3f1' : '#fff', color: torIsHalfDay ? '#a8a8a4' : '#1a1a1a' }}
                        value={torEndDate}
                        min={torStartDate || undefined}
                        disabled={torIsHalfDay}
                        onChange={e => {
                          setTorEndDate(e.target.value)
                          if (torStartDate) calculateBusinessDays(torStartDate, e.target.value)
                        }}
                      />
                    </div>
                  </div>

                  {/* Half-day toggle */}
                  <div style={{ marginBottom: '16px' }}>
                    <button
                      onClick={toggleHalfDay}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        fontSize: '12px', color: torIsHalfDay ? '#0070CA' : '#8a8a86',
                        background: torIsHalfDay ? '#f0f7ff' : 'transparent',
                        border: `1px solid ${torIsHalfDay ? '#cce0f5' : '#ebebe8'}`,
                        borderRadius: '5px', padding: '5px 10px',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ width: '14px', height: '14px', borderRadius: '3px', border: `1.5px solid ${torIsHalfDay ? '#0070CA' : '#d4d3cf'}`, background: torIsHalfDay ? '#0070CA' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {torIsHalfDay && <svg width="8" height="6" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                      </span>
                      Half day
                    </button>
                  </div>

                  {/* Type selector */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={styles.fieldLabel}>Type</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {TYPE_OPTIONS.map(o => {
                        const active = torType === o.value
                        return (
                          <button
                            key={o.value}
                            onClick={() => setTorType(o.value)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              padding: '7px 13px',
                              border: `1.5px solid ${active ? '#1a1a1a' : '#ebebe8'}`,
                              borderRadius: '7px',
                              background: active ? '#1a1a1a' : '#fff',
                              color: active ? '#fff' : '#5f5f5c',
                              fontSize: '13px', fontWeight: active ? 500 : 400,
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            <TypeIcon type={o.value} size={13} />
                            {o.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Notes */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={styles.fieldLabel}>Notes (optional)</label>
                    <textarea
                      style={{ ...styles.fieldInput, resize: 'vertical', minHeight: '70px' }}
                      placeholder="Any additional context..."
                      value={torNotes}
                      onChange={e => setTorNotes(e.target.value)}
                    />
                  </div>

                  {/* Business days display */}
                  {torStartDate && torEndDate && (
                    <div style={{ marginBottom: '16px', fontSize: '13px', color: '#5f5f5c' }}>
                      {torIsHalfDay ? (
                        <span style={{ color: '#0070CA', fontWeight: 500 }}>½ day</span>
                      ) : torCalculating ? (
                        <span style={{ color: '#a8a8a4' }}>Calculating...</span>
                      ) : torBusinessDays !== null ? (
                        <span><strong>{torBusinessDays}</strong> business day{torBusinessDays !== 1 ? 's' : ''}</span>
                      ) : null}
                    </div>
                  )}

                  {torExceedsBalance && (
                    <div style={{ fontSize: '12px', color: '#d4901a', background: '#fffbf0', border: '1px solid #f5e4b0', borderRadius: '6px', padding: '10px 12px', marginBottom: '16px' }}>
                      This request exceeds your remaining balance by {Math.abs(torRemaining - businessDaysPreview)}d. It can still be submitted.
                    </div>
                  )}

                  <button style={styles.submitBtn(submitDisabled)} disabled={submitDisabled} onClick={submitTimeOffRequest}>
                    {torSubmitting ? 'Submitting...' : 'Submit request'}
                  </button>
                </div>

                {/* Request history */}
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a', marginBottom: '12px' }}>History</div>
                {timeOffRequests.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#a8a8a4', padding: '12px 0' }}>No requests yet.</div>
                ) : (
                  timeOffRequests.map(req => (
                    <div key={req.id} style={{ ...styles.torRow, opacity: req.id?.toString().startsWith('temp-') ? 0.6 : 1 }}>
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <TypeIcon type={req.type} size={12} />
                          <span style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>
                            {fmtDateRange(req.start_date, req.end_date)}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#8a8a86', marginTop: '2px' }}>
                          {TYPE_LABELS[req.type]} · {req.business_days}d{req.is_half_day ? ' (half day)' : ''}
                        </div>
                      </div>
                      <StatusPill status={req.status} />
                      {req.review_notes && (
                        <div style={{ fontSize: '11px', color: '#8a8a86', fontStyle: 'italic', flex: 1 }}>
                          {req.review_notes}
                        </div>
                      )}
                      {(req.status === 'pending' || req.status === 'approved') && !req.id?.toString().startsWith('temp-') && (
                        <button
                          style={styles.cancelBtn}
                          disabled={cancellingId === req.id}
                          onClick={() => req.status === 'approved' ? setConfirmCancelReq(req) : cancelTimeOffRequest(req)}
                        >
                          {cancellingId === req.id ? '...' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </>
            )}
          </>
        )}
      </div>

      {celebration && (
        <div style={{
          position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1a', color: '#fff', borderRadius: '12px',
          padding: '16px 24px', fontSize: '14px', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 1000,
          fontFamily: 'Inter, -apple-system, sans-serif'
        }}>
          <span style={{ fontSize: '20px' }}>{celebration === 'all' ? '🎉' : '✓'}</span>
          <span>{celebration === 'all' ? 'Onboarding complete! Great work.' : `${celebration} complete!`}</span>
        </div>
      )}

      {confirmCancelReq && (
        <ConfirmModal
          title="Cancel approved time off?"
          message={`This will remove ${confirmCancelReq.business_days} day(s) from your used balance. This can't be undone.`}
          confirmLabel="Yes, cancel it"
          confirmDanger
          onConfirm={async () => {
            await cancelTimeOffRequest(confirmCancelReq)
            setConfirmCancelReq(null)
          }}
          onCancel={() => setConfirmCancelReq(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
