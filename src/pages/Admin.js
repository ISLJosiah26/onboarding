import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import ConfirmModal from '../components/ConfirmModal'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import { handleSupabaseError } from '../utils/handleError'
import { logAudit } from '../utils/auditLog'
import { useWindowSize } from '../hooks/useWindowSize'
import { PHASES, BUCKET_SECTIONS, ONBOARDING_STATUS } from '../config'

const OWNERS = ['HR', 'Manager', 'IT']

const BASE_STYLES = {
  title: { fontSize: '20px', fontWeight: 600, letterSpacing: '-0.5px', color: '#18181b' },
  sub: { fontSize: '13px', color: '#70706b', marginTop: '2px' },
  input: { border: '1px solid #e2e1dd', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#18181b' },
  btnPrimary: { background: 'linear-gradient(180deg, #222 0%, #111 100%)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.1px' },
  btnGhost: { background: 'none', border: 'none', color: '#a4a39f', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  label: { fontSize: '12px', color: '#70706b', marginBottom: '6px', display: 'block', fontWeight: 500 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0efe9' },
  rowName: { fontSize: '13px', color: '#18181b' },
  rowMuted: { fontSize: '12px', color: '#a4a39f' },
  phaseLabel: { fontSize: '11px', fontWeight: 600, color: '#a4a39f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', marginTop: '24px' },
  pill: { fontSize: '11px', padding: '2px 8px', borderRadius: '5px', background: '#f0efe9', color: '#70706b', fontWeight: 500 },
  emptyState: { padding: '48px 0', textAlign: 'center', color: '#a4a39f', fontSize: '13px' },
}

function tabStyle(active) {
  return {
    padding: '10px 14px', fontSize: '13px',
    fontWeight: active ? 600 : 400,
    color: active ? '#0066cc' : '#70706b',
    background: 'none', border: 'none',
    borderBottom: active ? '2px solid #0066cc' : '2px solid transparent',
    cursor: 'pointer', fontFamily: 'inherit', marginBottom: '-1px',
    whiteSpace: 'nowrap', flexShrink: 0,
    transition: 'color 0.12s ease, border-color 0.12s ease',
  }
}

export default function Admin({ session, userProfile, initialTab, onBack, onNavigate, onStartOnboarding, onViewOnboarding }) {
  const [roles, setRoles] = useState([])
  const [selectedRole, setSelectedRole] = useState(null)
  const [templates, setTemplates] = useState([])
  const [documents, setDocuments] = useState([])
  const [companyResources, setCompanyResources] = useState([])
  const [uploadingResource, setUploadingResource] = useState(false)
  const [history, setHistory] = useState([])
  const [modal, setModal] = useState(null)

  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleBrand, setNewRoleBrand] = useState('ISL')
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskOwner, setNewTaskOwner] = useState('HR')
  const [newSubtaskName, setNewSubtaskName] = useState('')
  const [addingSubtaskTo, setAddingSubtaskTo] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [editingTaskName, setEditingTaskName] = useState('')
  const [pickedBrand, setPickedBrand] = useState('')
  const [pickedRoleId, setPickedRoleId] = useState('')
  const { toast, showToast, hideToast } = useToast()
  const { isMobile } = useWindowSize()
  const [taskLibrary, setTaskLibrary] = useState([])
  const [useLibraryTask, setUseLibraryTask] = useState(true)
  const [useLibrarySubtask, setUseLibrarySubtask] = useState(true)
  const [uploadDocRole, setUploadDocRole] = useState('')
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all')
  const [renamingDocId, setRenamingDocId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [addingTaskToPhase, setAddingTaskToPhase] = useState(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkPhase, setBulkPhase] = useState('Day 1')
  const [bulkOwner, setBulkOwner] = useState('HR')
  const [templateCounts, setTemplateCounts] = useState({})
  const [libraryOpen, setLibraryOpen] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchRoles is stable, mount-only fetch
  useEffect(() => { fetchRoles() }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchTemplates is stable, re-fetch on role change
  useEffect(() => { if (selectedRole) fetchTemplates(selectedRole.id) }, [selectedRole])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch functions are stable, re-fetch on tab change
  useEffect(() => {
    if (initialTab === 'documents') fetchDocuments()
    else if (initialTab === 'company-resources') fetchCompanyResources()
    else if (initialTab === 'history') fetchHistory()
    else if (initialTab === 'templates') { fetchTaskLibrary(); fetchTemplateCounts() }
  }, [initialTab])

  useEffect(() => {
    if (!libraryOpen) return
    const onKey = e => { if (e.key === 'Escape') setLibraryOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [libraryOpen])

  async function fetchRoles() {
    const { data } = await supabase.from('roles').select('*').order('name')
    if (data) setRoles(data)
  }

  async function fetchTemplates(roleId) {
    const { data } = await supabase.from('onboarding_templates').select('*').eq('role_id', roleId).order('phase')
    if (data) setTemplates(data)
  }

  async function fetchDocuments() {
    const { data } = await supabase.from('documents').select('*').eq('is_company_resource', false).order('uploaded_at', { ascending: false })
    if (data) setDocuments(data)
  }

  async function fetchCompanyResources() {
    const { data } = await supabase.from('documents').select('*').eq('is_company_resource', true).order('uploaded_at', { ascending: false })
    if (data) setCompanyResources(data)
  }

  async function fetchHistory() {
    const { data } = await supabase
      .from('onboarding_instances')
      .select('id, status, started_at, employees (full_name, email, hire_date, roles (name))')
      .in('status', [ONBOARDING_STATUS.COMPLETED, ONBOARDING_STATUS.ARCHIVED])
      .order('started_at', { ascending: false })
    if (data) setHistory(data)
  }

  async function fetchTaskLibrary() {
  const { data } = await supabase.from('task_library').select('*').order('task_name')
  if (data) setTaskLibrary(data)
}

async function fetchTemplateCounts() {
  const { data } = await supabase.from('onboarding_templates').select('role_id, parent_id')
  if (!data) return
  const counts = {}
  data.filter(t => !t.parent_id).forEach(t => { counts[t.role_id] = (counts[t.role_id] || 0) + 1 })
  setTemplateCounts(counts)
}

async function addRole() {
  if (!newRoleName.trim()) return
  const { error } = await supabase.from('roles').insert({ name: newRoleName.trim(), brand: newRoleBrand })
  if (error) {
    showToast(handleSupabaseError(error, 'Failed to add role.'), 'error')
  } else {
    showToast('Role added')
    setNewRoleName('')
    fetchRoles()
  }
}

  async function deleteRole(id, name) {
    setModal({
      title: 'Delete role',
      message: `This will permanently delete the "${name}" role and all its task templates. This cannot be undone.`,
      confirmLabel: 'Delete role',
      confirmDanger: true,
      onConfirm: async () => {
        await supabase.from('onboarding_templates').delete().eq('role_id', id)
        await supabase.from('roles').delete().eq('id', id)
        if (selectedRole?.id === id) setSelectedRole(null)
        setModal(null)
        fetchRoles()
      }
    })
  }

  async function addTask(phase) {
    if (!newTaskName.trim() || !selectedRole) return

    const { data: newTask } = await supabase
      .from('onboarding_templates')
      .insert({ role_id: selectedRole.id, task_name: newTaskName.trim(), phase, owner: newTaskOwner })
      .select().single()

    const addedName = newTaskName.trim()
    setNewTaskName('')
    setAddingTaskToPhase(null)
    setUseLibraryTask(true)
    fetchTemplates(selectedRole.id)
    fetchTemplateCounts()
    if (!newTask) return

    if (!taskLibrary.some(t => t.task_name.toLowerCase() === addedName.toLowerCase())) {
      await supabase.from('task_library').insert({ task_name: addedName })
      fetchTaskLibrary()
    }

    const { data: roleEmployees } = await supabase.from('employees').select('id').eq('role_id', selectedRole.id)
    if (!roleEmployees || roleEmployees.length === 0) return

    const { data: activeInstances } = await supabase
      .from('onboarding_instances')
      .select('id, employees (full_name)')
      .eq('status', ONBOARDING_STATUS.ACTIVE)
      .in('employee_id', roleEmployees.map(e => e.id))

    if (activeInstances && activeInstances.length > 0) {
      setModal({
        title: 'Sync to active onboardings?',
        message: `${activeInstances.length} active onboarding${activeInstances.length > 1 ? 's' : ''} for ${selectedRole.name} will not have this task unless you sync. Add "${newTask.task_name}" to all active ${selectedRole.name} onboardings?`,
        confirmLabel: 'Yes, add to all',
        confirmDanger: false,
        onConfirm: async () => {
          await supabase.from('task_completions').insert(
            activeInstances.map(inst => ({ instance_id: inst.id, template_task_id: newTask.id, completed: false, day: newTask.phase, sort_order: 0 }))
          )
          setModal(null)
        }
      })
    }
  }

  async function addBulkTasks() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length || !selectedRole) return
    const { error } = await supabase.from('onboarding_templates').insert(
      lines.map(name => ({ role_id: selectedRole.id, task_name: name, phase: bulkPhase, owner: bulkOwner }))
    )
    if (error) { showToast(handleSupabaseError(error, 'Failed to add tasks.'), 'error'); return }
    const newNames = lines.filter(name => !taskLibrary.some(t => t.task_name.toLowerCase() === name.toLowerCase()))
    if (newNames.length > 0) {
      await supabase.from('task_library').insert(newNames.map(name => ({ task_name: name })))
      fetchTaskLibrary()
    }
    setBulkText('')
    setBulkMode(false)
    fetchTemplates(selectedRole.id)
    fetchTemplateCounts()
    showToast(`${lines.length} task${lines.length !== 1 ? 's' : ''} added`)
  }

  async function deleteLibraryTask(id) {
    const { error } = await supabase.from('task_library').delete().eq('id', id)
    if (error) { showToast(handleSupabaseError(error, 'Failed to remove.'), 'error'); return }
    fetchTaskLibrary()
  }

  async function deleteTask(id, name) {
    setModal({
      title: 'Remove task',
      message: `Remove "${name}" from this role's template? This won't affect onboardings already in progress.`,
      confirmLabel: 'Remove task',
      confirmDanger: true,
      onConfirm: async () => {
        await supabase.from('onboarding_templates').delete().eq('id', id)
        setModal(null)
        fetchTemplates(selectedRole.id)
      }
    })
  }

async function saveTaskEdit(id) {
  if (!editingTaskName.trim()) return
  const { error } = await supabase
    .from('onboarding_templates')
    .update({ task_name: editingTaskName.trim() })
    .eq('id', id)
  if (error) {
    showToast(handleSupabaseError(error, 'Failed to save task.'), 'error')
  } else {
    showToast('Task updated')
    setEditingTask(null)
    setEditingTaskName('')
    fetchTemplates(selectedRole.id)
  }
}

async function addSubtask(parentId) {
  if (!newSubtaskName.trim()) return
  const parent = templates.find(t => t.id === parentId)
  const { error } = await supabase.from('onboarding_templates').insert({
    role_id: selectedRole.id,
    task_name: newSubtaskName.trim(),
    phase: parent?.phase || 'Day 1',
    owner: parent?.owner,
    parent_id: parentId
  })
  if (error) {
    showToast(handleSupabaseError(error, 'Failed to add subtask.'), 'error')
  } else {
    showToast('Subtask added')
    setNewSubtaskName('')
    setAddingSubtaskTo(null)
    fetchTemplates(selectedRole.id)
  }
}

async function deleteDoc(id, isResource) {
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) {
    showToast(handleSupabaseError(error, `Failed to remove ${isResource ? 'resource' : 'document'}.`), 'error')
  } else {
    showToast(isResource ? 'Resource removed' : 'Document removed')
    if (isResource) fetchCompanyResources(); else fetchDocuments()
  }
}

async function renameResource(id) {
  const trimmed = renameValue.trim()
  if (!trimmed) return
  const { error } = await supabase.from('documents').update({ name: trimmed }).eq('id', id)
  if (error) {
    showToast(handleSupabaseError(error, 'Failed to rename resource.'), 'error')
  } else {
    setRenamingDocId(null)
    fetchCompanyResources()
  }
}

async function handleCompanyResourceUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  setUploadingResource(true)

  const filePath = `documents/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file)

  if (uploadError) {
    showToast(handleSupabaseError(uploadError, 'Upload failed.'), 'error')
    setUploadingResource(false)
    return
  }

  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)

  const { error: insertError } = await supabase.from('documents').insert({
    name: file.name,
    file_url: urlData.publicUrl,
    role_id: null,
    is_company_resource: true,
  })

  if (insertError) {
    showToast(handleSupabaseError(insertError, 'Failed to save resource.'), 'error')
    await supabase.storage.from('documents').remove([filePath])
  } else {
    showToast('Resource uploaded')
    fetchCompanyResources()
  }
  setUploadingResource(false)
  e.target.value = ''
}

async function handleAdminDocumentUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  setUploadingDoc(true)

  const filePath = `documents/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file)

  if (uploadError) {
    showToast(handleSupabaseError(uploadError, 'Upload failed.'), 'error')
    setUploadingDoc(false)
    return
  }

  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)

  const { error: insertError } = await supabase.from('documents').insert({
    name: file.name,
    file_url: urlData.publicUrl,
    role_id: uploadDocRole || null
  })

  if (insertError) {
    showToast(handleSupabaseError(insertError, 'Failed to save document.'), 'error')
    await supabase.storage.from('documents').remove([filePath])
  } else {
    showToast('Document uploaded')
    fetchDocuments()
  }
  setUploadingDoc(false)
  e.target.value = ''
}

  function handleStartSelected() {
    if (!pickedRoleId) return
    const role = roles.find(r => r.id === pickedRoleId)
    if (role) onStartOnboarding(role)
  }

  const p = isMobile ? '16px' : '40px'

  const styles = {
    ...BASE_STYLES,
    header: { padding: isMobile ? '16px 16px 12px' : '28px 40px 24px', boxShadow: '0 1px 0 #e2e1dd', background: '#fff' },
    content: { padding: isMobile ? '20px 16px' : '32px 40px', maxWidth: '780px' },
    card: { background: '#fff', border: '1px solid #e2e1dd', borderRadius: '12px', padding: isMobile ? '20px 16px' : '28px', maxWidth: '420px', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.04)' },
  }

  function renderHeader(title, sub) {
    return (
      <div style={styles.header}>
        <div style={styles.title}>{title}</div>
        {sub && <div style={styles.sub}>{sub}</div>}
      </div>
    )
  }

