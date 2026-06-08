/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { SkeletonLine, SkeletonTaskRow } from '../components/Skeleton'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import useToast from '../hooks/useToast'
import { handleSupabaseError } from '../utils/handleError'
import { getHrEmail, getTechSupportEmail } from '../utils/getHrEmail'
import { logAudit } from '../utils/auditLog'
import { useWindowSize } from '../hooks/useWindowSize'

const PHASES = ['Week 1', 'Week 2', '30 Day', '60 Day', '90 Day']
const CURRENT_YEAR = new Date().getFullYear()

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?'
}

const TYPE_OPTIONS = [
  { value: 'personal_vacation', label: 'Personal / Vacation' },
  { value: 'professional_development', label: 'Professional Development Training' },
  { value: 'volunteer', label: 'Volunteer Day' },
  { value: 'work_from_wherever', label: 'Work from Wherever Week' },
  { value: 'bereavement', label: 'Bereavement Leave' },
  { value: 'care_day', label: 'Care Day' },
  { value: 'other', label: 'Other' },
]
const TYPE_LABELS = {
  personal_vacation: 'Personal / Vacation',
  professional_development: 'Professional Development Training',
  volunteer: 'Volunteer Day',
  work_from_wherever: 'Work from Wherever Week',
  bereavement: 'Bereavement Leave',
  care_day: 'Care Day',
  other: 'Other',
  vacation: 'Vacation',
  sick: 'Sick Day',
  personal: 'Personal',
}

const FLEXIBILITY_OPTIONS = [
  { value: 'firm', label: 'Firm' },
  { value: 'moderately_adjustable', label: 'Moderately Adjustable' },
  { value: 'flexible', label: 'Flexible' },
  { value: 'other', label: 'Other' },
]

const TICKET_CATEGORIES = [
  { value: 'software', label: 'Software' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'access_login', label: 'Access / Login' },
  { value: 'network', label: 'Network / Connectivity' },
  { value: 'other', label: 'Other' },
]

const STATUS_STYLES = {
  pending:   { background: '#fffbf0', color: '#d4901a' },
  approved:  { background: '#f0faf4', color: '#1a7a4a' },
  denied:    { background: '#fdf0f0', color: '#c04040' },
  cancelled: { background: '#f4f3ef', color: '#70706b' },
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
  return start === end ? e : `${s} – ${e}`
}

