import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function NewOnboarding({ roleId, roleName, onBack, onComplete }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [hireDate, setHireDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const input = {
    width: '100%', background: '#fff', border: '0.5px solid #e5e5e5',
    borderRadius: '10px', padding: '10px 14px', fontSize: '14px',
    color: '#111', fontFamily: 'inherit', outline: 'none', marginBottom: '16px', display: 'block'
  }

  const label = {
    fontSize: '12px', color: '#999', marginBottom: '6px', display: 'block'
  }

  async function handleCreate() {
    if (!fullName || !hireDate) { setError('Please fill in name and start date.'); return }
    setLoading(true)
    setError('')

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .insert({ full_name: fullName, email, role_id: roleId, hire_date: hireDate, brand: 'ISL' })
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
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '54px', borderBottom: '0.5px solid #f0f0f0' }}>
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#0070CA', letterSpacing: '-0.3px' }}>
          Integrated <span style={{ color: '#111', fontWeight: '500' }}>Launch</span>
        </div>
        <button onClick={onBack} style={{ fontSize: '13px', color: '#999', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Back to dashboard</button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '400px', padding: '0 24px' }}>
          <div style={{ fontSize: '22px', fontWeight: '600', color: '#111', letterSpacing: '-0.4px', marginBottom: '4px' }}>New onboarding</div>
          <div style={{ fontSize: '13px', color: '#999', marginBottom: '32px' }}>Role: {roleName}</div>

          {error && <div style={{ fontSize: '13px', color: 'red', marginBottom: '16px' }}>{error}</div>}

          <span style={label}>Full name</span>
          <input style={input} type="text" placeholder="Jane Smith" value={fullName} onChange={e => setFullName(e.target.value)} />

          <span style={label}>Email address</span>
          <input style={input} type="email" placeholder="jane@integratedstaffing.ca" value={email} onChange={e => setEmail(e.target.value)} />

          <span style={label}>Start date</span>
          <input style={{ ...input, marginBottom: '24px' }} type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} />

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={handleCreate} disabled={loading} style={{ background: '#f0f0f0', color: '#444', border: 'none', borderRadius: '10px', padding: '10px 40px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Creating...' : 'Create onboarding plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}