function renderAdminHeader(title, sub) {
  const tabs = [
    { id: 'history', label: 'History' },
    { id: 'templates', label: 'Task templates' },
    { id: 'documents', label: 'My Documents' },
    { id: 'company-resources', label: 'Company Resources' },
    { id: 'roles', label: 'Roles' },
  ]
  return (
    <div style={{ boxShadow: '0 1px 0 #e2e1dd', background: '#fff' }}>
      <div style={{ padding: isMobile ? '16px 16px 12px' : '28px 40px 20px' }}>
        <div style={styles.title}>{title}</div>
        {sub && <div style={styles.sub}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', padding: `0 ${p}`, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {tabs.map(tab => (
          <button key={tab.id} style={tabStyle(initialTab === tab.id)} onClick={() => onNavigate(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function renderModal() {
  return (
    <>
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </>
  )
}

  if (initialTab === 'new-onboarding-select') {
    const brandRoles = pickedBrand ? roles.filter(r => r.brand === pickedBrand) : []
    return (
      <Layout session={session} userProfile={userProfile} currentPage="active" onNavigate={onNavigate}>
        {renderHeader('Start new onboarding', 'Select the brand and role for this new employee.')}
        <div style={styles.content}>
          <div style={styles.card}>
            <label style={styles.label}>Brand</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {['ISL', 'AS', 'ADS'].map(b => (
                <button key={b} onClick={() => { setPickedBrand(b); setPickedRoleId('') }}
                  style={{ flex: 1, padding: '10px', borderRadius: '7px', border: pickedBrand === b ? '1px solid #18181b' : '1px solid #e2e1dd', background: pickedBrand === b ? '#18181b' : '#fff', color: pickedBrand === b ? '#fff' : '#18181b', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
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
                  <div style={{ fontSize: '12px', color: '#a4a39f', marginBottom: '16px' }}>No roles exist for {pickedBrand} yet. Add roles from the Roles page.</div>
                )}
                <button style={styles.btnPrimary} onClick={handleStartSelected} disabled={!pickedRoleId}>Continue</button>
              </>
            )}
          </div>
        </div>
        {renderModal()}
      </Layout>
    )
  }

  if (initialTab === 'history') {
    const filteredHistory = history.filter(h => historyFilter === 'all' || h.status === historyFilter)
    return (
      <Layout session={session} userProfile={userProfile} currentPage="history" onNavigate={onNavigate}>
        {renderAdminHeader('History', '')}
        <div style={styles.content}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
            {['all', ONBOARDING_STATUS.COMPLETED, ONBOARDING_STATUS.ARCHIVED].map(f => (
              <button key={f} onClick={() => setHistoryFilter(f)} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '5px', border: '1px solid ' + (historyFilter === f ? '#18181b' : '#e2e1dd'), background: historyFilter === f ? '#18181b' : '#fff', color: historyFilter === f ? '#fff' : '#70706b', cursor: 'pointer', fontFamily: 'inherit', fontWeight: historyFilter === f ? 500 : 400 }}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {filteredHistory.length === 0 ? (
            <div style={styles.emptyState}>No {historyFilter === 'all' ? 'completed or archived' : historyFilter} onboardings yet.</div>
          ) : filteredHistory.map(h => (
            <div key={h.id} style={{ ...styles.row, cursor: 'default' }}>
              <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => onViewOnboarding(h.id)}>
                <div style={styles.rowName}>{h.employees.full_name}</div>
                <div style={styles.rowMuted}>{h.employees.roles?.name || 'Role removed'} · Started {new Date(h.employees.hire_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={styles.pill}>{h.status}</span>
                <button style={{ ...styles.btnGhost, color: '#0066cc', fontSize: '12px' }}
                  onClick={() => setModal({
                    title: 'Reactivate onboarding',
                    message: `This will move ${h.employees.full_name}'s onboarding back to active. Any previously completed tasks will remain checked off.`,
                    confirmLabel: 'Reactivate',
                    confirmDanger: false,
                    onConfirm: async () => {
                      await supabase.from('onboarding_instances').update({ status: ONBOARDING_STATUS.ACTIVE }).eq('id', h.id)
                      await logAudit('onboarding_reactivated', 'onboarding_instance', h.id, { employee_name: h.employees.full_name })
                      setModal(null)
                      fetchHistory()
                    }
                  })}>
                  Reactivate
                </button>
              </div>
            </div>
          ))}
        </div>
        {renderModal()}
      </Layout>
    )
  }

  if (initialTab === 'roles') {
    return (
      <Layout session={session} userProfile={userProfile} currentPage="roles" onNavigate={onNavigate}>
        {renderAdminHeader('Roles', '')}
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
                    <button style={styles.btnGhost} onClick={() => deleteRole(r.id, r.name)}>Remove</button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        {renderModal()}
      </Layout>
    )
  }

  if (initialTab === 'templates') {
    return (
      <Layout session={session} userProfile={userProfile} currentPage="templates" onNavigate={onNavigate}>
        {renderAdminHeader('Task templates', '')}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: isMobile ? '10px 16px' : '12px 40px', borderBottom: '1px solid #f0efe9', background: '#fff' }}>
          <button
            onClick={() => setLibraryOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#0066cc', background: 'none', border: '1px solid #e2e1dd', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Manage task library
            <span style={{ color: '#a0a09c' }}>({taskLibrary.length})</span>
          </button>
        </div>

        <div style={{ display: 'flex', minHeight: 'calc(100vh - 182px)' }}>

          {/* Left panel: role list */}
          <div style={{ width: isMobile ? '140px' : '200px', flexShrink: 0, borderRight: '1px solid #e2e1dd', overflowY: 'auto', padding: '12px 0' }}>
            {['ISL', 'AS', 'ADS'].map(brand => {
              const brandRoles = roles.filter(r => r.brand === brand)
              if (brandRoles.length === 0) return null
              return (
                <div key={brand}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#a0a09c', textTransform: 'uppercase', letterSpacing: '0.4px', padding: '10px 16px 4px' }}>{brand}</div>
                  {brandRoles.map(r => {
                    const active = selectedRole?.id === r.id
                    return (
                      <button key={r.id}
                        className={`il-role-item${active ? ' il-active' : ''}`}
                        onClick={() => { setSelectedRole(r); setAddingTaskToPhase(null); setBulkMode(false) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', border: 'none', background: active ? '#f0efe9' : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <div style={{ fontSize: '13px', fontWeight: active ? 500 : 400, color: '#18181b', letterSpacing: '-0.1px' }}>{r.name}</div>
                        <div style={{ fontSize: '11px', color: '#a0a09c', marginTop: '1px' }}>{templateCounts[r.id] || 0} tasks</div>
                      </button>
                    )
                  })}
                </div>
              )
            })}
            {roles.length === 0 && (
              <div style={{ padding: '16px', fontSize: '12px', color: '#a0a09c' }}>
                No roles.{' '}
                <button onClick={() => onNavigate('roles')} style={{ color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', padding: 0 }}>Add roles</button>
              </div>
            )}
          </div>

          {/* Right panel: task editor */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
            {!selectedRole ? (
              <div style={{ padding: '40px', color: '#a0a09c', fontSize: '13px' }}>Select a role to manage its tasks.</div>
            ) : (
              <>
                {/* Role header */}
                <div style={{ padding: '20px 32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0efe9' }}>
                  <div>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#18181b', letterSpacing: '-0.2px' }}>{selectedRole.name}</span>
                    <span style={{ fontSize: '12px', color: '#a0a09c', marginLeft: '8px' }}>{selectedRole.brand} · {templateCounts[selectedRole.id] || 0} tasks</span>
                  </div>
                  <button
                    onClick={() => { setBulkMode(v => !v); setAddingTaskToPhase(null) }}
                    style={{ fontSize: '12px', color: bulkMode ? '#70706b' : '#0066cc', background: 'none', border: '1px solid ' + (bulkMode ? '#c8c7c3' : 'transparent'), borderRadius: '5px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {bulkMode ? 'Cancel' : 'Bulk add'}
                  </button>
                </div>

                <div style={{ padding: '20px 32px', maxWidth: '640px' }}>

                  {/* Bulk add */}
                  {bulkMode && (
                    <div style={{ background: '#fafaf9', border: '1px solid #e2e1dd', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#18181b', marginBottom: '4px' }}>Bulk add tasks</div>
                      <div style={{ fontSize: '12px', color: '#70706b', marginBottom: '10px' }}>One task name per line</div>
                      <textarea
                        autoFocus
                        style={{ width: '100%', height: '110px', resize: 'vertical', border: '1px solid #e2e1dd', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', fontFamily: 'inherit', color: '#18181b', outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                        placeholder={'Complete tax forms\nSet up laptop\nMeet with manager'}
                        value={bulkText}
                        onChange={e => setBulkText(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select style={styles.input} value={bulkPhase} onChange={e => setBulkPhase(e.target.value)}>
                          {PHASES.map(ph => <option key={ph}>{ph}</option>)}
                        </select>
                        <select style={styles.input} value={bulkOwner} onChange={e => setBulkOwner(e.target.value)}>
                          {OWNERS.map(o => <option key={o}>{o}</option>)}
                        </select>
                        <button style={{ ...styles.btnPrimary, opacity: !bulkText.trim() ? 0.5 : 1 }} disabled={!bulkText.trim()} onClick={addBulkTasks}>
                          Add {bulkText.split('\n').filter(l => l.trim()).length || ''} tasks
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Schedule buckets, grouped by week */}
                  {BUCKET_SECTIONS.map(section => {
                    const showHeading = section.buckets.length > 1 || section.label !== section.buckets[0]
                    return (
                    <div key={section.label}>
                      {showHeading && <div style={{ fontSize: '11px', fontWeight: 700, color: '#70706b', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '18px 0 6px' }}>{section.label}</div>}
                      {section.buckets.map(phase => {
                    const phaseTasks = templates.filter(t => t.phase === phase && !t.parent_id)
                    const isAddingToThis = addingTaskToPhase === phase
                    return (
                      <div key={phase} style={{ marginBottom: '28px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#a0a09c', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{phase}</span>
                          {phaseTasks.length > 0 && <span style={{ fontSize: '11px', color: '#c8c7c3' }}>{phaseTasks.length}</span>}
                        </div>

                        {phaseTasks.length === 0 && !isAddingToThis && (
                          <div style={{ fontSize: '12px', color: '#c8c7c3', paddingBottom: '6px' }}>No tasks</div>
                        )}

                        {phaseTasks.map(t => {
                          const subtasks = templates.filter(s => s.parent_id === t.id)
                          return (
                            <div key={t.id}>
                              <div style={styles.row}>
                                {editingTask === t.id ? (
                                  <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center' }}>
                                    <input style={{ ...styles.input, flex: 1 }} value={editingTaskName}
                                      onChange={e => setEditingTaskName(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') saveTaskEdit(t.id); if (e.key === 'Escape') setEditingTask(null) }}
                                      autoFocus />
                                    <button style={styles.btnPrimary} onClick={() => saveTaskEdit(t.id)}>Save</button>
                                    <button style={styles.btnGhost} onClick={() => setEditingTask(null)}>Cancel</button>
                                  </div>
                                ) : (
                                  <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                      <span style={styles.rowName}>{t.task_name}</span>
                                      <span style={styles.pill}>{t.owner}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
                                      <button style={{ ...styles.btnGhost, color: '#0066cc' }} onClick={() => { setEditingTask(t.id); setEditingTaskName(t.task_name) }}>Edit</button>
                                      <button style={{ ...styles.btnGhost, color: '#0066cc' }} onClick={() => { setAddingSubtaskTo(addingSubtaskTo === t.id ? null : t.id); setNewSubtaskName('') }}>+ Subtask</button>
                                      <button style={styles.btnGhost} onClick={() => deleteTask(t.id, t.task_name)}>Remove</button>
                                    </div>
                                  </>
                                )}
                              </div>

                              {subtasks.map(s => (
                                <div key={s.id} style={{ ...styles.row, paddingLeft: '20px', background: '#fafaf9' }}>
                                  {editingTask === s.id ? (
                                    <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center' }}>
                                      <input style={{ ...styles.input, flex: 1 }} value={editingTaskName}
                                        onChange={e => setEditingTaskName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveTaskEdit(s.id); if (e.key === 'Escape') setEditingTask(null) }}
                                        autoFocus />
                                      <button style={styles.btnPrimary} onClick={() => saveTaskEdit(s.id)}>Save</button>
                                      <button style={styles.btnGhost} onClick={() => setEditingTask(null)}>Cancel</button>
                                    </div>
                                  ) : (
                                    <>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ color: '#c8c7c3', fontSize: '12px' }}>↳</span>
                                        <span style={{ ...styles.rowName, color: '#70706b' }}>{s.task_name}</span>
                                      </div>
                                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <button style={{ ...styles.btnGhost, color: '#0066cc' }} onClick={() => { setEditingTask(s.id); setEditingTaskName(s.task_name) }}>Edit</button>
                                        <button style={styles.btnGhost} onClick={() => deleteTask(s.id, s.task_name)}>Remove</button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}

                              {addingSubtaskTo === t.id && (
                                <div style={{ paddingLeft: '20px', paddingTop: '8px', paddingBottom: '12px', background: '#fafaf9', borderBottom: '1px solid #f0efe9' }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {useLibrarySubtask ? (
                                      <select style={{ ...styles.input, flex: 1, minWidth: '160px' }} value={newSubtaskName}
                                        onChange={e => {
                                          if (e.target.value === '__custom__') { setUseLibrarySubtask(false); setNewSubtaskName('') }
                                          else setNewSubtaskName(e.target.value)
                                        }}>
                                        <option value="">Select from library...</option>
                                        {taskLibrary.map(tl => <option key={tl.id} value={tl.task_name}>{tl.task_name}</option>)}
                                        <option value="__custom__">+ Custom subtask</option>
                                      </select>
                                    ) : (
                                      <input style={{ ...styles.input, flex: 1, minWidth: '160px' }} placeholder="Subtask name"
                                        value={newSubtaskName} onChange={e => setNewSubtaskName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addSubtask(t.id)} autoFocus />
                                    )}
                                    <button style={styles.btnPrimary} onClick={() => addSubtask(t.id)}>Add</button>
                                    <button style={{ ...styles.btnGhost, padding: '0 8px' }} onClick={() => { setAddingSubtaskTo(null); setUseLibrarySubtask(true) }}>Cancel</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {/* Per-phase add */}
                        {isAddingToThis ? (
                          <div style={{ marginTop: '8px', padding: '12px', background: '#fafaf9', border: '1px solid #e2e1dd', borderRadius: '7px' }}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                              {useLibraryTask ? (
                                <select style={{ ...styles.input, flex: 1, minWidth: '180px' }} value={newTaskName}
                                  onChange={e => {
                                    if (e.target.value === '__custom__') { setUseLibraryTask(false); setNewTaskName('') }
                                    else setNewTaskName(e.target.value)
                                  }}>
                                  <option value="">Select from library...</option>
                                  {taskLibrary.map(tl => <option key={tl.id} value={tl.task_name}>{tl.task_name}</option>)}
                                  <option value="__custom__">+ Custom task</option>
                                </select>
                              ) : (
                                <input style={{ ...styles.input, flex: 1, minWidth: '180px' }} placeholder="Task name"
                                  value={newTaskName} onChange={e => setNewTaskName(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && addTask(phase)} autoFocus />
                              )}
                              <select style={styles.input} value={newTaskOwner} onChange={e => setNewTaskOwner(e.target.value)}>
                                {OWNERS.map(o => <option key={o}>{o}</option>)}
                              </select>
                              <button style={styles.btnPrimary} onClick={() => addTask(phase)}>Add</button>
                              <button style={{ ...styles.btnGhost, padding: '0 8px' }} onClick={() => { setAddingTaskToPhase(null); setUseLibraryTask(true); setNewTaskName('') }}>Cancel</button>
                            </div>
                            {!useLibraryTask && (
                              <button style={{ ...styles.btnGhost, fontSize: '11px', color: '#a0a09c', marginTop: '6px' }}
                                onClick={() => { setUseLibraryTask(true); setNewTaskName('') }}>
                                Use library instead
                              </button>
                            )}
                          </div>
                        ) : !bulkMode && (
                          <button
                            onClick={() => { setAddingTaskToPhase(phase); setNewTaskName(''); setNewTaskOwner('HR'); setUseLibraryTask(true) }}
                            style={{ fontSize: '12px', color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', fontFamily: 'inherit', display: 'block' }}>
                            + Add task
                          </button>
                        )}
                      </div>
                    )
                      })}
                    </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {libraryOpen && (
          <div
            className="il-backdrop"
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'flex-end', fontFamily: "'Inter', -apple-system, sans-serif" }}
            onClick={() => setLibraryOpen(false)}>
            <div
              style={{ background: '#fff', height: '100%', width: isMobile ? '100%' : '400px', maxWidth: '100%', boxShadow: '-4px 0 24px rgba(0,0,0,0.10)', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0efe9', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#18181b', letterSpacing: '-0.2px' }}>Task library</div>
                  <div style={{ fontSize: '12px', color: '#70706b', marginTop: '4px', lineHeight: 1.5 }}>Tasks saved here appear in the dropdown when adding tasks to a role. Remove typos or outdated entries.</div>
                </div>
                <button onClick={() => setLibraryOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '22px', lineHeight: 1, color: '#a0a09c', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 24px' }}>
                {taskLibrary.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#a0a09c', paddingTop: '12px' }}>Library is empty. Tasks you add to a role are saved here automatically.</div>
                ) : taskLibrary.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0efe9' }}>
                    <span style={{ fontSize: '13px', color: '#18181b' }}>{t.task_name}</span>
                    <button style={styles.btnGhost} onClick={() => deleteLibraryTask(t.id)}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {renderModal()}
      </Layout>
    )
  }

if (initialTab === 'documents') {
  return (
    <Layout session={session} userProfile={userProfile} currentPage="documents" onNavigate={onNavigate}>
      {renderAdminHeader('Documents', '')}
      <div style={styles.content}>
        <div style={{ marginBottom: '28px', padding: '20px', background: '#fafaf9', border: '1px solid #e2e1dd', borderRadius: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#18181b', marginBottom: '16px' }}>Upload new document</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              style={{ ...styles.input, flex: 1, maxWidth: '260px' }}
              value={uploadDocRole}
              onChange={e => setUploadDocRole(e.target.value)}
            >
              <option value="">All roles (universal)</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.brand})</option>)}
            </select>
            <label style={{ ...styles.btnPrimary, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {uploadingDoc ? 'Uploading...' : '+ Upload document'}
              <input type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx"
                onChange={handleAdminDocumentUpload} disabled={uploadingDoc} />
            </label>
          </div>
        </div>

        {documents.length === 0 ? (
          <div style={styles.emptyState}>No documents yet. Upload one above.</div>
        ) : (
          <>
            {[null, ...roles.filter(r => documents.some(d => d.role_id === r.id))].map(role => {
              const roleDocs = role === null
                ? documents.filter(d => !d.role_id)
                : documents.filter(d => d.role_id === role.id)
              if (roleDocs.length === 0) return null
              return (
                <div key={role?.id || 'universal'} style={{ marginBottom: '24px' }}>
                  <div style={styles.phaseLabel}>{role ? `${role.name} (${role.brand})` : 'Universal'}</div>
                  {roleDocs.map(doc => (
                    <div key={doc.id} style={styles.row}>
                      <div>
                        <div style={styles.rowName}>{doc.name}</div>
                        <div style={styles.rowMuted}>{new Date(doc.uploaded_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0066cc', textDecoration: 'none' }}>View</a>
                        <button style={styles.btnGhost} onClick={() => deleteDoc(doc.id, false)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </>
        )}
      </div>
      {renderModal()}
    </Layout>
  )
}

  if (initialTab === 'company-resources') {
    return (
      <Layout session={session} userProfile={userProfile} currentPage="company-resources" onNavigate={onNavigate}>
        {renderAdminHeader('Company Resources', '')}
        <div style={styles.content}>
          <div style={{ marginBottom: '28px', padding: '20px', background: '#fafaf9', border: '1px solid #e2e1dd', borderRadius: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#18181b', marginBottom: '16px' }}>Upload company resource</div>
            <label style={{ ...styles.btnPrimary, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {uploadingResource ? 'Uploading...' : '+ Upload document'}
              <input type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx"
                onChange={handleCompanyResourceUpload} disabled={uploadingResource} />
            </label>
          </div>

          {companyResources.length === 0 ? (
            <div style={styles.emptyState}>No company resources yet. Upload one above.</div>
          ) : (
            companyResources.map(doc => (
              <div key={doc.id} style={styles.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {renamingDocId === doc.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameResource(doc.id)
                        if (e.key === 'Escape') setRenamingDocId(null)
                      }}
                      style={{ fontSize: '13px', fontWeight: 500, color: '#18181b', border: '1px solid #c8c8c4', borderRadius: '6px', padding: '4px 8px', fontFamily: 'inherit', outline: 'none', width: '100%', maxWidth: '340px' }}
                    />
                  ) : (
                    <div style={styles.rowName}>{doc.name}</div>
                  )}
                  <div style={styles.rowMuted}>{new Date(doc.uploaded_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
                  {renamingDocId === doc.id ? (
                    <>
                      <button style={styles.btnGhost} onClick={() => renameResource(doc.id)}>Save</button>
                      <button style={styles.btnGhost} onClick={() => setRenamingDocId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0066cc', textDecoration: 'none' }}>View</a>
                      <button style={styles.btnGhost} onClick={() => { setRenamingDocId(doc.id); setRenameValue(doc.name) }}>Rename</button>
                      <button style={styles.btnGhost} onClick={() => deleteDoc(doc.id, true)}>Remove</button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        {renderModal()}
      </Layout>
    )
  }

  return (
    <Layout session={session} userProfile={userProfile} currentPage="dashboard" onNavigate={onNavigate}>
      {renderHeader('Admin', '')}
      <div style={styles.content}>
        <div style={styles.emptyState}>Select a section from the sidebar.</div>
      </div>
      {renderModal()}
    </Layout>
  )
}