function isPhaseUpcoming(phase, hireDate) {
  if (phase === 'Week 1') return false
  const days = Math.floor((new Date() - new Date(hireDate)) / 86400000)
  const startDays = { 'Week 2': 7, '30 Day': 30, '60 Day': 60, '90 Day': 90 }
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
  const { isMobile } = useWindowSize()
  const [uploadingDocId, setUploadingDocId] = useState(null)
  const celebrationTimer = useRef(null)

  // Time off state
  const [timeOffBalance, setTimeOffBalance] = useState(null)
  const [timeOffRequests, setTimeOffRequests] = useState([])
  const [timeOffLoading, setTimeOffLoading] = useState(false)
  const [timeOffFetched, setTimeOffFetched] = useState(false)
  const [torStartDate, setTorStartDate] = useState('')
  const [torEndDate, setTorEndDate] = useState('')
  const [torType, setTorType] = useState('personal_vacation')
  const [torNotes, setTorNotes] = useState('')
  const [torBusinessDays, setTorBusinessDays] = useState(null)
  const [torCalculating, setTorCalculating] = useState(false)
  const [torSubmitting, setTorSubmitting] = useState(false)
  const [torDayPortion, setTorDayPortion] = useState('full')
  const [torVolunteeringWith, setTorVolunteeringWith] = useState('')
  const [torFlexibility, setTorFlexibility] = useState('')
  const [torFlexibilityNote, setTorFlexibilityNote] = useState('')
  const [cancellingId, setCancellingId] = useState(null)
  const [confirmCancelReq, setConfirmCancelReq] = useState(null)

  // Company resources search
  const [resourceSearch, setResourceSearch] = useState('')

  // Tech tickets state
  const [ticketCategory, setTicketCategory] = useState('software')
  const [ticketTitle, setTicketTitle] = useState('')
  const [ticketDescription, setTicketDescription] = useState('')
  const [ticketSubmitting, setTicketSubmitting] = useState(false)
  const [submittedTickets, setSubmittedTickets] = useState([])

  useEffect(() => { fetchMyOnboarding() }, [])

  useEffect(() => {
    if (activeTab === 'time-off' && !timeOffFetched) fetchTimeOffData()
  }, [activeTab])

  useEffect(() => {
    return () => { clearTimeout(celebrationTimer.current) }
  }, [])

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

  function handleDayPortionChange(portion) {
    setTorDayPortion(portion)
    if (portion !== 'full') {
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

    if (!torFlexibility) { showToast('Please select a flexibility option.', 'error'); return }

    const startDate = torStartDate
    const endDate = torEndDate
    const type = torType
    const notesVal = torNotes.trim()
    const dayPortion = torDayPortion
    const isHalfDay = dayPortion !== 'full'
    const businessDaysVal = isHalfDay ? 0.5 : torBusinessDays
    const volunteeringWith = torType === 'volunteer' ? torVolunteeringWith.trim() : null
    const flexibility = torFlexibility
    const flexibilityNote = torFlexibility === 'other' ? torFlexibilityNote.trim() : null

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
      day_portion: dayPortion,
      volunteering_with: volunteeringWith,
      flexibility,
      flexibility_note: flexibilityNote,
      created_at: new Date().toISOString(),
    }, ...prev])

    // Reset form fields but keep torSubmitting=true to prevent double-submit
    setTorStartDate('')
    setTorEndDate('')
    setTorType('personal_vacation')
    setTorNotes('')
    setTorBusinessDays(null)
    setTorDayPortion('full')
    setTorVolunteeringWith('')
    setTorFlexibility('')
    setTorFlexibilityNote('')

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
        day_portion: dayPortion,
        volunteering_with: volunteeringWith,
        flexibility,
        flexibility_note: flexibilityNote,
      })
      .select()
      .single()

    setTorSubmitting(false)

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

    const dayPortionLabel = dayPortion === 'am' ? ' (AM)' : dayPortion === 'pm' ? ' (PM)' : ''
    const emailBody = `
<p><strong>${employeeName}</strong> has submitted a time off request.</p>
<p>
  <strong>Dates:</strong> ${fmtDateRange(startDate, endDate)}<br/>
  <strong>Type:</strong> ${TYPE_LABELS[type] || type}<br/>
  <strong>Business days:</strong> ${businessDaysVal}${dayPortionLabel}<br/>
  <strong>Flexibility:</strong> ${FLEXIBILITY_OPTIONS.find(f => f.value === flexibility)?.label || flexibility}${flexibilityNote ? ` — ${flexibilityNote}` : ''}<br/>
  <strong>Remaining balance if approved:</strong> ${remainingAfter}d${volunteeringWith ? `<br/><strong>Volunteering with:</strong> ${volunteeringWith}` : ''}${notesVal ? `<br/><strong>Notes:</strong> ${notesVal}` : ''}
</p>
${overlapList ? `<p><strong>Others approved off during this period:</strong><br/>${overlapList}</p>` : ''}
<p>Please review in the admin panel.</p>`

    const hrEmail = await getHrEmail()
    if (hrEmail) {
      const { error: hrErr } = await supabase.functions.invoke('send-email', { body: { to: hrEmail, subject: `Time off request: ${employeeName}`, html: emailBody } })
      if (hrErr) console.error('Failed to notify HR:', hrErr)
    }

    const managerId = instance?.employees?.manager_id || employee?.manager_id
    if (managerId) {
      const { data: mgr } = await supabase.from('employees').select('email').eq('id', managerId).maybeSingle()
      if (mgr?.email) {
        const { error: mgrErr } = await supabase.functions.invoke('send-email', { body: { to: mgr.email, subject: `Time off request: ${employeeName}`, html: emailBody } })
        if (mgrErr) console.error('Failed to notify manager:', mgrErr)
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
      const { error: hrErr } = await supabase.functions.invoke('send-email', { body: { to: hrEmail, subject: `Time off cancelled: ${employeeName}`, html: cancelBody } })
      if (hrErr) console.error('Failed to notify HR of cancellation:', hrErr)
    }

    const managerId = instance?.employees?.manager_id || employee?.manager_id
    if (managerId) {
      const { data: mgr } = await supabase.from('employees').select('email').eq('id', managerId).maybeSingle()
      if (mgr?.email) {
        const { error: mgrErr } = await supabase.functions.invoke('send-email', { body: { to: mgr.email, subject: `Time off cancelled: ${employeeName}`, html: cancelBody } })
        if (mgrErr) console.error('Failed to notify manager of cancellation:', mgrErr)
      }
    }

    showToast('Request cancelled.')
    setCancellingId(null)
    setTimeOffFetched(false)
    await fetchTimeOffData()
  }

  async function submitTicket() {
    if (!ticketTitle.trim()) { showToast('Please enter a subject.', 'error'); return }
    if (!ticketDescription.trim()) { showToast('Please describe the issue.', 'error'); return }

    setTicketSubmitting(true)
    const employeeName = instance?.employees?.full_name || employee?.full_name || 'Employee'
    const employeeEmail = session?.user?.email || ''
    const categoryLabel = TICKET_CATEGORIES.find(c => c.value === ticketCategory)?.label || ticketCategory
    const timestamp = new Date().toLocaleString('en-CA', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    const techEmail = await getTechSupportEmail()

    const emailHtml = `
<p><strong>${employeeName}</strong> has submitted a technical support request.</p>
<p>
  <strong>Category:</strong> ${categoryLabel}<br/>
  <strong>Subject:</strong> ${ticketTitle.trim()}<br/>
  <strong>Employee email:</strong> ${employeeEmail}<br/>
  <strong>Submitted:</strong> ${timestamp}
</p>
<p><strong>Description:</strong><br/>${ticketDescription.trim().replace(/\n/g, '<br/>')}</p>`

    const [emailResult, dbResult] = await Promise.all([
      techEmail
        ? supabase.functions.invoke('send-email', {
            body: {
              to: techEmail,
              subject: `[Tech Support] ${categoryLabel}: ${ticketTitle.trim()} — ${employeeName}`,
              html: emailHtml,
            },
          })
        : Promise.resolve({ error: null }),
      supabase.from('tech_support_tickets').insert({
        employee_id: userProfile.employee_id,
        category: ticketCategory,
        title: ticketTitle.trim(),
        description: ticketDescription.trim(),
      }).select('id, created_at').single(),
    ])

    setTicketSubmitting(false)

    if (emailResult.error && dbResult.error) {
      showToast('Failed to submit ticket. Please try again.', 'error')
      return
    }

    setSubmittedTickets(prev => [{
      id: dbResult.data?.id || Date.now(),
      category: ticketCategory,
      categoryLabel,
      title: ticketTitle.trim(),
      description: ticketDescription.trim(),
      submittedAt: dbResult.data?.created_at || new Date().toISOString(),
    }, ...prev])

    setTicketTitle('')
    setTicketDescription('')
    setTicketCategory('software')
    showToast('Ticket submitted — we\'ll be in touch soon.')
  }

  const pendingDays = useMemo(
    () => timeOffRequests.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.business_days), 0),
    [timeOffRequests]
  )

  const totalTasks = useMemo(
    () => Object.values(tasksByPhase).flat().filter(tc => !tc.onboarding_templates.parent_id).length,
    [tasksByPhase]
  )

  const completedTasksCount = useMemo(() => {
    const allTasks = Object.values(tasksByPhase).flat()
    const parentTasks = allTasks.filter(tc => !tc.onboarding_templates.parent_id)
    return parentTasks.filter(tc => {
      const subtasks = allTasks.filter(s => s.onboarding_templates.parent_id === tc.onboarding_templates.id)
      if (subtasks.length === 0) return completions[tc.id]
      return subtasks.every(s => completions[s.id])
    }).length
  }, [tasksByPhase, completions])

  const pct = useMemo(
    () => totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0,
    [totalTasks, completedTasksCount]
  )

  const unsignedDocCount = useMemo(
    () => instance ? documents.filter(doc => !docCompletions[doc.id]?.hidden && !docCompletions[doc.id]?.signed).length : 0,
    [instance, documents, docCompletions]
  )

  const pendingTimeOffCount = useMemo(
    () => timeOffFetched ? timeOffRequests.filter(r => r.status === 'pending').length : 0,
    [timeOffFetched, timeOffRequests]
  )

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

    const { data: urlData, error: urlError } = await supabase.storage
      .from('employee-documents')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365)

    if (urlError || !urlData?.signedUrl) {
      showToast('Failed to generate file URL. Please try again.', 'error')
      setUploadingDocId(null)
      return
    }

    const fileUrl = urlData.signedUrl
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
    app: { minHeight: '100vh', background: '#f4f3ef', fontFamily: 'Inter, -apple-system, sans-serif', color: '#18181b' },
    topbar: { background: '#fff', boxShadow: '0 1px 0 #e2e1dd', padding: isMobile ? '0 16px' : '0 32px', height: isMobile ? '52px' : '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    logo: { fontSize: '14px', fontWeight: 600, color: '#0066cc', letterSpacing: '-0.2px' },
    signout: { fontSize: '12px', color: '#70706b', background: 'none', border: '1px solid #e2e1dd', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 },
    hero: { padding: isMobile ? '24px 16px 0' : '44px 40px 0', maxWidth: isMobile ? 'none' : '720px', margin: '0 auto' },
    name: { fontSize: isMobile ? '22px' : '26px', fontWeight: 600, letterSpacing: '-0.8px', marginBottom: '4px' },
    sub: { fontSize: '13px', color: '#70706b' },
    progressWrap: { marginTop: '20px', marginBottom: isMobile ? '20px' : '32px' },
    progressRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
    progressTrack: { height: '8px', background: '#eceae6', borderRadius: '99px', overflow: 'hidden' },
    progressFill: { height: '100%', background: 'linear-gradient(90deg, #0066cc, #3d9eff)', borderRadius: '99px', boxShadow: '0 0 8px rgba(0,102,204,0.28)', transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' },
    tabs: { display: 'flex', gap: '0', borderBottom: '1px solid #e2e1dd', padding: isMobile ? '0 16px' : '0 40px', maxWidth: isMobile ? 'none' : '720px', margin: '0 auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' },
    tab: (active) => ({ fontSize: '13px', fontWeight: active ? 600 : 400, color: active ? '#0066cc' : '#70706b', padding: '12px 0', marginRight: isMobile ? '18px' : '24px', background: 'none', border: 'none', borderBottom: active ? '2px solid #0066cc' : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, transition: 'color 0.12s ease, border-color 0.12s ease' }),
    content: { padding: isMobile ? '20px 16px' : '28px 40px', maxWidth: isMobile ? 'none' : '720px', margin: '0 auto' },
    phaseLabel: { fontSize: '11px', fontWeight: 600, color: '#a4a39f', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px', marginTop: '28px' },
    parentRow: { display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0', borderBottom: '1px solid #f0efe9', cursor: 'pointer' },
    subtaskRow: { display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 0 10px 32px', borderBottom: '1px solid #f4f3ef', cursor: 'pointer', background: '#f9f8f5' },
    checkbox: (checked) => ({ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: checked ? 'none' : '1.5px solid #d0cfc9', background: checked ? 'linear-gradient(135deg, #0066cc, #3d9eff)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', cursor: 'pointer', boxShadow: checked ? '0 0 0 3px rgba(0,102,204,0.12)' : 'none' }),
    subtaskCheckbox: (checked) => ({ width: '15px', height: '15px', borderRadius: '50%', flexShrink: 0, border: checked ? 'none' : '1.5px solid #d0cfc9', background: checked ? 'linear-gradient(135deg, #0066cc, #3d9eff)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }),
    taskName: (checked) => ({ fontSize: '14px', color: checked ? '#a4a39f' : '#18181b', textDecoration: checked ? 'line-through' : 'none', flex: 1 }),
    subtaskName: (checked) => ({ fontSize: '13px', color: checked ? '#a4a39f' : '#70706b', textDecoration: checked ? 'line-through' : 'none', flex: 1 }),
    chevron: (open) => ({ fontSize: '10px', color: '#a4a39f', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }),
    subtaskCount: { fontSize: '11px', color: '#a4a39f' },
    balCard: { background: '#fff', border: '1px solid #e8e7e3', borderRadius: '12px', padding: isMobile ? '16px' : '22px', marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.04)' },
    balGrid: { display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '12px' : '16px' },
    balStat: { textAlign: 'center' },
    balNum: (warn) => ({ fontSize: '26px', fontWeight: 700, color: warn ? '#c04040' : '#18181b', letterSpacing: '-0.8px' }),
    balLabel: { fontSize: '11px', color: '#a4a39f', marginTop: '4px', fontWeight: 500, letterSpacing: '0.1px' },
    formCard: { background: '#fff', border: '1px solid #e8e7e3', borderRadius: '12px', padding: isMobile ? '16px' : '22px', marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.04)' },
    fieldLabel: { fontSize: '12px', color: '#70706b', marginBottom: '6px', display: 'block', fontWeight: 500 },
    fieldInput: { width: '100%', minWidth: 0, background: '#fff', border: '1px solid #e2e1dd', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#18181b', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', WebkitAppearance: 'none', appearance: 'none' },
    submitBtn: (disabled) => ({ background: disabled ? '#e2e1dd' : 'linear-gradient(180deg, #222 0%, #111 100%)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 500, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', letterSpacing: '0.1px' }),
    torRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 0', borderBottom: '1px solid #f0efe9', flexWrap: 'wrap' },
    cancelBtn: { fontSize: '12px', color: '#70706b', background: 'none', border: '1px solid #e2e1dd', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  }

  if (loading) return (
    <div style={styles.app}>
      <div style={styles.topbar}>
        <div style={styles.logo}>Integrated Launch</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onSwitchToAdmin && (
            <button onClick={onSwitchToAdmin} style={{ fontSize: '12px', color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
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
  const torPending = pendingDays
  const torRemaining = torTotal - torUsed - torPending
  const businessDaysPreview = torDayPortion !== 'full' ? 0.5 : torBusinessDays
  const torExceedsBalance = businessDaysPreview !== null && torRemaining - businessDaysPreview < 0
  const submitDisabled = torSubmitting || !torStartDate || !torEndDate || !torFlexibility || (torDayPortion === 'full' && (torBusinessDays === null || torCalculating))

  return (
    <div style={styles.app}>
      <div style={styles.topbar}>
        <div style={styles.logo}>Integrated Launch</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onSwitchToAdmin && (
            <button onClick={onSwitchToAdmin} style={{ fontSize: '12px', color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
              ← Admin view
            </button>
          )}
          <button style={styles.signout} onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>

      <div style={styles.hero}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '4px' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'linear-gradient(135deg, #1a1a2e 0%, #374151 100%)', color: '#fff', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, letterSpacing: '-0.2px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            {getInitials(displayName)}
          </div>
          <div>
            <div style={styles.name}>Welcome, {displayName.split(' ')[0]}</div>
            <div style={styles.sub}>
              {displayRole && `${displayRole} · `}
              {instance && displayHireDate
                ? `Started ${new Date(displayHireDate).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}`
                : (employee?.brand || userProfile?.brand || 'Integrated Staffing')}
            </div>
          </div>
        </div>
        {instance && (
          <div style={styles.progressWrap}>
            <div style={styles.progressRow}>
              <span style={{ fontSize: '12px', color: '#70706b' }}>{completedTasksCount} of {totalTasks} tasks complete</span>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#0066cc' }}>{pct}%</span>
            </div>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      <div style={styles.tabs}>
        {instance && <button style={styles.tab(activeTab === 'checklist')} onClick={() => setActiveTab('checklist')}>My checklist</button>}
        {instance && (
          <button style={styles.tab(activeTab === 'documents')} onClick={() => setActiveTab('documents')}>
            My Documents
            {unsignedDocCount > 0 && (
              <span className="il-tab-badge" style={{ background: activeTab === 'documents' ? '#e2e1dd' : '#f0efe9', color: activeTab === 'documents' ? '#18181b' : '#6b6b67' }}>
                {unsignedDocCount}
              </span>
            )}
          </button>
        )}
        <button style={styles.tab(activeTab === 'company-resources')} onClick={() => setActiveTab('company-resources')}>Company Resources</button>
        <button style={styles.tab(activeTab === 'time-off')} onClick={() => setActiveTab('time-off')}>
          Time Off
          {pendingTimeOffCount > 0 && (
            <span className="il-tab-badge" style={{ background: activeTab === 'time-off' ? '#fffbf0' : '#fffbf0', color: '#d4901a' }}>
              {pendingTimeOffCount}
            </span>
          )}
        </button>
        <button style={styles.tab(activeTab === 'technical-tickets')} onClick={() => setActiveTab('technical-tickets')}>
          Tech Support
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === 'checklist' && (
          <div className="il-tab-content">
            {PHASES.map(phase => {
              const allTasks = tasksByPhase[phase] || []
              const parentTasks = allTasks.filter(tc => !tc.onboarding_templates.parent_id)
              if (parentTasks.length === 0) return null
              const upcoming = isPhaseUpcoming(phase, displayHireDate)
              return (
                <div key={phase} style={{ opacity: upcoming ? 0.4 : 1, pointerEvents: upcoming ? 'none' : 'auto' }}>
                  <div style={{ ...styles.phaseLabel, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{phase}</span>
                    {upcoming && <span style={{ fontSize: '10px', color: '#a4a39f', fontWeight: 500, background: '#f4f3ef', padding: '1px 6px', borderRadius: '3px', textTransform: 'none', letterSpacing: 0 }}>Upcoming</span>}
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
                        <div className="il-row" style={styles.parentRow} onClick={() => hasSubtasks ? setExpandedTasks(prev => ({ ...prev, [tc.id]: !prev[tc.id] })) : toggleTask(tc.id, completions[tc.id], { stopPropagation: () => {} })}>
                          <div className="il-checkbox" style={styles.checkbox(isChecked)} onClick={(e) => { e.stopPropagation(); if (!hasSubtasks) toggleTask(tc.id, completions[tc.id], e) }}>
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
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="il-tab-content">
            {documents.filter(doc => !docCompletions[doc.id]?.hidden).length === 0 && (
              <div style={{ fontSize: '13px', color: '#a4a39f', padding: '20px 0' }}>No documents have been assigned yet.</div>
            )}
            {documents.filter(doc => !docCompletions[doc.id]?.hidden).map(doc => {
              const dc = docCompletions[doc.id]
              const signed = dc?.signed || false
              const completedFileUrl = dc?.completed_file_url || null
              const isUploading = uploadingDocId === doc.id
              return (
                <div key={doc.id} style={{ padding: '16px 0', borderBottom: '1px solid #f0efe9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, fontSize: '14px', color: '#18181b', fontWeight: 500 }}>{doc.name}</div>
                    <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#70706b', textDecoration: 'underline', flexShrink: 0 }}>View</a>
                    {signed ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', color: '#1a7a4a', fontWeight: 500 }}>✓ Received</span>
                        <button onClick={() => toggleDocument(doc.id)} style={{ fontSize: '11px', color: '#a4a39f', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Undo</button>
                      </div>
                    ) : (
                      <button onClick={() => toggleDocument(doc.id)} style={{ fontSize: '12px', color: '#70706b', border: '1px solid #e2e1dd', borderRadius: '5px', padding: '4px 10px', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                        Mark as received
                      </button>
                    )}
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    {completedFileUrl ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '12px', color: '#1a7a4a' }}>✓ Uploaded</span>
                        <a href={completedFileUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0066cc', textDecoration: 'none' }}>View file</a>
                        <label style={{ fontSize: '12px', color: isUploading ? '#a4a39f' : '#70706b', cursor: isUploading ? 'default' : 'pointer' }}>
                          {isUploading ? 'Uploading...' : 'Replace'}
                          <input type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx" onChange={e => handleEmployeeDocumentUpload(e, doc.id)} disabled={!!uploadingDocId} />
                        </label>
                      </div>
                    ) : (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: isUploading ? '#a4a39f' : '#0066cc', cursor: isUploading ? 'default' : 'pointer', border: '1px solid ' + (isUploading ? '#e2e1dd' : '#cce0f5'), borderRadius: '6px', padding: '6px 12px', background: isUploading ? '#f7f6f4' : '#f0f7ff' }}>
                        {!isUploading && <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 10V4M4 7l3-3 3 3"/><path d="M2 12h10"/></svg>}
                        {isUploading ? 'Uploading...' : 'Upload completed document'}
                        <input type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx" onChange={e => handleEmployeeDocumentUpload(e, doc.id)} disabled={!!uploadingDocId} />
                      </label>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'company-resources' && (
          <div className="il-tab-content">
            {companyResources.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#a4a39f', padding: '20px 0' }}>No company resources have been added yet.</div>
            ) : (
              <>
                {companyResources.length > 3 && (
                  <div style={{ position: 'relative', marginBottom: '16px' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#a4a39f" strokeWidth="1.5" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                      <circle cx="6" cy="6" r="4"/><path d="M10 10l2.5 2.5"/>
                    </svg>
                    <input
                      type="text"
                      placeholder="Search resources…"
                      value={resourceSearch}
                      onChange={e => setResourceSearch(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e1dd', borderRadius: '7px', padding: '8px 32px 8px 32px', fontSize: '13px', fontFamily: 'inherit', color: '#18181b', background: '#fff', outline: 'none' }}
                    />
                    {resourceSearch && (
                      <button onClick={() => setResourceSearch('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#a4a39f', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
                    )}
                  </div>
                )}
                {(() => {
                  const filtered = resourceSearch
                    ? companyResources.filter(d => d.name.toLowerCase().includes(resourceSearch.toLowerCase()))
                    : companyResources
                  if (filtered.length === 0) return (
                    <div style={{ fontSize: '13px', color: '#a4a39f', padding: '20px 0' }}>No resources match "{resourceSearch}".</div>
                  )
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                      {filtered.map(doc => {
                        const rawExt = (doc.file_url || '').split('?')[0].split('.').pop().toLowerCase()
                        const ext = rawExt.length <= 5 ? rawExt : ''
                        const typeLabel = ext === 'pdf' ? 'PDF' : ext === 'docx' || ext === 'doc' ? 'DOC' : ext === 'xlsx' || ext === 'xls' ? 'XLS' : ext === 'pptx' || ext === 'ppt' ? 'PPT' : ext ? ext.toUpperCase() : 'FILE'
                        const iconBg = ext === 'pdf' ? '#fff1f0' : ext === 'docx' || ext === 'doc' ? '#f0f7ff' : ext === 'xlsx' || ext === 'xls' ? '#f0faf4' : ext === 'pptx' || ext === 'ppt' ? '#fff8f0' : '#f4f3ef'
                        const iconStroke = ext === 'pdf' ? '#c04040' : ext === 'docx' || ext === 'doc' ? '#0066cc' : ext === 'xlsx' || ext === 'xls' ? '#1a7a4a' : ext === 'pptx' || ext === 'ppt' ? '#c27a30' : '#6b6b67'
                        return (
                          <a key={doc.id} href={doc.file_url} target="_blank" rel="noreferrer" className="il-resource-tile"
                            style={{ display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #e2e1dd', borderRadius: '10px', padding: '14px', textDecoration: 'none', color: '#18181b' }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '7px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', flexShrink: 0 }}>
                              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke={iconStroke} strokeWidth="1.5">
                                <path d="M3 2h6l3 3v7H3z"/><path d="M9 2v3h3"/>
                              </svg>
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#18181b', lineHeight: '1.4', flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                              {doc.name}
                            </div>
                            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 600, color: '#70706b', background: '#f0efe9', borderRadius: '3px', padding: '1px 5px' }}>{typeLabel}</span>
                              <span style={{ fontSize: '11px', color: '#a4a39f' }}>Open ↗</span>
                            </div>
                          </a>
                        )
                      })}
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )}

        {activeTab === 'time-off' && (
          <div className="il-tab-content">
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
                    <div style={{ fontSize: '13px', color: '#70706b', lineHeight: 1.6 }}>
                      Your entitlement hasn't been set yet — contact HR.
                    </div>
                  </div>
                ) : (
                  <div style={styles.balCard}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#a4a39f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
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
                        <div style={{ ...styles.balNum(false), color: torPending > 0 ? '#b8740a' : '#18181b' }}>{torPending}</div>
                        <div style={styles.balLabel}>Pending</div>
                      </div>
                      <div style={styles.balStat}>
                        <div style={{ ...styles.balNum(torRemaining < 0), fontSize: '28px', color: torRemaining < 0 ? '#c04040' : '#0066cc' }}>{torRemaining}</div>
                        <div style={{ ...styles.balLabel, color: torRemaining < 0 ? '#c04040' : '#0066cc' }}>Remaining</div>
                        {torRemaining < 0 && <div style={{ fontSize: '10px', color: '#c04040', marginTop: '2px' }}>Over limit</div>}
                      </div>
                    </div>
                    {torTotal > 0 && (
                      <div style={{ marginTop: '14px', borderTop: '1px solid #f0efe9', paddingTop: '14px' }}>
                        <div style={{ height: '5px', borderRadius: '3px', background: '#f0efe9', overflow: 'hidden', display: 'flex' }}>
                          {torUsed > 0 && <div style={{ width: `${Math.min(100, (torUsed / torTotal) * 100)}%`, background: '#18181b', transition: 'width 0.3s ease' }} />}
                          {torPending > 0 && <div style={{ width: `${Math.min(100 - (torUsed / torTotal) * 100, (torPending / torTotal) * 100)}%`, background: '#d4901a', transition: 'width 0.3s ease' }} />}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Request form */}
                <div style={styles.formCard}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#18181b', marginBottom: '20px' }}>Request time off</div>

                  {/* Leave dates */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ minWidth: 0 }}>
                      <label style={styles.fieldLabel}>Start date</label>
                      <input
                        type="date"
                        style={styles.fieldInput}
                        value={torStartDate}
                        onChange={e => {
                          setTorStartDate(e.target.value)
                          if (torDayPortion !== 'full') {
                            setTorEndDate(e.target.value)
                          } else if (torEndDate) {
                            calculateBusinessDays(e.target.value, torEndDate)
                          }
                        }}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <label style={styles.fieldLabel}>End date</label>
                      <input
                        type="date"
                        style={{ ...styles.fieldInput, background: torDayPortion !== 'full' ? '#f4f3ef' : '#fff', color: torDayPortion !== 'full' ? '#a4a39f' : '#18181b' }}
                        value={torEndDate}
                        min={torStartDate || undefined}
                        disabled={torDayPortion !== 'full'}
                        onChange={e => {
                          setTorEndDate(e.target.value)
                          if (torStartDate) calculateBusinessDays(torStartDate, e.target.value)
                        }}
                      />
                    </div>
                  </div>

                  {/* AM / PM / Full day */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={styles.fieldLabel}>Duration</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[{ value: 'full', label: 'Full day(s)' }, { value: 'am', label: 'AM' }, { value: 'pm', label: 'PM' }].map(opt => {
                        const active = torDayPortion === opt.value
                        return (
                          <button key={opt.value} onClick={() => handleDayPortionChange(opt.value)}
                            style={{ padding: '6px 14px', border: `1.5px solid ${active ? '#18181b' : '#e2e1dd'}`, borderRadius: '6px', background: active ? '#18181b' : '#fff', color: active ? '#fff' : '#70706b', fontSize: '13px', fontWeight: active ? 500 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Type of leave */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={styles.fieldLabel}>Type of leave</label>
                    <div style={{ border: '1px solid #e2e1dd', borderRadius: '8px', overflow: 'hidden' }}>
                      {TYPE_OPTIONS.map((o, i) => {
                        const active = torType === o.value
                        return (
                          <label key={o.value} onClick={() => setTorType(o.value)}
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', cursor: 'pointer', background: active ? '#fafaf9' : '#fff', borderTop: i > 0 ? '1px solid #f0efe9' : 'none' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, border: `1.5px solid ${active ? '#18181b' : '#e2e1dd'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.12s' }}>
                              {active && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#18181b' }} />}
                            </div>
                            <span style={{ fontSize: '13px', color: '#18181b', fontWeight: active ? 500 : 400 }}>{o.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Volunteering with (conditional) */}
                  {torType === 'volunteer' && (
                    <div style={{ marginBottom: '20px' }}>
                      <label style={styles.fieldLabel}>Who will you be volunteering with?</label>
                      <input
                        type="text"
                        style={styles.fieldInput}
                        placeholder="Organization name"
                        value={torVolunteeringWith}
                        onChange={e => setTorVolunteeringWith(e.target.value)}
                        autoFocus
                      />
                    </div>
                  )}

                  {/* Notes */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={styles.fieldLabel}>Notes (optional)</label>
                    <textarea
                      style={{ ...styles.fieldInput, resize: 'vertical', minHeight: '64px' }}
                      placeholder="Any additional context..."
                      value={torNotes}
                      onChange={e => setTorNotes(e.target.value)}
                    />
                  </div>

                  {/* Flexibility */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={styles.fieldLabel}>Flexibility <span style={{ color: '#c04040' }}>*</span></label>
                    <div style={{ fontSize: '11px', color: '#a0a09c', marginBottom: '8px' }}>In case of conflicting business issues or overlapping leave requests</div>
                    <div style={{ border: '1px solid #e2e1dd', borderRadius: '8px', overflow: 'hidden' }}>
                      {FLEXIBILITY_OPTIONS.map((o, i) => {
                        const active = torFlexibility === o.value
                        return (
                          <label key={o.value} onClick={() => setTorFlexibility(o.value)}
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', cursor: 'pointer', background: active ? '#fafaf9' : '#fff', borderTop: i > 0 ? '1px solid #f0efe9' : 'none' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, border: `1.5px solid ${active ? '#18181b' : '#e2e1dd'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.12s' }}>
                              {active && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#18181b' }} />}
                            </div>
                            <span style={{ fontSize: '13px', color: '#18181b', fontWeight: active ? 500 : 400 }}>{o.label}</span>
                          </label>
                        )
                      })}
                    </div>
                    {torFlexibility === 'other' && (
                      <input
                        type="text"
                        style={{ ...styles.fieldInput, marginTop: '8px' }}
                        placeholder="Please describe..."
                        value={torFlexibilityNote}
                        onChange={e => setTorFlexibilityNote(e.target.value)}
                        autoFocus
                      />
                    )}
                  </div>

                  {/* Business days display */}
                  {torStartDate && torEndDate && (
                    <div style={{ marginBottom: '16px', fontSize: '13px', color: '#70706b' }}>
                      {torDayPortion !== 'full' ? (
                        <span style={{ fontWeight: 500 }}>½ day ({torDayPortion.toUpperCase()})</span>
                      ) : torCalculating ? (
                        <span style={{ color: '#a4a39f' }}>Calculating...</span>
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
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#18181b', marginBottom: '12px' }}>History</div>
                {timeOffRequests.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#a4a39f', padding: '12px 0' }}>No requests yet.</div>
                ) : (
                  timeOffRequests.map(req => (
                    <div key={req.id} style={{ ...styles.torRow, opacity: req.id?.toString().startsWith('temp-') ? 0.6 : 1 }}>
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <TypeIcon type={req.type} size={12} />
                          <span style={{ fontSize: '13px', fontWeight: 500, color: '#18181b' }}>
                            {fmtDateRange(req.start_date, req.end_date)}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#70706b', marginTop: '2px' }}>
                          {TYPE_LABELS[req.type] || req.type} · {req.business_days}d{req.day_portion && req.day_portion !== 'full' ? ` (${req.day_portion.toUpperCase()})` : req.is_half_day ? ' (half day)' : ''}
                        </div>
                      </div>
                      <StatusPill status={req.status} />
                      {req.review_notes && (
                        <div style={{ fontSize: '11px', color: '#70706b', fontStyle: 'italic', flex: 1 }}>
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
          </div>
        )}

        {activeTab === 'technical-tickets' && (
          <div className="il-tab-content">
            <div style={styles.formCard}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#18181b', marginBottom: '20px' }}>Submit a tech issue</div>

              <div style={{ marginBottom: '16px' }}>
                <label style={styles.fieldLabel}>Category</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {TICKET_CATEGORIES.map(opt => {
                    const active = ticketCategory === opt.value
                    return (
                      <button key={opt.value} onClick={() => setTicketCategory(opt.value)}
                        style={{ padding: '6px 12px', border: `1.5px solid ${active ? '#18181b' : '#e2e1dd'}`, borderRadius: '6px', background: active ? '#18181b' : '#fff', color: active ? '#fff' : '#70706b', fontSize: '12px', fontWeight: active ? 500 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={styles.fieldLabel}>Subject <span style={{ color: '#c04040' }}>*</span></label>
                <input
                  type="text"
                  style={styles.fieldInput}
                  placeholder="Brief description of the issue"
                  value={ticketTitle}
                  onChange={e => setTicketTitle(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={styles.fieldLabel}>Details <span style={{ color: '#c04040' }}>*</span></label>
                <textarea
                  style={{ ...styles.fieldInput, resize: 'vertical', minHeight: '100px' }}
                  placeholder="What happened? What were you trying to do? Any error messages?"
                  value={ticketDescription}
                  onChange={e => setTicketDescription(e.target.value)}
                />
              </div>

              <button
                style={styles.submitBtn(!ticketTitle.trim() || !ticketDescription.trim() || ticketSubmitting)}
                disabled={!ticketTitle.trim() || !ticketDescription.trim() || ticketSubmitting}
                onClick={submitTicket}
              >
                {ticketSubmitting ? 'Submitting…' : 'Submit ticket'}
              </button>
            </div>

            {submittedTickets.length > 0 && (
              <>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#18181b', marginBottom: '12px' }}>Submitted this session</div>
                {submittedTickets.map(ticket => (
                  <div key={ticket.id} style={{ padding: '14px 0', borderBottom: '1px solid #f0efe9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, background: '#f4f3ef', color: '#70706b', borderRadius: '4px', padding: '2px 7px' }}>{ticket.categoryLabel}</span>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#18181b' }}>{ticket.title}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#70706b' }}>
                      {new Date(ticket.submittedAt).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      <span style={{ marginLeft: '8px', color: '#1a7a4a', fontWeight: 500 }}>✓ Sent</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {celebration && (
        <div style={{
          position: 'fixed', bottom: isMobile ? '80px' : '32px', left: '50%', transform: 'translateX(-50%)',
          background: '#18181b', color: '#fff', borderRadius: '12px',
          padding: '16px 24px', fontSize: '14px', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 1000,
          fontFamily: 'Inter, -apple-system, sans-serif',
          animation: 'slideUp 0.2s ease forwards',
          whiteSpace: 'nowrap',
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
