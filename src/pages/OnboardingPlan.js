/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'

const PHASES = ['Week 1', 'Week 2', '30 Day', '60 Day', '90 Day']

export default function OnboardingPlan({ session, instanceId, onBack, onNavigate }) {
  const [instance, setInstance] = useState(null)
  const [tasksByPhase, setTasksByPhase] = useState({})
  const [completions, setCompletions] = useState({})
  const [notes, setNotes] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [documents, setDocuments] = useState([])
  const [docCompletions, setDocCompletions] = useState({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchPlan()
    fetchDocuments()
  }, [instanceId])

  async function fetchPlan() {
    const { data, error } = await supabase
      .from('onboarding_instances')
      .select(`
        id, status,
        employees (id, full_name, email, hire_date, roles (name)),
        task_completions (
          id, completed, completed_at, notes,
          onboarding_templates (id, task_name, phase, owner)
        )
      `)
      .eq('id', instanceId)
      .single()

    if (error) { console.error(error); return }

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
    const { data: docs } = await supabase.from('documents').select('*')
    if (!docs) return
    setDocuments(docs)

    const { data: inst } = await supabase
      .from('onboarding_instances')
      .select('employees (id)')
      .eq('id', instanceId)
      .single()

    if (!inst) return
    const employeeId = inst.employees.id

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
    await supabase
      .from('task_completions')
      .update({ completed: newVal, completed_at: newVal ? new Date().toISOString() : null })
      .eq('id', completionId)
  }

  async function saveNote(completionId, value) {
    setNotes(prev => ({ ...prev, [completionId]: value }))
    await supabase
      .from('task_completions')
      .update({ notes: value })
      .eq('id', completionId)
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

  async function handleUploadDocument(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)

    const filePath = `documents/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file)

    if (uploadError) { console.error(uploadError.message); setUploading(false); return }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)
    await supabase.from('documents').insert({ name: file.name, file_url: urlData.publicUrl })
    await fetchDocuments()
    setUploading(false)
  }

async function handleMarkComplete() {
  if (!window.confirm('Mark this onboarding as complete?')) return
  await supabase.from('onboarding_instances').update({ status: 'completed' }).eq('id', instanceId)

  await supabase.functions.invoke('send-email', {
    body: {
      to: 'josiah@integratedstaffing.ca',
      subject: `Onboarding complete: ${instance.employees.full_name}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
          <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Onboarding marked complete</h2>
          <p style="font-size: 14px; color: #444; line-height: 1.6;"><strong>${instance.employees.full_name}</strong> has completed their onboarding plan.</p>
          <table style="font-size: 14px; color: #444; margin-top: 16px;">
            <tr><td style="padding: 4px 16px 4px 0; color: #888;">Role</td><td>${instance.employees.roles.name}</td></tr>
            <tr><td style="padding: 4px 16px 4px 0; color: #888;">Started</td><td>${new Date(instance.employees.hire_date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</td></tr>
            <tr><td style="padding: 4px 16px 4px 0; color: #888;">Completed</td><td>${new Date().toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</td></tr>
            <tr><td style="padding: 4px 16px 4px 0; color: #888;">Tasks completed</td><td>${completedTasksCount()} of ${totalTasks()}</td></tr>
          </table>
          <p style="font-size: 13px; color: #888; margin-top: 32px;">Sent by Integrated Launch</p>
        </div>
      `
    }
  })

  onBack()
}

  async function handleArchive() {
    if (!window.confirm('Archive this onboarding?')) return
    await supabase.from('onboarding_instances').update({ status: 'archived' }).eq('id', instanceId)
    onBack()
  }

  function totalTasks() { return Object.values(tasksByPhase).flat().length }
  function completedTasksCount() { return Object.values(completions).filter(Boolean).length }
  function pct() {
    const t = totalTasks()
    return t > 0 ? Math.round((completedTasksCount() / t) * 100) : 0
  }

  const styles = {
    header: { padding: '28px 40px 24px', borderBottom: '1px solid #ebebe8' },
    backLink: { fontSize: '12px', color: '#8a8a86', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' },
    title: { fontSize: '22px', fontWeight: 600, letterSpacing: '-0.4px' },
    sub: { fontSize: '13px', color: '#8a8a86', marginTop: '3px' },
    progressRow: { marginTop: '20px', display: 'flex', alignItems: 'center', gap: '16px' },
    progressTrack: { flex: 1, maxWidth: '320px', height: '4px', background: '#ebebe8', borderRadius: '2px', overflow: 'hidden' },
    progressFill: { height: '100%', background: '#0070CA', transition: 'width 0.3s ease' },
    progressText: { fontSize: '12px', color: '#8a8a86' },
    progressPct: { fontSize: '12px', fontWeight: 500, color: '#0070CA' },
    content: { padding: '32px 40px', maxWidth: '780px' },
    sectionLabel: { fontSize: '11px', fontWeight: 600, color: '#a8a8a4', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    uploadLink: { fontSize: '12px', color: '#0070CA', cursor: 'pointer', fontWeight: 500, textTransform: 'none', letterSpacing: 0 },
    taskRow: { display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0', borderBottom: '1px solid #f0efeb', cursor: 'pointer' },
    checkbox: (checked) => ({
      width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
      border: checked ? 'none' : '1.5px solid #d4d3cf',
      background: checked ? '#0070CA' : '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s',
      cursor: 'pointer'
    }),
    taskName: (checked) => ({
      fontSize: '13px',
      color: checked ? '#a8a8a4' : '#1a1a1a',
      textDecoration: checked ? 'line-through' : 'none',
      flex: 1
    }),
    owner: { fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f4f3f1', color: '#8a8a86', fontWeight: 500 },
    section: { marginBottom: '36px' },
    expandedPanel: { background: '#fafaf9', border: '1px solid #ebebe8', borderRadius: '8px', padding: '14px', marginTop: '2px', marginBottom: '12px' },
    noteLabel: { fontSize: '11px', color: '#8a8a86', marginBottom: '6px', fontWeight: 500 },
    noteInput: { width: '100%', border: '1px solid #ebebe8', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#1a1a1a', resize: 'vertical', minHeight: '60px', boxSizing: 'border-box' },
    noteHint: { fontSize: '11px', color: '#a8a8a4', marginTop: '6px' },
    noteIndicator: { fontSize: '11px', color: '#0070CA', marginLeft: '4px' },
    footer: { borderTop: '1px solid #ebebe8', padding: '24px 40px', display: 'flex', gap: '8px' },
    btnPrimary: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    btnSecondary: { background: 'transparent', color: '#5f5f5c', border: '1px solid #ebebe8', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
  }

  if (loading) return (
    <Layout session={session} currentPage="dashboard" onNavigate={onNavigate}>
      <div style={{ padding: '80px 40px', color: '#a8a8a4', fontSize: '13px' }}>Loading...</div>
    </Layout>
  )

  return (
    <Layout session={session} currentPage="dashboard" onNavigate={onNavigate}>

      <div style={styles.header}>
        <button style={styles.backLink} onClick={onBack}>
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 2L4 7l5 5"/></svg>
          Back to dashboard
        </button>
        <div style={styles.title}>{instance.employees.full_name}</div>
        <div style={styles.sub}>
          {instance.employees.roles.name} · Started {new Date(instance.employees.hire_date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <div style={styles.progressRow}>
          <span style={styles.progressText}>{completedTasksCount()} of {totalTasks()} tasks complete</span>
          <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${pct()}%` }}></div></div>
          <span style={styles.progressPct}>{pct()}%</span>
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
          {documents.length === 0 && (
            <div style={{ fontSize: '13px', color: '#a8a8a4', padding: '12px 0' }}>No documents in the library yet.</div>
          )}
          {documents.map(doc => {
            const signed = docCompletions[doc.id]?.signed || false
            return (
              <div key={doc.id} style={styles.taskRow} onClick={(e) => toggleDocument(doc.id, e)}>
                <div style={styles.checkbox(signed)}>
                  {signed && <svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div style={styles.taskName(signed)}>{doc.name}</div>
                <a href={doc.file_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '12px', color: '#0070CA', textDecoration: 'none' }}>View</a>
              </div>
            )
          })}
        </div>

        {PHASES.map(phase => {
          const tasks = tasksByPhase[phase] || []
          if (tasks.length === 0) return null
          const phaseComplete = tasks.every(t => completions[t.id])
          return (
            <div key={phase} style={styles.section}>
              <div style={styles.sectionLabel}>
                <span style={{ color: phaseComplete ? '#0070CA' : '#a8a8a4' }}>{phase}</span>
                {phaseComplete && <span style={{ fontSize: '11px', color: '#0070CA', textTransform: 'none', letterSpacing: 0 }}>Complete</span>}
              </div>
              {tasks.map(tc => {
                const isExpanded = expanded === tc.id
                const hasNote = notes[tc.id] && notes[tc.id].trim().length > 0
                return (
                  <div key={tc.id}>
                    <div style={styles.taskRow} onClick={() => setExpanded(isExpanded ? null : tc.id)}>
                      <div style={styles.checkbox(completions[tc.id])} onClick={(e) => toggleTask(tc.id, completions[tc.id], e)}>
                        {completions[tc.id] && <svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <div style={styles.taskName(completions[tc.id])}>
                        {tc.onboarding_templates.task_name}
                        {hasNote && !isExpanded && (
                          <span style={styles.noteIndicator}>· note</span>
                        )}
                      </div>
                      <div style={styles.owner}>{tc.onboarding_templates.owner}</div>
                    </div>
                    {isExpanded && (
                      <div style={styles.expandedPanel} onClick={e => e.stopPropagation()}>
                        <div style={styles.noteLabel}>Note</div>
                        <textarea
                          style={styles.noteInput}
                          value={notes[tc.id] || ''}
                          onChange={e => setNotes(prev => ({ ...prev, [tc.id]: e.target.value }))}
                          onBlur={e => saveNote(tc.id, e.target.value)}
                          placeholder="Add a note about this task..."
                        />
                        <div style={styles.noteHint}>Note saves automatically when you click away.</div>
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
      </div>

    </Layout>
  )
}