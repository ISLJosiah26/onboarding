/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import { SkeletonLine } from '../components/Skeleton'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import { handleSupabaseError } from '../utils/handleError'
import { logAudit } from '../utils/auditLog'
import { useWindowSize } from '../hooks/useWindowSize'

const CURRENT_YEAR = new Date().getFullYear()
const TODAY = new Date().toISOString().slice(0, 10)

const TYPE_LABELS = {
  personal_vacation: 'Personal / Vacation',
  professional_development: 'Professional Development',
  volunteer: 'Volunteer Day',
  work_from_wherever: 'Work from Wherever Week',
  bereavement: 'Bereavement Leave',
  care_day: 'Care Day',
  vacation: 'Vacation',
  sick: 'Sick Day',
  personal: 'Personal',
  other: 'Other',
}

const STATUS_STYLES = {
  pending:   { background: '#fffbf0', color: '#d4901a' },
  approved:  { background: '#f0faf4', color: '#2d7a4a' },
  denied:    { background: '#fdf0f0', color: '#c74848' },
  cancelled: { background: '#f4f3f1', color: '#8a8a86' },
}

// No blue — reserved for today highlight and UI accents
const PALETTE = [
  { bg: '#dcfce7', text: '#15803d' },
  { bg: '#fef3c7', text: '#b45309' },
  { bg: '#fce7f3', text: '#be185d' },
  { bg: '#ede9fe', text: '#6d28d9' },
  { bg: '#ccfbf1', text: '#0f766e' },
  { bg: '#ffe4e6', text: '#9f1239' },
  { bg: '#fef9c3', text: '#854d0e' },
  { bg: '#f3e8ff', text: '#7e22ce' },
]

function employeeColor(employeeId) {
  let h = 0
  for (let i = 0; i < (employeeId || '').length; i++) h = (h + employeeId.charCodeAt(i)) % PALETTE.length
  return PALETTE[h]
}

