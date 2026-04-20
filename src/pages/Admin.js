/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'

const PHASES = ['Week 1', 'Week 2', '30 Day', '60 Day', '90 Day']
const OWNERS = ['HR', 'Manager', 'IT']

export default function Admin({ session, initialTab, onBack, onNavigate, onStartOnboarding, onViewOnboarding }) {
  const [pickedBrand, setPickedBrand] = useState('')  
  const [roles, setRoles] = useState([])
  const [selectedRole, setSelectedRole] = useState(null)
  const [templates, setTemplates] = useState([])
  const [documents, setDocuments] = useState([])
  const [history, setHistory] = useState([])

  const [newRoleName, setNewRoleName] = useState('')
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskPhase, setNewTaskPhase] = useState('Week 1')
  const [newTaskOwner, setNewTaskOwner] = useState('HR')
  const [newRoleBrand, setNewRoleBrand] = useState('ISL')

  const [pickedRoleId, setPickedRoleId] = useState('')

  useEffect(() => { fetchRoles() }, [])
  useEffect(() => { if (selectedRole) fetchTemplates(selectedRole.id) }, [selectedRole])
  useEffect(() => { if (initialTab === 'documents') fetchDocuments() }, [initialTab])
  useEffect(() => { if (initialTab === 'history') fetchHistory() }, [initialTab])

  async function fetchRoles() {
    const { data } = await supabase.from('roles').select('*').order('name')
    if (data) setRoles(data)
  }
  async function fetchTemplates(roleId) {
    const { data } = await supabase.from('onboarding_templates').select('*').eq('role_id', roleId).order('phase')
    if (data) setTemplates(data)
  }
  async function fetchDocuments() {
    const { data } = await supabase.from('documents').select('*').order('uploaded_at', { ascending: false })
    if (data) setDocuments(data)
  }
  async function fetchHistory() {
    const { data } = await supabase
      .from('onboarding_instances')
      .select(`id, status, started_at, employees (full_name, email, hire_date, roles (name))`)
      .in('status', ['completed', 'archived'])
      .order('started_at', { ascending: false })
    if (data) setHistory(data)
  }

