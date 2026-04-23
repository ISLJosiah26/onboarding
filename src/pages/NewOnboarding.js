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

const { data: existingEmployees } = await supabase
  .from('employees')
  .select('id, full_name, onboarding_instances (id, status)')
  .ilike('full_name', fullName.trim())

if (existingEmployees && existingEmployees.length > 0) {
  const hasActive = existingEmployees.some(emp =>
    emp.onboarding_instances?.some(inst => inst.status === 'active')
  )
  if (hasActive) {
    setError(`An active onboarding already exists for someone named "${fullName}". Check the dashboard before continuing.`)
    setLoading(false)
    return
  }
}

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

    await sendOnboardingStartedEmails(fullName, email, roleName, hireDate)

    setLoading(false)
    onComplete(instance.id)
  }

  async function sendOnboardingStartedEmails(name, employeeEmail, role, startDate) {
    const startFormatted = new Date(startDate).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })

    if (employeeEmail) {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: employeeEmail,
          subject: `Welcome to Integrated Staffing, ${name.split(' ')[0]}`,
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
              <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.4px; margin-bottom: 16px;">Welcome aboard, ${name.split(' ')[0]}</h1>
              <p style="font-size: 15px; line-height: 1.6; color: #444;">We're excited to have you joining as a <strong>${role}</strong>, starting <strong>${startFormatted}</strong>.</p>
              <p style="font-size: 15px; line-height: 1.6; color: #444;">Our HR team has prepared your onboarding plan and will be in touch shortly with next steps, required paperwork, and training schedule.</p>
              <p style="font-size: 15px; line-height: 1.6; color: #444;">If you have any questions before your start date, please reach out.</p>
              <p style="font-size: 15px; line-height: 1.6; color: #444; margin-top: 32px;">Welcome to the team.</p>
              <p style="font-size: 13px; color: #888; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">Integrated Staffing Limited</p>
            </div>
          `
        }
      })
      console.log('Employee email result:', { data, error })
    }

    const { data: data2, error: error2 } = await supabase.functions.invoke('send-email', {
      body: {
        to: 'josiah@integratedstaffing.ca',
        subject: `New onboarding started: ${name}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
            <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">New onboarding plan created</h2>
            <table style="font-size: 14px; color: #444;">
              <tr><td style="padding: 4px 16px 4px 0; color: #888;">Employee</td><td>${name}</td></tr>
              <tr><td style="padding: 4px 16px 4px 0; color: #888;">Email</td><td>${employeeEmail || 'not provided'}</td></tr>
              <tr><td style="padding: 4px 16px 4px 0; color: #888;">Role</td><td>${role}</td></tr>
              <tr><td style="padding: 4px 16px 4px 0; color: #888;">Start date</td><td>${startFormatted}</td></tr>
            </table>
            <p style="font-size: 13px; color: #888; margin-top: 32px;">Sent by Integrated Launch</p>
          </div>
        `
      }
    })
    console.log('HR email result:', { data: data2, error: error2 })
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