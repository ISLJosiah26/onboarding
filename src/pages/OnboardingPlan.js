/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const PHASES = ['Week 1', 'Week 2', '30 Day', '60 Day', '90 Day']

export default function OnboardingPlan({ instanceId, onBack }) {
  const [instance, setInstance] = useState(null)
  const [tasksByPhase, setTasksByPhase] = useState({})
  const [completions, setCompletions] = useState({})
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
        employees (id, full_name, hire_date, roles (name)),
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
    PHASES.forEach(p => byPhase[p] = [])

    data.task_completions.forEach(tc => {
      const phase = tc.onboarding_templates.phase
      if (byPhase[phase]) byPhase[phase].push(tc)
      comp[tc.id] = tc.completed
    })

    setTasksByPhase(byPhase)
    setCompletions(comp)
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

  async function toggleTask(completionId, current) {
    const newVal = !current
    setCompletions(prev => ({ ...prev, [completionId]: newVal }))
    const { error } = await supabase
      .from('task_completions')
      .update({ completed: newVal, completed_at: newVal ? new Date().toISOString() : null })
      .eq('id', completionId)
    if (error) console.log('update error:', error.message)
  }

  async function toggleDocument(docId) {
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
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file)

    if (uploadError) { console.error(uploadError.message); setUploading(false); return }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)

    await supabase.from('documents').insert({
      name: file.name,
      file_url: urlData.publicUrl
    })

    await fetchDocuments()
    setUploading(false)
  }

  async function handleMarkComplete() {
    if (!window.confirm('Mark this onboarding as complete?')) return
    await supabase
      .from('onboarding_instances')
      .update({ status: 'completed' })
      .eq('id', instanceId)
    onBack()
  }

  async function handleArchive() {
    if (!window.confirm('Archive this onboarding? This will remove it from active onboardings.')) return
    await supabase
      .from('onboarding_instances')
      .update({ status: 'archived' })
      .eq('id', instanceId)
    onBack()
  }

  function totalTasks() { return Object.values(tasksByPhase).flat().length }
  function completedTasks() { return Object.values(completions).filter(Boolean).length }
  function pct() {
    const t = totalTasks()
    return t > 0 ? Math.round((completedTasks() / t) * 100) : 0
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', color: '#bbb' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '54px', borderBottom: '0.5px solid #f0f0f0' }}>
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#0070CA', letterSpacing: '-0.3px' }}>
          Integrated <span style={{ color: '#111', fontWeight: '500' }}>Launch</span>
        </div>
        <button onClick={onBack} style={{ fontSize: '13px', color: '#999', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Back to dashboard</button>
      </div>

      <div style={{ maxWidth: '680px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>

        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '24px', fontWeight: '600', color: '#111', letterSpacing: '-0.4px' }}>
            {instance.employees.full_name}
          </div>
          <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>
            {instance.employees.roles.name} · Started {new Date(instance.employees.hire_date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: '#bbb' }}>{completedTasks()} of {totalTasks()} tasks complete</span>
              <span style={{ fontSize: '12px', fontWeight: '500', color: '#0070CA' }}>{pct()}%</span>
            </div>
            <div style={{ height: '4px', background: '#f5f5f5', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct()}%`, background: '#0070CA', borderRadius: '2px', transition: 'width 0.3s ease' }}></div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#ccc', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Documents</span>
            <label style={{ fontSize: '12px', color: '#0070CA', cursor: 'pointer' }}>
              {uploading ? 'Uploading...' : '+ Upload document'}
              <input type="file" style={{ display: 'none' }} onChange={handleUploadDocument} accept=".pdf,.doc,.docx" />
            </label>
          </div>
          {documents.length === 0 && (
            <p style={{ fontSize: '13px', color: '#ccc' }}>No documents uploaded yet.</p>
          )}
          {documents.map(doc => {
            const dc = docCompletions[doc.id]
            const signed = dc?.signed || false
            return (
              <div key={doc.id} onClick={() => toggleDocument(doc.id)} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 0', borderBottom: '0.5px solid #f5f5f5', cursor: 'pointer' }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                  border: signed ? 'none' : '0.5px solid #ddd',
                  background: signed ? '#0070CA' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s'
                }}>
                  {signed && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, fontSize: '14px', color: signed ? '#bbb' : '#111', textDecoration: signed ? 'line-through' : 'none' }}>
                  {doc.name}
                </div>
                <a href={doc.file_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '12px', color: '#0070CA', textDecoration: 'none' }}>
                  View
                </a>
              </div>
            )
          })}
        </div>

        {PHASES.map(phase => {
          const tasks = tasksByPhase[phase] || []
          if (tasks.length === 0) return null
          const phaseComplete = tasks.every(t => completions[t.id])
          return (
            <div key={phase} style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: phaseComplete ? '#0070CA' : '#ccc', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{phase}</span>
                {phaseComplete && <span style={{ fontSize: '11px', color: '#0070CA' }}>Complete</span>}
              </div>
              {tasks.map(tc => (
                <div key={tc.id} onClick={() => toggleTask(tc.id, completions[tc.id])} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 0', borderBottom: '0.5px solid #f5f5f5', cursor: 'pointer' }}>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                    border: completions[tc.id] ? 'none' : '0.5px solid #ddd',
                    background: completions[tc.id] ? '#0070CA' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}>
                    {completions[tc.id] && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, fontSize: '14px', color: completions[tc.id] ? '#bbb' : '#111', textDecoration: completions[tc.id] ? 'line-through' : 'none', transition: 'all 0.15s' }}>
                    {tc.onboarding_templates.task_name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#ccc', flexShrink: 0 }}>
                    {tc.onboarding_templates.owner}
                  </div>
                </div>
              ))}
            </div>
          )
        })}

        <div style={{ borderTop: '0.5px solid #f0f0f0', paddingTop: '32px', marginTop: '16px', display: 'flex', gap: '12px' }}>
          <button onClick={handleMarkComplete} style={{ background: '#f0f0f0', color: '#444', border: 'none', borderRadius: '10px', padding: '10px 24px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>
            Mark as complete
          </button>
          <button onClick={handleArchive} style={{ background: 'none', color: '#ccc', border: '0.5px solid #eee', borderRadius: '10px', padding: '10px 24px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Archive
          </button>
        </div>

      </div>
    </div>
  )
}