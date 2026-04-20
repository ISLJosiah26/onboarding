import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'

export default function NewOnboarding({ session, roleId, roleName, onBack, onNavigate, onComplete }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [hireDate, setHireDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const styles = {
    header: { padding: '28px 40px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #ebebe8' },
    title: { fontSize: '20px', fontWeight: 600, letterSpacing: '-0.4px' },
    sub: { fontSize: '13px', color: '#8a8a86', marginTop: '2px' },
    content: { padding: '40px', maxWidth: '480px' },
    label: { fontSize: '12px', color: '#8a8a86', marginBottom: '6px', display: 'block' },
    input: { width: '100%', background: '#fff', border: '1px solid #ebebe8', borderRadius: '7px', padding: '10px 14px', fontSize: '13px', color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', marginBottom: '20px', display: 'block' },
    btnPrimary: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    btnSecondary: { background: 'transparent', color: '#5f5f5c', border: '1px solid #ebebe8', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginRight: '8px' },
    error: { fontSize: '12px', color: '#c74848', marginBottom: '16px' }
  }

  async function handleCreate() {
    if (!fullName || !hireDate) { setError('Please fill in name and start date.'); return }
    setLoading(true)
    setError('')

const { data: roleData } = await supabase.from('roles').select('brand').eq('id', roleId).single()
const brand = roleData?.brand || 'ISL'

const { data: employee, error: empError } = await supabase
  .from('employees')
  .insert({ full_name: fullName, email, role_id: roleId, hire_date: hireDate, brand })
  .select().single()

    if (empError) { setError(empError.message); setLoading(false); return }

    const { data: instance, error: instError } = await supabase
      .from('onboarding_instances')
      .insert({ employee_id: employee.id })
      .select().single()

    if (instError) { setError(instError.message); setLoading(false); return }

    const { data: tasks } = await supabase
      .from('onboarding_templates')
      .select('id')
      .eq('role_id', roleId)

    if (tasks && tasks.length > 0) {
      await supabase.from('task_completions').insert(
        tasks.map(t => ({ instance_id: instance.id, template_task_id: t.id, completed: false }))
      )
    }

    setLoading(false)
    onComplete(instance.id)
  }

  return (
    <Layout session={session} currentPage="active" onNavigate={onNavigate}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>New onboarding</div>
          <div style={styles.sub}>Role: {roleName}</div>
        </div>
      </div>

      <div style={styles.content}>
        {error && <div style={styles.error}>{error}</div>}

        <span style={styles.label}>Full name</span>
        <input style={styles.input} type="text" placeholder="Jane Smith" value={fullName} onChange={e => setFullName(e.target.value)} />

        <span style={styles.label}>Email address</span>
        <input style={styles.input} type="email" placeholder="jane@integratedstaffing.ca" value={email} onChange={e => setEmail(e.target.value)} />

        <span style={styles.label}>Start date</span>
        <input style={{ ...styles.input, marginBottom: '28px' }} type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} />

        <div style={{ display: 'flex' }}>
          <button style={styles.btnSecondary} onClick={onBack}>Cancel</button>
          <button style={styles.btnPrimary} onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create onboarding plan'}
          </button>
        </div>
      </div>
    </Layout>
  )
}