function buildCalendarDays(year, month) {
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array(firstDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function pad(n) { return String(n).padStart(2, '0') }

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending
  return (
    <span style={{ ...s, fontSize: '11px', fontWeight: 500, padding: '2px 9px', borderRadius: '10px', display: 'inline-block' }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function TypeIcon({ type, size = 12 }) {
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

function fmtDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function fmtDateRange(start, end) {
  const s = fmtDate(start)
  const e = fmtDate(end)
  return s === e ? s : `${s} – ${e}`
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const DATE_ROW_H = 28
const EVENT_H = 20
const EVENT_GAP = 3
const SLOT_H = EVENT_H + EVENT_GAP

function getWeekEventLayout(weekDates, allRequests) {
  const activeDates = weekDates.filter(d => d)
  if (activeDates.length === 0) return { assignments: [], trackCount: 0 }
  const weekMin = activeDates[0]
  const weekMax = activeDates[activeDates.length - 1]

  const relevant = allRequests.filter(r =>
    (r.status === 'approved' || r.status === 'pending') &&
    r.start_date <= weekMax &&
    r.end_date >= weekMin
  )

  relevant.sort((a, b) => {
    if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1
    return a.end_date < b.end_date ? 1 : -1
  })

  const tracks = []
  const assignments = []

  for (const req of relevant) {
    let startCol = weekDates.findIndex(d => d && d >= req.start_date)
    if (startCol === -1) startCol = weekDates.findIndex(d => d)

    let endCol = -1
    for (let i = 6; i >= 0; i--) {
      if (weekDates[i] && weekDates[i] <= req.end_date) { endCol = i; break }
    }
    if (endCol === -1 || startCol > endCol) continue

    let track = 0
    while (true) {
      if (!tracks[track]) break
      const conflict = tracks[track].some(([s, e]) => startCol <= e && endCol >= s)
      if (!conflict) break
      track++
    }
    if (!tracks[track]) tracks[track] = []
    tracks[track].push([startCol, endCol])

    assignments.push({
      req, track, startCol, endCol,
      startsThisWeek: req.start_date >= weekMin,
      endsThisWeek: req.end_date <= weekMax,
    })
  }

  return { assignments, trackCount: tracks.length }
}

export default function TimeOff({ session, userProfile, onNavigate }) {
  const [subView, setSubView] = useState('requests')
  const [requests, setRequests] = useState([])
  const [reqBalances, setReqBalances] = useState([])
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewNotes, setReviewNotes] = useState({})
  const [reviewingId, setReviewingId] = useState(null)
  const [editingBalanceId, setEditingBalanceId] = useState(null)
  const [editTotalDays, setEditTotalDays] = useState('')
  const [savingBalanceId, setSavingBalanceId] = useState(null)
  const [expandedEmployeeId, setExpandedEmployeeId] = useState(null)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  // Filter / sort
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  // Holidays
  const [holidays, setHolidays] = useState([])
  const [holidaysLoading, setHolidaysLoading] = useState(false)
  const [newHolidayName, setNewHolidayName] = useState('')
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayRepeats, setNewHolidayRepeats] = useState(false)
  const [savingHoliday, setSavingHoliday] = useState(false)
  const [deletingHolidayId, setDeletingHolidayId] = useState(null)
  const { toast, showToast, hideToast } = useToast()
  const { isMobile } = useWindowSize()

  useEffect(() => { fetchData() }, [subView])

  async function fetchData() {
    if (subView === 'holidays') { await fetchHolidays(); return }
    setLoading(true)
    if (subView === 'balances') await fetchBalances()
    else await fetchRequests()
    setLoading(false)
  }

  async function fetchRequests() {
    const { data, error } = await supabase
      .from('time_off_requests')
      .select(`
        *,
        employee:employees!time_off_requests_employee_id_fkey(id, full_name, email),
        reviewer:employees!time_off_requests_reviewed_by_fkey(id, full_name)
      `)
      .order('created_at', { ascending: false })

    if (error) { showToast(handleSupabaseError(error, 'Failed to load requests.'), 'error'); return }

    const sorted = [
      ...(data || []).filter(r => r.status === 'pending'),
      ...(data || []).filter(r => r.status !== 'pending'),
    ]
    setRequests(sorted)

    const { data: bals } = await supabase.from('time_off_balances').select('*').eq('year', CURRENT_YEAR)
    setReqBalances(bals || [])
  }

  async function fetchBalances() {
    const { data: emps, error: empsErr } = await supabase.from('employees').select('id, full_name, email').order('full_name')
    if (empsErr) { showToast(handleSupabaseError(empsErr, 'Failed to load employees.'), 'error'); return }

    const { data: bals } = await supabase.from('time_off_balances').select('*').eq('year', CURRENT_YEAR)
    const { data: reqs } = await supabase.from('time_off_requests').select('*')

    const balMap = {}
    if (bals) bals.forEach(b => { balMap[b.employee_id] = b })

    const reqsByEmp = {}
    if (reqs) reqs.forEach(r => {
      if (!reqsByEmp[r.employee_id]) reqsByEmp[r.employee_id] = []
      reqsByEmp[r.employee_id].push(r)
    })

    setBalances((emps || []).map(emp => {
      const bal = balMap[emp.id] || null
      const empReqs = (reqsByEmp[emp.id] || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      const pendingDays = empReqs.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.business_days), 0)
      return { employee: emp, balance: bal, pendingDays, requests: empReqs }
    }))
  }

  async function fetchHolidays() {
    setHolidaysLoading(true)
    const { data, error } = await supabase.from('company_holidays').select('*').order('date', { ascending: true })
    if (error) showToast(handleSupabaseError(error, 'Failed to load holidays.'), 'error')
    setHolidays(data || [])
    setHolidaysLoading(false)
  }

  async function addHoliday() {
    if (!newHolidayName.trim() || !newHolidayDate) { showToast('Name and date are required.', 'error'); return }
    setSavingHoliday(true)
    const { error } = await supabase.from('company_holidays').insert({
      name: newHolidayName.trim(),
      date: newHolidayDate,
      repeats_yearly: newHolidayRepeats,
    })
    if (error) { showToast(handleSupabaseError(error, 'Failed to add holiday.'), 'error'); setSavingHoliday(false); return }
    setNewHolidayName('')
    setNewHolidayDate('')
    setNewHolidayRepeats(false)
    showToast('Holiday added.')
    setSavingHoliday(false)
    await fetchHolidays()
  }

  async function deleteHoliday(id) {
    setDeletingHolidayId(id)
    const { error } = await supabase.from('company_holidays').delete().eq('id', id)
    if (error) { showToast(handleSupabaseError(error, 'Failed to delete holiday.'), 'error'); setDeletingHolidayId(null); return }
    showToast('Holiday removed.')
    setDeletingHolidayId(null)
    setHolidays(prev => prev.filter(h => h.id !== id))
  }

  function getBalForEmployee(employeeId) {
    return reqBalances.find(b => b.employee_id === employeeId) || null
  }

  function getOverlapNames(req) {
    return requests
      .filter(r => r.id !== req.id && r.status === 'approved' && r.employee_id !== req.employee_id && r.start_date <= req.end_date && r.end_date >= req.start_date)
      .map(r => r.employee?.full_name?.split(' ')[0] || '?')
  }

  function getRemainingAfterApproval(req) {
    const bal = getBalForEmployee(req.employee_id)
    if (!bal) return null
    const otherPending = requests.filter(r => r.id !== req.id && r.employee_id === req.employee_id && r.status === 'pending').reduce((s, r) => s + Number(r.business_days), 0)
    return Number(bal.total_days) - Number(bal.used_days) - otherPending - Number(req.business_days)
  }

  async function approveRequest(req) {
    setReviewingId(req.id)
    const notes = reviewNotes[req.id] || ''
    const bal = getBalForEmployee(req.employee_id)

    // Update balance first, track previous state for rollback
    let prevUsedDays = null
    let createdBalId = null

    if (bal) {
      prevUsedDays = Number(bal.used_days)
      const { error: balErr } = await supabase.from('time_off_balances')
        .update({ used_days: prevUsedDays + Number(req.business_days), updated_at: new Date().toISOString() })
        .eq('id', bal.id)
      if (balErr) { showToast(handleSupabaseError(balErr, 'Failed to update balance.'), 'error'); setReviewingId(null); return }
    } else {
      const { data: newBal, error: balErr } = await supabase.from('time_off_balances')
        .insert({ employee_id: req.employee_id, year: CURRENT_YEAR, total_days: 0, used_days: Number(req.business_days) })
        .select().single()
      if (balErr) { showToast(handleSupabaseError(balErr, 'Failed to create balance.'), 'error'); setReviewingId(null); return }
      createdBalId = newBal?.id
    }

    // Approve the request — roll back balance if this fails
    const { error } = await supabase.from('time_off_requests')
      .update({ status: 'approved', review_notes: notes || null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', req.id)

    if (error) {
      if (bal && prevUsedDays !== null) {
        await supabase.from('time_off_balances')
          .update({ used_days: prevUsedDays, updated_at: new Date().toISOString() })
          .eq('id', bal.id)
      } else if (createdBalId) {
        await supabase.from('time_off_balances').delete().eq('id', createdBalId)
      }
      showToast(handleSupabaseError(error, 'Failed to approve request.'), 'error')
      setReviewingId(null)
      return
    }

    logAudit('time_off_approved', 'time_off_request', req.id, { employee_id: req.employee_id, days: req.business_days, type: req.type })

    let emailFailed = false
    if (req.employee?.email) {
      const { error: emailErr } = await supabase.functions.invoke('send-email', {
        body: {
          to: req.employee.email,
          subject: 'Your time off request has been approved',
          html: `<p>Hi ${req.employee.full_name},</p>
<p>Your time off request has been <strong>approved</strong>.</p>
<p><strong>Dates:</strong> ${fmtDateRange(req.start_date, req.end_date)}<br/>
<strong>Type:</strong> ${TYPE_LABELS[req.type] || req.type}<br/>
<strong>Business days:</strong> ${req.business_days}${notes ? `<br/><strong>Notes:</strong> ${notes}` : ''}</p>
<p>Enjoy your time off!</p>`
        }
      })
      if (emailErr) emailFailed = true
    }

    showToast(emailFailed ? 'Approved — email to employee failed to send.' : 'Request approved.')
    setReviewingId(null)
    await fetchData()
  }

  async function denyRequest(req) {
    setReviewingId(req.id)
    const notes = reviewNotes[req.id] || ''
    const { error } = await supabase.from('time_off_requests').update({ status: 'denied', review_notes: notes || null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', req.id)
    if (error) { showToast(handleSupabaseError(error, 'Failed to deny.'), 'error'); setReviewingId(null); return }

    logAudit('time_off_denied', 'time_off_request', req.id, { employee_id: req.employee_id, days: req.business_days, type: req.type })

    let emailFailed = false
    if (req.employee?.email) {
      const { error: emailErr } = await supabase.functions.invoke('send-email', {
        body: {
          to: req.employee.email,
          subject: 'Your time off request has been denied',
          html: `<p>Hi ${req.employee.full_name},</p>
<p>Your time off request has been <strong>denied</strong>.</p>
<p><strong>Dates:</strong> ${fmtDateRange(req.start_date, req.end_date)}<br/>
<strong>Type:</strong> ${TYPE_LABELS[req.type] || req.type}<br/>
<strong>Business days:</strong> ${req.business_days}${notes ? `<br/><strong>Reason:</strong> ${notes}` : ''}</p>
<p>Please reach out to HR if you have questions.</p>`
        }
      })
      if (emailErr) emailFailed = true
    }

    showToast(emailFailed ? 'Denied — email to employee failed to send.' : 'Request denied.')
    setReviewingId(null)
    await fetchData()
  }

  async function saveTotalDays(row) {
    const val = parseFloat(editTotalDays)
    if (isNaN(val) || val < 0) { showToast('Enter a valid number of days.', 'error'); return }
    setSavingBalanceId(row.employee.id)
    if (row.balance) {
      const { error } = await supabase.from('time_off_balances').update({ total_days: val, updated_at: new Date().toISOString() }).eq('id', row.balance.id)
      if (error) { showToast(handleSupabaseError(error, 'Failed to update.'), 'error'); setSavingBalanceId(null); return }
    } else {
      const { error } = await supabase.from('time_off_balances').insert({ employee_id: row.employee.id, year: CURRENT_YEAR, total_days: val, used_days: 0 })
      if (error) { showToast(handleSupabaseError(error, 'Failed to create balance.'), 'error'); setSavingBalanceId(null); return }
    }
    showToast('Balance updated.')
    setSavingBalanceId(null)
    setEditingBalanceId(null)
    await fetchBalances()
    setLoading(false)
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  function handleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const allEmployees = [...new Map(requests.filter(r => r.employee).map(r => [r.employee_id, r.employee])).values()].sort((a, b) => a.full_name.localeCompare(b.full_name))

  const displayRequests = requests
    .filter(r => filterStatus === 'all' || r.status === filterStatus)
    .filter(r => !filterEmployee || r.employee_id === filterEmployee)
    .sort((a, b) => {
      if (sortField !== 'status') {
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (b.status === 'pending' && a.status !== 'pending') return 1
      }
      let av = a[sortField] || ''
      let bv = b[sortField] || ''
      if (sortField === 'employee_name') { av = a.employee?.full_name || ''; bv = b.employee?.full_name || '' }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const s = {
    page: { padding: isMobile ? '16px' : '32px 40px', maxWidth: '1100px' },
    title: { fontSize: '20px', fontWeight: 600, letterSpacing: '-0.3px', color: '#1a1a1a', marginBottom: '4px' },
    sub: { fontSize: '13px', color: '#8a8a86', marginBottom: isMobile ? '16px' : '28px' },
    subNav: { display: 'flex', borderBottom: '1px solid #ebebe8', marginBottom: '20px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' },
    subTab: (a) => ({ fontSize: '13px', fontWeight: a ? 500 : 400, color: a ? '#1a1a1a' : '#8a8a86', padding: '10px 0', marginRight: '20px', background: 'none', border: 'none', borderBottom: a ? '2px solid #1a1a1a' : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }),
    card: { background: '#fff', border: '1px solid #ebebe8', borderRadius: '10px', overflow: 'hidden' },
    tHead: (cols) => ({ display: 'grid', gridTemplateColumns: cols, padding: '10px 16px', background: '#fafaf9', borderBottom: '1px solid #ebebe8', fontSize: '11px', fontWeight: 500, color: '#8a8a86', textTransform: 'uppercase', letterSpacing: '0.4px' }),
    tRow: (cols) => ({ display: 'grid', gridTemplateColumns: cols, padding: '13px 16px', borderBottom: '1px solid #f0efeb', alignItems: 'center', fontSize: '13px', color: '#1a1a1a' }),
    empty: { padding: '40px', textAlign: 'center', fontSize: '13px', color: '#a8a8a4' },
    inp: { background: '#fff', border: '1px solid #ebebe8', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', color: '#1a1a1a', fontFamily: 'Inter, -apple-system, sans-serif', outline: 'none', boxSizing: 'border-box' },
    btnApprove: { background: '#f0faf4', color: '#2d7a4a', border: '1px solid #c3e8d1', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flex: 1 },
    btnDeny: { background: '#fdf0f0', color: '#c74848', border: '1px solid #f5d6d6', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flex: 1 },
    btnEdit: { background: 'transparent', color: '#5f5f5c', border: '1px solid #ebebe8', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' },
    btnSave: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 11px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    btnCancel: { background: 'transparent', color: '#8a8a86', border: '1px solid #ebebe8', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' },
    navBtn: { background: 'transparent', border: '1px solid #ebebe8', borderRadius: '6px', padding: '5px 10px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', color: '#5f5f5c', lineHeight: 1 },
  }

  const REQ_COLS = '1.4fr 1fr 90px 60px 100px 80px 170px'
  const BAL_COLS = '1.6fr 90px 90px 90px 90px 100px'

  function SortIndicator({ field }) {
    if (sortField !== field) return <span style={{ color: '#d4d3cf', fontSize: '9px', marginLeft: '3px' }}>⬍</span>
    return <span style={{ color: '#5f5f5c', fontSize: '9px', marginLeft: '3px' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  function RequestCard({ req }) {
    const remaining = getRemainingAfterApproval(req)
    const overlapNames = getOverlapNames(req)
    const busy = reviewingId === req.id
    return (
      <div style={{ background: '#fff', border: '1px solid #ebebe8', borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>{req.employee?.full_name || '—'}</div>
            {overlapNames.length > 0 && (
              <div style={{ fontSize: '11px', color: '#d4901a', marginTop: '2px' }}>{overlapNames.join(', ')} also off</div>
            )}
          </div>
          <StatusPill status={req.status} />
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#5f5f5c', marginBottom: req.status === 'pending' ? '12px' : '0' }}>
          <span>{fmtDateRange(req.start_date, req.end_date)}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TypeIcon type={req.type} size={12} />{TYPE_LABELS[req.type]}
          </span>
          <span>{req.business_days}d{req.is_half_day ? ' ½' : ''}</span>
          {req.status === 'pending' && remaining != null && (
            <span style={{ color: remaining < 0 ? '#c74848' : '#5f5f5c', fontWeight: remaining < 0 ? 500 : 400 }}>
              → {remaining}d remaining
            </span>
          )}
        </div>
        {req.status !== 'pending' && req.review_notes && (
          <div style={{ fontSize: '12px', color: '#8a8a86', fontStyle: 'italic', marginTop: '6px' }}>{req.review_notes}</div>
        )}
        {req.status === 'pending' && (
          <div>
            <input
              style={{ ...s.inp, width: '100%', padding: '8px 10px', marginBottom: '10px', boxSizing: 'border-box' }}
              placeholder="Review notes (optional)"
              value={reviewNotes[req.id] || ''}
              onChange={e => setReviewNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={s.btnApprove} disabled={busy} onClick={() => approveRequest(req)}>{busy ? '...' : 'Approve'}</button>
              <button style={s.btnDeny} disabled={busy} onClick={() => denyRequest(req)}>{busy ? '...' : 'Deny'}</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Layout session={session} userProfile={userProfile} currentPage="time-off" onNavigate={onNavigate}>
      <div style={s.page}>
        <div style={s.title}>Time Off</div>
        {!isMobile && <div style={s.sub}>Manage employee time off requests and entitlements.</div>}

        <div style={s.subNav}>
          <button style={s.subTab(subView === 'requests')} onClick={() => setSubView('requests')}>Requests</button>
          <button style={s.subTab(subView === 'balances')} onClick={() => setSubView('balances')}>Balances</button>
          <button style={s.subTab(subView === 'calendar')} onClick={() => setSubView('calendar')}>Calendar</button>
          <button style={s.subTab(subView === 'holidays')} onClick={() => setSubView('holidays')}>Holidays</button>
        </div>

        {/* ── REQUESTS ── */}
        {subView === 'requests' && (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select style={{ ...s.inp, padding: '7px 10px', flex: isMobile ? 1 : 'none' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="denied">Denied</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {allEmployees.length > 0 && (
                <select style={{ ...s.inp, padding: '7px 10px', flex: isMobile ? 1 : 'none', minWidth: isMobile ? 0 : '160px' }} value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
                  <option value="">All employees</option>
                  {allEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                </select>
              )}
              {(filterStatus !== 'all' || filterEmployee) && (
                <button style={{ ...s.btnCancel, padding: '6px 10px', fontSize: '12px' }} onClick={() => { setFilterStatus('all'); setFilterEmployee('') }}>
                  Clear
                </button>
              )}
              <span style={{ fontSize: '12px', color: '#a8a8a4', marginLeft: 'auto' }}>
                {displayRequests.length} result{displayRequests.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              [1,2,3].map(i => (
                <div key={i} style={{ background: '#fff', border: '1px solid #ebebe8', borderRadius: '10px', padding: '16px', marginBottom: '10px' }}>
                  <SkeletonLine width="55%" height="13px" />
                </div>
              ))
            ) : displayRequests.length === 0 ? (
              <div style={{ ...s.empty, border: '1px solid #ebebe8', borderRadius: '10px', background: '#fff' }}>
                {requests.length === 0 ? 'No time off requests yet.' : 'No requests match your filters.'}
              </div>
            ) : isMobile ? (
              displayRequests.map(req => <RequestCard key={req.id} req={req} />)
            ) : (
              <div style={s.card}>
                <div style={s.tHead(REQ_COLS)}>
                  <div style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('employee_name')}>Employee<SortIndicator field="employee_name" /></div>
                  <div style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('start_date')}>Dates<SortIndicator field="start_date" /></div>
                  <div>Type</div>
                  <div style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('business_days')}>Days<SortIndicator field="business_days" /></div>
                  <div style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('status')}>Status<SortIndicator field="status" /></div>
                  <div>After approval</div>
                  <div>Actions</div>
                </div>
                {displayRequests.map(req => {
                  const remaining = getRemainingAfterApproval(req)
                  const overlapNames = getOverlapNames(req)
                  const busy = reviewingId === req.id
                  return (
                    <div key={req.id}>
                      <div style={s.tRow(REQ_COLS)}>
                        <div>
                          <div style={{ fontWeight: 500 }}>{req.employee?.full_name || '—'}</div>
                          {overlapNames.length > 0 && (
                            <div style={{ fontSize: '11px', color: '#d4901a', marginTop: '2px' }}>{overlapNames.join(', ')} also off</div>
                          )}
                        </div>
                        <div style={{ color: '#5f5f5c', fontSize: '12px' }}>{fmtDateRange(req.start_date, req.end_date)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#5f5f5c', fontSize: '12px' }}>
                          <TypeIcon type={req.type} size={12} />{TYPE_LABELS[req.type]}
                        </div>
                        <div>{req.business_days}d{req.is_half_day ? <span style={{ fontSize: '10px', color: '#8a8a86' }}> ½</span> : null}</div>
                        <div><StatusPill status={req.status} /></div>
                        <div>
                          {req.status === 'pending' && remaining != null ? (
                            <span style={{ color: remaining < 0 ? '#c74848' : '#5f5f5c', fontWeight: remaining < 0 ? 500 : 400, fontSize: '13px' }}>{remaining}d</span>
                          ) : '—'}
                        </div>
                        <div>
                          {req.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button style={{ ...s.btnApprove, flex: 'none', padding: '5px 11px', fontSize: '12px' }} disabled={busy} onClick={() => approveRequest(req)}>{busy ? '...' : 'Approve'}</button>
                              <button style={{ ...s.btnDeny, flex: 'none', padding: '5px 11px', fontSize: '12px' }} disabled={busy} onClick={() => denyRequest(req)}>{busy ? '...' : 'Deny'}</button>
                            </div>
                          )}
                          {req.status !== 'pending' && req.review_notes && (
                            <div style={{ fontSize: '11px', color: '#8a8a86', fontStyle: 'italic', maxWidth: '160px' }}>{req.review_notes}</div>
                          )}
                        </div>
                      </div>
                      {req.status === 'pending' && (
                        <div style={{ padding: '0 16px 12px', borderBottom: '1px solid #f0efeb' }}>
                          <input
                            style={{ ...s.inp, width: '340px' }}
                            placeholder="Review notes (optional)"
                            value={reviewNotes[req.id] || ''}
                            onChange={e => setReviewNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── BALANCES ── */}
        {subView === 'balances' && (
          loading ? (
            [1,2,3].map(i => <div key={i} style={{ background: '#fff', border: '1px solid #ebebe8', borderRadius: '10px', padding: '16px', marginBottom: '10px' }}><SkeletonLine width="50%" height="13px" /></div>)
          ) : balances.length === 0 ? (
            <div style={{ ...s.empty, border: '1px solid #ebebe8', borderRadius: '10px', background: '#fff' }}>No employees found.</div>
          ) : isMobile ? (
            <div>
              {balances.map(row => {
                const total = row.balance ? Number(row.balance.total_days) : 0
                const used = row.balance ? Number(row.balance.used_days) : 0
                const pending = row.pendingDays
                const remaining = total - used - pending
                const isEditing = editingBalanceId === row.employee.id
                const isExpanded = expandedEmployeeId === row.employee.id
                return (
                  <div key={row.employee.id} style={{ background: '#fff', border: '1px solid #ebebe8', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setExpandedEmployeeId(isExpanded ? null : row.employee.id)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>{row.employee.full_name}</div>
                          <div style={{ fontSize: '11px', color: '#a8a8a4' }}>{row.employee.email}</div>
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 600, color: remaining < 0 ? '#c74848' : '#1a1a1a' }}>{remaining}d</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px' }}>
                        <div style={{ background: '#fafaf9', borderRadius: '6px', padding: '8px 10px' }}>
                          <div style={{ color: '#8a8a86', marginBottom: '2px' }}>Total</div>
                          <div style={{ fontWeight: 500 }} onClick={e => { e.stopPropagation(); setEditingBalanceId(row.employee.id); setEditTotalDays(String(total)) }}>
                            {isEditing ? (
                              <input style={{ ...s.inp, width: '56px', padding: '2px 6px', fontSize: '13px' }} type="number" min="0" step="0.5"
                                value={editTotalDays} onChange={e => setEditTotalDays(e.target.value)}
                                onClick={e => e.stopPropagation()} autoFocus />
                            ) : `${total}d`}
                          </div>
                        </div>
                        <div style={{ background: '#fafaf9', borderRadius: '6px', padding: '8px 10px' }}>
                          <div style={{ color: '#8a8a86', marginBottom: '2px' }}>Used</div>
                          <div style={{ fontWeight: 500 }}>{used}d</div>
                        </div>
                        <div style={{ background: '#fafaf9', borderRadius: '6px', padding: '8px 10px' }}>
                          <div style={{ color: '#8a8a86', marginBottom: '2px' }}>Pending</div>
                          <div style={{ fontWeight: 500, color: pending > 0 ? '#d4901a' : '#a8a8a4' }}>{pending > 0 ? `${pending}d` : '—'}</div>
                        </div>
                      </div>
                      {isEditing && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                          <button style={{ ...s.btnSave, padding: '7px 16px' }} disabled={savingBalanceId === row.employee.id} onClick={() => saveTotalDays(row)}>
                            {savingBalanceId === row.employee.id ? '...' : 'Save'}
                          </button>
                          <button style={s.btnCancel} onClick={() => setEditingBalanceId(null)}>Cancel</button>
                        </div>
                      )}
                    </div>
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #ebebe8', background: '#fafaf9' }}>
                        {row.requests.length === 0 ? (
                          <div style={{ padding: '12px 16px', fontSize: '12px', color: '#a8a8a4' }}>No requests.</div>
                        ) : row.requests.map(req => (
                          <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f0efeb', fontSize: '12px', color: '#5f5f5c' }}>
                            <div>
                              <div>{fmtDateRange(req.start_date, req.end_date)}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}><TypeIcon type={req.type} size={11} />{TYPE_LABELS[req.type]} · {req.business_days}d</div>
                            </div>
                            <StatusPill status={req.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={s.card}>
              <div style={s.tHead(BAL_COLS)}>
                <div>Employee</div><div>Total ({CURRENT_YEAR})</div><div>Used</div>
                <div>Pending</div><div>Remaining</div><div></div>
              </div>
              {balances.map(row => {
                const total = row.balance ? Number(row.balance.total_days) : 0
                const used = row.balance ? Number(row.balance.used_days) : 0
                const pending = row.pendingDays
                const remaining = total - used - pending
                const isEditing = editingBalanceId === row.employee.id
                const isExpanded = expandedEmployeeId === row.employee.id
                return (
                  <div key={row.employee.id}>
                    <div
                      style={{ ...s.tRow(BAL_COLS), cursor: 'pointer', background: isExpanded ? '#fafaf9' : '#fff' }}
                      onClick={() => setExpandedEmployeeId(isExpanded ? null : row.employee.id)}
                    >
                      <div>
                        <div style={{ fontWeight: 500 }}>{row.employee.full_name}</div>
                        <div style={{ fontSize: '11px', color: '#a8a8a4' }}>{row.employee.email}</div>
                      </div>
                      <div onClick={e => e.stopPropagation()}>
                        {isEditing ? (
                          <input style={{ ...s.inp, width: '64px' }} type="number" min="0" step="0.5" value={editTotalDays} onChange={e => setEditTotalDays(e.target.value)} onClick={e => e.stopPropagation()} autoFocus />
                        ) : `${total}d`}
                      </div>
                      <div>{used}d</div>
                      <div style={{ color: pending > 0 ? '#d4901a' : '#a8a8a4' }}>{pending > 0 ? `${pending}d` : '—'}</div>
                      <div style={{ fontWeight: 500, color: remaining < 0 ? '#c74848' : '#1a1a1a' }}>{remaining}d</div>
                      <div onClick={e => e.stopPropagation()}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button style={s.btnSave} disabled={savingBalanceId === row.employee.id} onClick={() => saveTotalDays(row)}>
                              {savingBalanceId === row.employee.id ? '...' : 'Save'}
                            </button>
                            <button style={s.btnCancel} onClick={() => setEditingBalanceId(null)}>✕</button>
                          </div>
                        ) : (
                          <button style={s.btnEdit} onClick={() => { setEditingBalanceId(row.employee.id); setEditTotalDays(String(total)) }}>Edit</button>
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ background: '#fafaf9', borderBottom: '1px solid #ebebe8' }}>
                        {row.requests.length === 0 ? (
                          <div style={{ padding: '14px 24px', fontSize: '12px', color: '#a8a8a4' }}>No requests.</div>
                        ) : row.requests.map(req => (
                          <div key={req.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px 100px', padding: '10px 24px', borderBottom: '1px solid #f0efeb', fontSize: '12px', color: '#5f5f5c', alignItems: 'center' }}>
                            <div>{fmtDateRange(req.start_date, req.end_date)}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><TypeIcon type={req.type} size={11} />{TYPE_LABELS[req.type]}</div>
                            <div>{req.business_days}d</div>
                            <div><StatusPill status={req.status} /></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── CALENDAR ── */}
        {subView === 'calendar' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <button style={s.navBtn} onClick={prevMonth}>‹</button>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a', minWidth: isMobile ? '120px' : '160px', textAlign: 'center' }}>
                {MONTH_NAMES[calMonth]} {calYear}
              </div>
              <button style={s.navBtn} onClick={nextMonth}>›</button>
              <button style={{ ...s.navBtn, marginLeft: '8px', fontSize: '12px', color: '#8a8a86' }} onClick={() => { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()) }}>
                Today
              </button>
            </div>

            {!isMobile && (
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#8a8a86' }}>Each employee has a unique colour.</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5f5f5c' }}>
                  <div style={{ width: '28px', height: '14px', borderRadius: '3px', background: '#dcfce7' }} />Approved
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5f5f5c' }}>
                  <div style={{ width: '28px', height: '14px', borderRadius: '3px', background: '#fef3c780', border: '1.5px dashed #b45309' }} />Pending
                </div>
              </div>
            )}

            <div style={{ overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ ...s.card, overflow: 'visible', minWidth: isMobile ? '560px' : 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #ebebe8' }}>
                  {DOW_LABELS.map(d => (
                    <div key={d} style={{ padding: isMobile ? '6px 4px' : '8px 10px', fontSize: '11px', fontWeight: 500, color: '#8a8a86', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'center', borderRight: '1px solid #ebebe8' }}>
                      {isMobile ? d.slice(0, 1) : d}
                    </div>
                  ))}
                </div>

                {loading ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <SkeletonLine width="100%" height="200px" />
                  </div>
                ) : (() => {
                  const cells = buildCalendarDays(calYear, calMonth)
                  const weeks = []
                  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

                  return weeks.map((week, wi) => {
                    const weekDates = week.map(day => day ? `${calYear}-${pad(calMonth + 1)}-${pad(day)}` : null)
                    const { assignments, trackCount } = getWeekEventLayout(weekDates, requests)
                    const eventsH = trackCount * SLOT_H + (trackCount > 0 ? 8 : 6)

                    return (
                      <div key={wi} style={{ borderBottom: wi < weeks.length - 1 ? '1px solid #ebebe8' : 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                          {week.map((day, di) => {
                            const dateStr = weekDates[di]
                            const isToday = dateStr === TODAY
                            const isWeekend = di === 0 || di === 6
                            return (
                              <div key={di} style={{
                                height: DATE_ROW_H,
                                padding: '5px 8px',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                alignItems: 'flex-start',
                                background: !day ? '#fafaf9' : isWeekend ? '#fafaf9' : '#fff',
                                borderRight: di < 6 ? '1px solid #ebebe8' : 'none',
                              }}>
                                {day && (isToday ? (
                                  <span style={{ background: '#0070CA', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                                    {day}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '12px', color: isWeekend ? '#a8a8a4' : '#5f5f5c' }}>{day}</span>
                                ))}
                              </div>
                            )
                          })}
                        </div>

                        <div style={{ position: 'relative', height: eventsH }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: '100%', position: 'absolute', inset: 0 }}>
                            {week.map((day, di) => (
                              <div key={di} style={{
                                background: !day ? '#fafaf9' : (di === 0 || di === 6) ? '#fafaf9' : '#fff',
                                borderRight: di < 6 ? '1px solid #ebebe8' : 'none',
                              }} />
                            ))}
                          </div>

                          {assignments.map(({ req, track, startCol, endCol, startsThisWeek, endsThisWeek }) => {
                            const color = employeeColor(req.employee_id)
                            const isPending = req.status === 'pending'
                            const firstName = req.employee?.full_name?.split(' ')[0] || '?'
                            const colPct = 100 / 7
                            const leftPct = startCol * colPct
                            const widthPct = (endCol - startCol + 1) * colPct
                            const lOff = startsThisWeek ? 2 : 0
                            const rOff = endsThisWeek ? 2 : 0
                            return (
                              <div
                                key={`${req.id}-${wi}`}
                                title={`${req.employee?.full_name} — ${TYPE_LABELS[req.type]}${isPending ? ' (pending)' : ''}\n${fmtDateRange(req.start_date, req.end_date)}, ${req.business_days}d`}
                                style={{
                                  position: 'absolute',
                                  top: track * SLOT_H + 4,
                                  left: `calc(${leftPct}% + ${lOff}px)`,
                                  width: `calc(${widthPct}% - ${lOff + rOff}px)`,
                                  height: EVENT_H,
                                  background: isPending ? `${color.bg}cc` : color.bg,
                                  color: color.text,
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  display: 'flex',
                                  alignItems: 'center',
                                  paddingLeft: '5px',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  borderRadius: `${startsThisWeek ? 3 : 0}px ${endsThisWeek ? 3 : 0}px ${endsThisWeek ? 3 : 0}px ${startsThisWeek ? 3 : 0}px`,
                                  border: isPending ? `1.5px dashed ${color.text}` : 'none',
                                  opacity: isPending ? 0.85 : 1,
                                  zIndex: 1,
                                }}
                              >
                                {firstName}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── HOLIDAYS ── */}
        {subView === 'holidays' && (
          <div>
            <div style={s.card}>
              {holidaysLoading ? (
                [1,2,3].map(i => <div key={i} style={{ padding: '16px', borderBottom: '1px solid #f0efeb' }}><SkeletonLine width="50%" height="13px" /></div>)
              ) : holidays.length === 0 ? (
                <div style={s.empty}>No holidays configured yet.</div>
              ) : (
                <>
                  {!isMobile && (
                    <div style={s.tHead('1fr 100px 100px 48px')}>
                      <div>Name</div><div>Date</div><div>Repeats yearly</div><div></div>
                    </div>
                  )}
                  {holidays.map(h => isMobile ? (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #f0efeb' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>{h.name}</div>
                        <div style={{ fontSize: '12px', color: '#8a8a86', marginTop: '2px' }}>
                          {fmtDate(h.date)}{h.repeats_yearly ? ' · Repeats yearly' : ''}
                        </div>
                      </div>
                      <button style={{ ...s.btnDeny, flex: 'none', padding: '5px 10px', fontSize: '12px' }} disabled={deletingHolidayId === h.id} onClick={() => deleteHoliday(h.id)}>
                        {deletingHolidayId === h.id ? '...' : 'Remove'}
                      </button>
                    </div>
                  ) : (
                    <div key={h.id} style={s.tRow('1fr 100px 100px 48px')}>
                      <div style={{ fontWeight: 500 }}>{h.name}</div>
                      <div style={{ color: '#5f5f5c', fontSize: '12px' }}>{fmtDate(h.date)}</div>
                      <div style={{ fontSize: '12px', color: h.repeats_yearly ? '#2d7a4a' : '#a8a8a4' }}>{h.repeats_yearly ? 'Yes' : 'No'}</div>
                      <div>
                        <button style={{ ...s.btnDeny, flex: 'none', padding: '3px 8px', fontSize: '11px' }} disabled={deletingHolidayId === h.id} onClick={() => deleteHoliday(h.id)}>
                          {deletingHolidayId === h.id ? '...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #ebebe8', borderRadius: '10px', padding: '20px', marginTop: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a', marginBottom: '14px' }}>Add holiday</div>
              <div style={{ display: isMobile ? 'flex' : 'grid', flexDirection: isMobile ? 'column' : undefined, gridTemplateColumns: isMobile ? undefined : '1fr 140px auto', gap: '10px', alignItems: isMobile ? 'stretch' : 'flex-end' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#8a8a86', display: 'block', marginBottom: '5px' }}>Name</label>
                  <input style={{ ...s.inp, width: '100%', padding: '8px 10px', boxSizing: 'border-box' }} placeholder="e.g. Canada Day" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#8a8a86', display: 'block', marginBottom: '5px' }}>Date</label>
                  <input type="date" style={{ ...s.inp, width: '100%', padding: '8px 10px', boxSizing: 'border-box' }} value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} />
                </div>
                <button style={{ ...s.btnSave, padding: '9px 16px', alignSelf: isMobile ? 'flex-start' : 'flex-end' }} disabled={savingHoliday} onClick={addHoliday}>
                  {savingHoliday ? '...' : 'Add'}
                </button>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '13px', color: '#5f5f5c', cursor: 'pointer' }}>
                <input type="checkbox" checked={newHolidayRepeats} onChange={e => setNewHolidayRepeats(e.target.checked)} style={{ width: '14px', height: '14px', cursor: 'pointer' }} />
                Repeats yearly
              </label>
            </div>
          </div>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </Layout>
  )
}
