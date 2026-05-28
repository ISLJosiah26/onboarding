/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import { SkeletonLine } from '../components/Skeleton'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import { handleSupabaseError } from '../utils/handleError'

const CURRENT_YEAR = new Date().getFullYear()
const TODAY = new Date().toISOString().slice(0, 10)

const TYPE_LABELS = { vacation: 'Vacation', sick: 'Sick Day', personal: 'Personal', other: 'Other' }

const STATUS_STYLES = {
  pending:   { background: '#fffbf0', color: '#d4901a' },
  approved:  { background: '#f0faf4', color: '#2d7a4a' },
  denied:    { background: '#fdf0f0', color: '#c74848' },
  cancelled: { background: '#f4f3f1', color: '#8a8a86' },
}

// Deterministic colour per employee — no blue, since blue is reserved for today + UI accents
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
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => { fetchData() }, [subView])

  async function fetchData() {
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

    const { data: bals } = await supabase
      .from('time_off_balances')
      .select('*')
      .eq('year', CURRENT_YEAR)
    setReqBalances(bals || [])
  }

  async function fetchBalances() {
    const { data: emps, error: empsErr } = await supabase
      .from('employees')
      .select('id, full_name, email')
      .order('full_name')
    if (empsErr) { showToast(handleSupabaseError(empsErr, 'Failed to load employees.'), 'error'); return }

    const { data: bals } = await supabase
      .from('time_off_balances')
      .select('*')
      .eq('year', CURRENT_YEAR)

    const { data: reqs } = await supabase
      .from('time_off_requests')
      .select('*')

    const balMap = {}
    if (bals) bals.forEach(b => { balMap[b.employee_id] = b })

    const reqsByEmp = {}
    if (reqs) reqs.forEach(r => {
      if (!reqsByEmp[r.employee_id]) reqsByEmp[r.employee_id] = []
      reqsByEmp[r.employee_id].push(r)
    })

    const rows = (emps || []).map(emp => {
      const bal = balMap[emp.id] || null
      const empReqs = (reqsByEmp[emp.id] || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      const pendingDays = empReqs.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.business_days), 0)
      return { employee: emp, balance: bal, pendingDays, requests: empReqs }
    })

    setBalances(rows)
  }

  function getBalForEmployee(employeeId) {
    return reqBalances.find(b => b.employee_id === employeeId) || null
  }

  function getOverlapCount(req) {
    return requests.filter(r =>
      r.id !== req.id &&
      r.status === 'approved' &&
      r.employee_id !== req.employee_id &&
      r.start_date <= req.end_date &&
      r.end_date >= req.start_date
    ).length
  }

  function getRemainingAfterApproval(req) {
    const bal = getBalForEmployee(req.employee_id)
    if (!bal) return null
    const otherPendingDays = requests
      .filter(r => r.id !== req.id && r.employee_id === req.employee_id && r.status === 'pending')
      .reduce((s, r) => s + Number(r.business_days), 0)
    return Number(bal.total_days) - Number(bal.used_days) - otherPendingDays - Number(req.business_days)
  }

  async function approveRequest(req) {
    setReviewingId(req.id)
    const notes = reviewNotes[req.id] || ''
    const bal = getBalForEmployee(req.employee_id)

    if (bal) {
      const { error: balErr } = await supabase
        .from('time_off_balances')
        .update({ used_days: Number(bal.used_days) + Number(req.business_days), updated_at: new Date().toISOString() })
        .eq('id', bal.id)
      if (balErr) { showToast(handleSupabaseError(balErr, 'Failed to update balance.'), 'error'); setReviewingId(null); return }
    } else {
      const { error: balErr } = await supabase
        .from('time_off_balances')
        .insert({ employee_id: req.employee_id, year: CURRENT_YEAR, total_days: 0, used_days: Number(req.business_days) })
      if (balErr) { showToast(handleSupabaseError(balErr, 'Failed to create balance.'), 'error'); setReviewingId(null); return }
    }

    const { error } = await supabase
      .from('time_off_requests')
      .update({ status: 'approved', review_notes: notes || null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', req.id)
    if (error) { showToast(handleSupabaseError(error, 'Failed to approve request.'), 'error'); setReviewingId(null); return }

    if (req.employee?.email) {
      await supabase.functions.invoke('send-email', {
        body: {
          to: req.employee.email,
          subject: 'Your time off request has been approved',
          html: `<p>Hi ${req.employee.full_name},</p>
<p>Your time off request has been <strong>approved</strong>.</p>
<p><strong>Dates:</strong> ${fmtDateRange(req.start_date, req.end_date)}<br/>
<strong>Type:</strong> ${TYPE_LABELS[req.type]}<br/>
<strong>Business days:</strong> ${req.business_days}${notes ? `<br/><strong>Notes:</strong> ${notes}` : ''}</p>
<p>Enjoy your time off!</p>`
        }
      })
    }

    showToast('Request approved.')
    setReviewingId(null)
    await fetchData()
  }

  async function denyRequest(req) {
    setReviewingId(req.id)
    const notes = reviewNotes[req.id] || ''

    const { error } = await supabase
      .from('time_off_requests')
      .update({ status: 'denied', review_notes: notes || null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', req.id)
    if (error) { showToast(handleSupabaseError(error, 'Failed to deny request.'), 'error'); setReviewingId(null); return }

    if (req.employee?.email) {
      await supabase.functions.invoke('send-email', {
        body: {
          to: req.employee.email,
          subject: 'Your time off request has been denied',
          html: `<p>Hi ${req.employee.full_name},</p>
<p>Your time off request has been <strong>denied</strong>.</p>
<p><strong>Dates:</strong> ${fmtDateRange(req.start_date, req.end_date)}<br/>
<strong>Type:</strong> ${TYPE_LABELS[req.type]}<br/>
<strong>Business days:</strong> ${req.business_days}${notes ? `<br/><strong>Reason:</strong> ${notes}` : ''}</p>
<p>Please reach out to HR if you have questions.</p>`
        }
      })
    }

    showToast('Request denied.')
    setReviewingId(null)
    await fetchData()
  }

  async function saveTotalDays(row) {
    const val = parseFloat(editTotalDays)
    if (isNaN(val) || val < 0) { showToast('Enter a valid number of days.', 'error'); return }
    setSavingBalanceId(row.employee.id)

    if (row.balance) {
      const { error } = await supabase
        .from('time_off_balances')
        .update({ total_days: val, updated_at: new Date().toISOString() })
        .eq('id', row.balance.id)
      if (error) { showToast(handleSupabaseError(error, 'Failed to update.'), 'error'); setSavingBalanceId(null); return }
    } else {
      const { error } = await supabase
        .from('time_off_balances')
        .insert({ employee_id: row.employee.id, year: CURRENT_YEAR, total_days: val, used_days: 0 })
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

  const s = {
    page: { padding: '32px 40px', maxWidth: '1000px' },
    title: { fontSize: '20px', fontWeight: 600, letterSpacing: '-0.3px', color: '#1a1a1a', marginBottom: '4px' },
    sub: { fontSize: '13px', color: '#8a8a86', marginBottom: '28px' },
    subNav: { display: 'flex', borderBottom: '1px solid #ebebe8', marginBottom: '24px' },
    subTab: (a) => ({ fontSize: '13px', fontWeight: a ? 500 : 400, color: a ? '#1a1a1a' : '#8a8a86', padding: '10px 0', marginRight: '24px', background: 'none', border: 'none', borderBottom: a ? '2px solid #1a1a1a' : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit' }),
    card: { background: '#fff', border: '1px solid #ebebe8', borderRadius: '10px', overflow: 'hidden' },
    tHead: (cols) => ({ display: 'grid', gridTemplateColumns: cols, padding: '10px 16px', background: '#fafaf9', borderBottom: '1px solid #ebebe8', fontSize: '11px', fontWeight: 500, color: '#8a8a86', textTransform: 'uppercase', letterSpacing: '0.4px' }),
    tRow: (cols) => ({ display: 'grid', gridTemplateColumns: cols, padding: '13px 16px', borderBottom: '1px solid #f0efeb', alignItems: 'center', fontSize: '13px', color: '#1a1a1a' }),
    empty: { padding: '40px', textAlign: 'center', fontSize: '13px', color: '#a8a8a4' },
    inp: { background: '#fff', border: '1px solid #ebebe8', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', color: '#1a1a1a', fontFamily: 'Inter, -apple-system, sans-serif', outline: 'none', boxSizing: 'border-box' },
    btnApprove: { background: '#f0faf4', color: '#2d7a4a', border: '1px solid #c3e8d1', borderRadius: '6px', padding: '5px 11px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    btnDeny: { background: '#fdf0f0', color: '#c74848', border: '1px solid #f5d6d6', borderRadius: '6px', padding: '5px 11px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    btnEdit: { background: 'transparent', color: '#5f5f5c', border: '1px solid #ebebe8', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' },
    btnSave: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 11px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    btnCancel: { background: 'transparent', color: '#8a8a86', border: '1px solid #ebebe8', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' },
    navBtn: { background: 'transparent', border: '1px solid #ebebe8', borderRadius: '6px', padding: '5px 10px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', color: '#5f5f5c', lineHeight: 1 },
  }

  const REQ_COLS = '1.4fr 1fr 80px 60px 100px 80px 180px'
  const BAL_COLS = '1.6fr 90px 90px 90px 90px 100px'

  return (
    <Layout session={session} userProfile={userProfile} currentPage="time-off" onNavigate={onNavigate}>
      <div style={s.page}>
        <div style={s.title}>Time Off</div>
        <div style={s.sub}>Manage employee time off requests and entitlements.</div>

        <div style={s.subNav}>
          <button style={s.subTab(subView === 'requests')} onClick={() => setSubView('requests')}>Requests</button>
          <button style={s.subTab(subView === 'balances')} onClick={() => setSubView('balances')}>Balances</button>
          <button style={s.subTab(subView === 'calendar')} onClick={() => setSubView('calendar')}>Calendar</button>
        </div>

        {/* ── REQUESTS ── */}
        {subView === 'requests' && (
          <div style={s.card}>
            <div style={s.tHead(REQ_COLS)}>
              <div>Employee</div><div>Dates</div><div>Type</div><div>Days</div>
              <div>Status</div><div>After approval</div><div>Actions</div>
            </div>
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} style={{ padding: '16px', borderBottom: '1px solid #f0efeb' }}>
                  <SkeletonLine width="55%" height="13px" />
                </div>
              ))
            ) : requests.length === 0 ? (
              <div style={s.empty}>No time off requests yet.</div>
            ) : (
              requests.map(req => {
                const remaining = getRemainingAfterApproval(req)
                const overlapCount = getOverlapCount(req)
                const busy = reviewingId === req.id
                return (
                  <div key={req.id}>
                    <div style={s.tRow(REQ_COLS)}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{req.employee?.full_name || '—'}</div>
                        {overlapCount > 0 && (
                          <div style={{ fontSize: '11px', color: '#d4901a', marginTop: '2px' }}>
                            {overlapCount} other{overlapCount !== 1 ? 's' : ''} already approved off
                          </div>
                        )}
                      </div>
                      <div style={{ color: '#5f5f5c' }}>{fmtDateRange(req.start_date, req.end_date)}</div>
                      <div style={{ color: '#5f5f5c' }}>{TYPE_LABELS[req.type]}</div>
                      <div>{req.business_days}d</div>
                      <div><StatusPill status={req.status} /></div>
                      <div>
                        {req.status === 'pending' && remaining != null ? (
                          <span style={{ color: remaining < 0 ? '#c74848' : '#5f5f5c', fontWeight: remaining < 0 ? 500 : 400 }}>
                            {remaining}d
                          </span>
                        ) : '—'}
                      </div>
                      <div>
                        {req.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button style={s.btnApprove} disabled={busy} onClick={() => approveRequest(req)}>
                              {busy ? '...' : 'Approve'}
                            </button>
                            <button style={s.btnDeny} disabled={busy} onClick={() => denyRequest(req)}>
                              {busy ? '...' : 'Deny'}
                            </button>
                          </div>
                        )}
                        {req.status !== 'pending' && req.review_notes && (
                          <div style={{ fontSize: '11px', color: '#8a8a86', fontStyle: 'italic', maxWidth: '160px' }}>
                            {req.review_notes}
                          </div>
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
              })
            )}
          </div>
        )}

        {/* ── BALANCES ── */}
        {subView === 'balances' && (
          <div style={s.card}>
            <div style={s.tHead(BAL_COLS)}>
              <div>Employee</div><div>Total ({CURRENT_YEAR})</div><div>Used</div>
              <div>Pending</div><div>Remaining</div><div></div>
            </div>
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} style={{ padding: '16px', borderBottom: '1px solid #f0efeb' }}>
                  <SkeletonLine width="50%" height="13px" />
                </div>
              ))
            ) : balances.length === 0 ? (
              <div style={s.empty}>No employees found.</div>
            ) : (
              balances.map(row => {
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
                          <input
                            style={{ ...s.inp, width: '64px' }}
                            type="number" min="0" step="0.5"
                            value={editTotalDays}
                            onChange={e => setEditTotalDays(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            autoFocus
                          />
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
                          <button style={s.btnEdit} onClick={() => { setEditingBalanceId(row.employee.id); setEditTotalDays(String(total)) }}>
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ background: '#fafaf9', borderBottom: '1px solid #ebebe8' }}>
                        {row.requests.length === 0 ? (
                          <div style={{ padding: '14px 24px', fontSize: '12px', color: '#a8a8a4' }}>No requests.</div>
                        ) : (
                          row.requests.map(req => (
                            <div key={req.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px 100px', padding: '10px 24px', borderBottom: '1px solid #f0efeb', fontSize: '12px', color: '#5f5f5c', alignItems: 'center' }}>
                              <div>{fmtDateRange(req.start_date, req.end_date)}</div>
                              <div>{TYPE_LABELS[req.type]}</div>
                              <div>{req.business_days}d</div>
                              <div><StatusPill status={req.status} /></div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── CALENDAR ── */}
        {subView === 'calendar' && (
          <div>
            {/* Month navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <button style={s.navBtn} onClick={prevMonth}>‹</button>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a', minWidth: '160px', textAlign: 'center' }}>
                {MONTH_NAMES[calMonth]} {calYear}
              </div>
              <button style={s.navBtn} onClick={nextMonth}>›</button>
              <button
                style={{ ...s.navBtn, marginLeft: '8px', fontSize: '12px', color: '#8a8a86' }}
                onClick={() => { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()) }}
              >
                Today
              </button>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', color: '#8a8a86' }}>Each employee has a unique colour.</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5f5f5c' }}>
                <div style={{ width: '28px', height: '14px', borderRadius: '3px', background: '#dcfce7' }} />
                Approved
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5f5f5c' }}>
                <div style={{ width: '28px', height: '14px', borderRadius: '3px', background: '#fef3c780', border: '1.5px dashed #b45309' }} />
                Pending
              </div>
            </div>

            <div style={{ ...s.card, overflow: 'visible' }}>
              {/* Day-of-week header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #ebebe8' }}>
                {DOW_LABELS.map(d => (
                  <div key={d} style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 500, color: '#8a8a86', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'center', borderRight: '1px solid #ebebe8' }}>
                    {d}
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

                return weeks.map((week, wi) => (
                  <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: wi < weeks.length - 1 ? '1px solid #ebebe8' : 'none' }}>
                    {week.map((day, di) => {
                      if (!day) return (
                        <div key={di} style={{ minHeight: '90px', background: '#fafaf9', borderRight: di < 6 ? '1px solid #ebebe8' : 'none' }} />
                      )

                      const dateStr = `${calYear}-${pad(calMonth + 1)}-${pad(day)}`
                      const isToday = dateStr === TODAY
                      const isWeekend = (di === 0 || di === 6)

                      const dayReqs = requests.filter(r =>
                        (r.status === 'approved' || r.status === 'pending') &&
                        r.start_date <= dateStr && r.end_date >= dateStr
                      )

                      return (
                        <div key={di} style={{
                          minHeight: '90px',
                          padding: '6px',
                          background: isToday ? '#f0f7ff' : isWeekend ? '#fafaf9' : '#fff',
                          borderRight: di < 6 ? '1px solid #ebebe8' : 'none',
                          verticalAlign: 'top',
                        }}>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: isToday ? 700 : 400,
                            color: isToday ? '#0070CA' : isWeekend ? '#a8a8a4' : '#5f5f5c',
                            textAlign: 'right',
                            marginBottom: '4px',
                            lineHeight: 1,
                          }}>
                            {isToday ? (
                              <span style={{ background: '#0070CA', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
                                {day}
                              </span>
                            ) : day}
                          </div>
                          {dayReqs.map(req => {
                            const color = employeeColor(req.employee_id)
                            const isPending = req.status === 'pending'
                            const firstName = req.employee?.full_name?.split(' ')[0] || '?'
                            return (
                              <div key={req.id} title={`${req.employee?.full_name} — ${TYPE_LABELS[req.type]}${isPending ? ' (pending)' : ''}`} style={{
                                background: isPending ? `${color.bg}99` : color.bg,
                                color: color.text,
                                fontSize: '11px',
                                fontWeight: 500,
                                padding: '2px 5px',
                                borderRadius: '3px',
                                marginBottom: '2px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                border: isPending ? `1px dashed ${color.text}` : 'none',
                                opacity: isPending ? 0.8 : 1,
                              }}>
                                {firstName}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))
              })()}
            </div>
          </div>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </Layout>
  )
}
