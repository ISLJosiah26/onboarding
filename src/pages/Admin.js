/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const PHASES = ['Week 1', 'Week 2', '30 Day', '60 Day', '90 Day']
const OWNERS = ['HR', 'Manager', 'IT']

export default function Admin({ onBack }) {
  const [tab, setTab] = useState('roles')
  const [roles, setRoles] = useState([])
  const [selectedRole, setSelectedRole] = useState(null)
  const [templates, setTemplates] = useState([])
  const [documents, setDocuments] = useState([])

  const [newRoleName, setNewRoleName] = useState('')
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskPhase, setNewTaskPhase] = useState('Week 1')
  const [newTaskOwner, setNewTaskOwner] = useState('HR')

  useEffect(() => { fetchRoles() }, [])
  useEffect(() => { if (selectedRole) fetchTemplates(selectedRole.id) }, [selectedRole])
  useEffect(() => { if (tab === 'documents') fetchDocuments() }, [tab])

  async function fetchRoles() {
    const { data } = await supabase.from('roles').select('*').order('name')
    if (data) setRoles(data)
  }

  async function fetchTemplates(roleId) {
    const { data } = await supabase
      .from('onboarding_templates')
      .select('*')
      .eq('role_id', roleId)
      .order('phase')
    if (data) setTemplates(data)
  }

  async function fetchDocuments() {
    const { data } = await supabase.from('documents').select('*').order('uploaded_at', { ascending: false })
    if (data) setDocuments(data)
  }

  async function addRole() {
    if (!newRoleName.trim()) return
    await supabase.from('roles').insert({ name: newRoleName.trim() })
    setNewRoleName('')
    fetchRoles()
  }

  async function deleteRole(id) {
    if (!window.confirm('Delete this role and all its tasks?')) return
    await supabase.from('onboarding_templates').delete().eq('role_id', id)
    await supabase.from('roles').delete().eq('id', id)
    if (selectedRole?.id === id) setSelectedRole(null)
    fetchRoles()
  }

  async function addTask() {
    if (!newTaskName.trim() || !selectedRole) return
    await supabase.from('onboarding_templates').insert({
      role_id: selectedRole.id,
      task_name: newTaskName.trim(),
      phase: newTaskPhase,
      owner: newTaskOwner
    })
    setNewTaskName('')
    fetchTemplates(selectedRole.id)
  }

  async function deleteTask(id) {
    await supabase.from('onboarding_templates').delete().eq('id', id)
    fetchTemplates(selectedRole.id)
  }

  async function deleteDocument(id, fileUrl) {
    const filePath = fileUrl.split('/documents/')[1]
    if (filePath) await supabase.storage.from('documents').remove([`documents/${filePath}`])
    await supabase.from('documents').delete().eq('id', id)
    fetchDocuments()
  }

const tabStyle = (t) => ({
  fontSize: '13px', fontWeight: '500', cursor: 'pointer', padding: '6px 0',
  color: tab === t ? '#111' : '#bbb',
  borderBottom: tab === t ? '1.5px solid #111' : '1.5px solid transparent',
  background: 'none', border: 'none',
  fontFamily: 'inherit', marginRight: '24px'
})

  const input = {
    border: '0.5px solid #e5e5e5', borderRadius: '8px', padding: '8px 12px',
    fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#111'
  }

  const btnAdd = {
    background: '#f0f0f0', color: '#444', border: 'none', borderRadius: '8px',
    padding: '8px 16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit'
  }

  const btnDelete = {
    background: 'none', border: 'none', color: '#ddd', fontSize: '13px',
    cursor: 'pointer', fontFamily: 'inherit', padding: '0'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '54px', borderBottom: '0.5px solid #f0f0f0' }}>
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#0070CA', letterSpacing: '-0.3px' }}>
          Integrated <span style={{ color: '#111', fontWeight: '500' }}>Launch</span>
        </div>
        <button onClick={onBack} style={{ fontSize: '13px', color: '#999', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Back to dashboard</button>
      </div>

      <div style={{ maxWidth: '720px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>

        <div style={{ fontSize: '22px', fontWeight: '600', color: '#111', letterSpacing: '-0.4px', marginBottom: '24px' }}>Admin</div>

        <div style={{ display: 'flex', borderBottom: '0.5px solid #f0f0f0', marginBottom: '32px' }}>
          <button style={tabStyle('roles')} onClick={() => setTab('roles')}>Roles</button>
          <button style={tabStyle('tasks')} onClick={() => setTab('tasks')}>Task templates</button>
          <button style={tabStyle('documents')} onClick={() => setTab('documents')}>Documents</button>
        </div>

        {tab === 'roles' && (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
              <input style={{ ...input, flex: 1 }} placeholder="New role name" value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRole()} />
              <button style={btnAdd} onClick={addRole}>Add role</button>
            </div>
            {roles.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '0.5px solid #f5f5f5' }}>
                <span style={{ fontSize: '14px', color: '#111' }}>{r.name}</span>
                <button style={btnDelete} onClick={() => deleteRole(r.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'tasks' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '6px' }}>Select a role to manage its tasks</div>
              <select
                style={{ ...input, width: '100%', maxWidth: '280px' }}
                value={selectedRole?.id || ''}
                onChange={e => {
                  const role = roles.find(r => r.id === e.target.value)
                  setSelectedRole(role || null)
                }}
              >
                <option value="">Select a role...</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            {selectedRole && (
              <>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
                  <input style={{ ...input, flex: 1, minWidth: '180px' }} placeholder="Task name" value={newTaskName} onChange={e => setNewTaskName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask()} />
                  <select style={input} value={newTaskPhase} onChange={e => setNewTaskPhase(e.target.value)}>
                    {PHASES.map(p => <option key={p}>{p}</option>)}
                  </select>
                  <select style={input} value={newTaskOwner} onChange={e => setNewTaskOwner(e.target.value)}>
                    {OWNERS.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <button style={btnAdd} onClick={addTask}>Add task</button>
                </div>

                {PHASES.map(phase => {
                  const phaseTasks = templates.filter(t => t.phase === phase)
                  if (phaseTasks.length === 0) return null
                  return (
                    <div key={phase} style={{ marginBottom: '24px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#ccc', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>{phase}</div>
                      {phaseTasks.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '0.5px solid #f5f5f5' }}>
                          <div>
                            <span style={{ fontSize: '14px', color: '#111' }}>{t.task_name}</span>
                            <span style={{ fontSize: '12px', color: '#ccc', marginLeft: '10px' }}>{t.owner}</span>
                          </div>
                          <button style={btnDelete} onClick={() => deleteTask(t.id)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {tab === 'documents' && (
          <div>
            {documents.length === 0 && (
              <p style={{ fontSize: '13px', color: '#ccc' }}>No documents in the library yet. Upload them from an onboarding plan.</p>
            )}
            {documents.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '0.5px solid #f5f5f5' }}>
                <div>
                  <div style={{ fontSize: '14px', color: '#111' }}>{doc.name}</div>
                  <div style={{ fontSize: '12px', color: '#ccc', marginTop: '2px' }}>{new Date(doc.uploaded_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0070CA', textDecoration: 'none' }}>View</a>
                  <button style={btnDelete} onClick={() => deleteDocument(doc.id, doc.file_url)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}