async function addRole() {
    if (!newRoleName.trim()) return
    await supabase.from('roles').insert({ name: newRoleName.trim(), brand: newRoleBrand })
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
      role_id: selectedRole.id, task_name: newTaskName.trim(), phase: newTaskPhase, owner: newTaskOwner
    })
    setNewTaskName('')
    fetchTemplates(selectedRole.id)
  }

  async function deleteTask(id) {
    await supabase.from('onboarding_templates').delete().eq('id', id)
    fetchTemplates(selectedRole.id)
  }

  async function deleteDocument(id) {
    await supabase.from('documents').delete().eq('id', id)
    fetchDocuments()
  }

  function handleStartSelected() {
    if (!pickedRoleId) return
    const role = roles.find(r => r.id === pickedRoleId)
    if (role) onStartOnboarding(role)
  }

  const styles = {
    header: { padding: '28px 40px 24px', borderBottom: '1px solid #ebebe8' },
    title: { fontSize: '20px', fontWeight: 600, letterSpacing: '-0.4px' },
    sub: { fontSize: '13px', color: '#8a8a86', marginTop: '2px' },
    content: { padding: '32px 40px', maxWidth: '780px' },
    input: { border: '1px solid #ebebe8', borderRadius: '7px', padding: '9px 12px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#1a1a1a' },
    btnPrimary: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', padding: '9px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    btnGhost: { background: 'none', border: 'none', color: '#a8a8a4', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
    label: { fontSize: '12px', color: '#8a8a86', marginBottom: '6px', display: 'block' },
    row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0efeb' },
    rowName: { fontSize: '13px', color: '#1a1a1a' },
    rowMuted: { fontSize: '12px', color: '#8a8a86' },
    phaseLabel: { fontSize: '11px', fontWeight: 600, color: '#a8a8a4', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px', marginTop: '24px' },
    pill: { fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f4f3f1', color: '#8a8a86', fontWeight: 500 },
    emptyState: { padding: '40px 0', textAlign: 'center', color: '#a8a8a4', fontSize: '13px' },
    card: { background: '#fff', border: '1px solid #ebebe8', borderRadius: '10px', padding: '28px', maxWidth: '420px' }
  }

  function renderHeader(title, sub) {
    return (
      <div style={styles.header}>
        <div style={styles.title}>{title}</div>
        <div style={styles.sub}>{sub}</div>
      </div>
    )
  }

if (initialTab === 'new-onboarding-select') {
    const brandRoles = pickedBrand ? roles.filter(r => r.brand === pickedBrand) : []
    return (
      <Layout session={session} currentPage="active" onNavigate={onNavigate}>
        {renderHeader('Start new onboarding', 'Select the brand and role for this new employee.')}
        <div style={styles.content}>
          <div style={styles.card}>
            <label style={styles.label}>Brand</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {['ISL', 'AS', 'ADS'].map(b => (
                <button
                  key={b}
                  onClick={() => { setPickedBrand(b); setPickedRoleId('') }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '7px',
                    border: pickedBrand === b ? '1px solid #1a1a1a' : '1px solid #ebebe8',
                    background: pickedBrand === b ? '#1a1a1a' : '#fff',
                    color: pickedBrand === b ? '#fff' : '#1a1a1a',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  {b}
                </button>
              ))}
            </div>

            {pickedBrand && (
              <>
                <label style={styles.label}>Role</label>
                <select style={{ ...styles.input, width: '100%', marginBottom: '20px' }} value={pickedRoleId} onChange={e => setPickedRoleId(e.target.value)}>
                  <option value="">Select a role...</option>
                  {brandRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                {brandRoles.length === 0 && (
                  <div style={{ fontSize: '12px', color: '#a8a8a4', marginBottom: '16px' }}>No roles exist for {pickedBrand} yet. Add roles from the Roles page.</div>
                )}
                <button style={styles.btnPrimary} onClick={handleStartSelected} disabled={!pickedRoleId}>Continue</button>
              </>
            )}
          </div>
        </div>
      </Layout>
    )
  }

  // HISTORY
  if (initialTab === 'history') {
    return (
      <Layout session={session} currentPage="history" onNavigate={onNavigate}>
        {renderHeader('History', 'Completed and archived onboardings.')}
        <div style={styles.content}>
          {history.length === 0 ? (
            <div style={styles.emptyState}>No completed or archived onboardings yet.</div>
          ) : history.map(h => (
            <div key={h.id} style={styles.row} onClick={() => onViewOnboarding(h.id)}>
              <div>
                <div style={styles.rowName}>{h.employees.full_name}</div>
                <div style={styles.rowMuted}>{h.employees.roles.name} · Started {new Date(h.employees.hire_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              <span style={styles.pill}>{h.status}</span>
            </div>
          ))}
        </div>
      </Layout>
    )
  }

  // ROLES
  if (initialTab === 'roles') {
    return (
      <Layout session={session} currentPage="roles" onNavigate={onNavigate}>
        {renderHeader('Roles', 'Manage the roles employees are hired for.')}
        <div style={styles.content}>
<div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
  <input style={{ ...styles.input, flex: 1 }} placeholder="New role name" value={newRoleName}
    onChange={e => setNewRoleName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRole()} />
  <select style={styles.input} value={newRoleBrand} onChange={e => setNewRoleBrand(e.target.value)}>
    <option value="ISL">ISL</option>
    <option value="AS">AS</option>
    <option value="ADS">ADS</option>
  </select>
  <button style={styles.btnPrimary} onClick={addRole}>Add role</button>
</div>
{['ISL', 'AS', 'ADS'].map(brand => {
  const brandRoles = roles.filter(r => r.brand === brand)
  if (brandRoles.length === 0) return null
  return (
    <div key={brand}>
      <div style={styles.phaseLabel}>{brand}</div>
      {brandRoles.map(r => (
        <div key={r.id} style={styles.row}>
          <span style={styles.rowName}>{r.name}</span>
          <button style={styles.btnGhost} onClick={() => deleteRole(r.id)}>Remove</button>
        </div>
      ))}
    </div>
  )
})}
        </div>
      </Layout>
    )
  }

  // TASK TEMPLATES
  if (initialTab === 'templates') {
    return (
      <Layout session={session} currentPage="templates" onNavigate={onNavigate}>
        {renderHeader('Task templates', 'Define the onboarding tasks for each role.')}
        <div style={styles.content}>
          <label style={styles.label}>Select a role to manage its tasks</label>
          <select style={{ ...styles.input, width: '100%', maxWidth: '320px', marginBottom: '24px' }}
            value={selectedRole?.id || ''}
            onChange={e => {
              const role = roles.find(r => r.id === e.target.value)
              setSelectedRole(role || null)
            }}>
            <option value="">Select a role...</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          {selectedRole && (
            <>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <input style={{ ...styles.input, flex: 1, minWidth: '200px' }} placeholder="Task name"
                  value={newTaskName} onChange={e => setNewTaskName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()} />
                <select style={styles.input} value={newTaskPhase} onChange={e => setNewTaskPhase(e.target.value)}>
                  {PHASES.map(p => <option key={p}>{p}</option>)}
                </select>
                <select style={styles.input} value={newTaskOwner} onChange={e => setNewTaskOwner(e.target.value)}>
                  {OWNERS.map(o => <option key={o}>{o}</option>)}
                </select>
                <button style={styles.btnPrimary} onClick={addTask}>Add task</button>
              </div>

              {PHASES.map(phase => {
                const phaseTasks = templates.filter(t => t.phase === phase)
                if (phaseTasks.length === 0) return null
                return (
                  <div key={phase}>
                    <div style={styles.phaseLabel}>{phase}</div>
                    {phaseTasks.map(t => (
                      <div key={t.id} style={styles.row}>
                        <div>
                          <span style={styles.rowName}>{t.task_name}</span>
                          <span style={{ ...styles.pill, marginLeft: '10px' }}>{t.owner}</span>
                        </div>
                        <button style={styles.btnGhost} onClick={() => deleteTask(t.id)}>Remove</button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </Layout>
    )
  }

  // DOCUMENTS
  if (initialTab === 'documents') {
    return (
      <Layout session={session} currentPage="documents" onNavigate={onNavigate}>
        {renderHeader('Documents', 'Manage the document library shared across all onboardings.')}
        <div style={styles.content}>
          {documents.length === 0 ? (
            <div style={styles.emptyState}>No documents yet. Upload from an onboarding plan.</div>
          ) : documents.map(doc => (
            <div key={doc.id} style={styles.row}>
              <div>
                <div style={styles.rowName}>{doc.name}</div>
                <div style={styles.rowMuted}>{new Date(doc.uploaded_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0070CA', textDecoration: 'none' }}>View</a>
                <button style={styles.btnGhost} onClick={() => deleteDocument(doc.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </Layout>
    )
  }

  return null
}