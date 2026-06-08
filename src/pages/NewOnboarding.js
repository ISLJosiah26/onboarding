import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import { handleSupabaseError } from '../utils/handleError'
import { logAudit } from '../utils/auditLog'
import { getHrEmail } from '../utils/getHrEmail'

export default function NewOnboarding({ session, userProfile, roleId, roleName, onBack, onNavigate, onComplete }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [hireDate, setHireDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const styles = {
    header: { padding: '28px 40px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e1dd' },
    title: { fontSize: '20px', fontWeight: 600, letterSpacing: '-0.4px' },
    sub: { fontSize: '13px', color: '#70706b', marginTop: '2px' },
    content: { padding: '40px', maxWidth: '560px' },
    label: { fontSize: '12px', color: '#70706b', marginBottom: '6px', display: 'block' },
    input: { width: '100%', background: '#fff', border: '1px solid #e2e1dd', borderRadius: '7px', padding: '10px 14px', fontSize: '13px', color: '#18181b', fontFamily: 'inherit', outline: 'none', marginBottom: '20px', display: 'block', boxSizing: 'border-box' },
    btnPrimary: { background: '#18181b', color: '#fff', border: 'none', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    btnSecondary: { background: 'transparent', color: '#70706b', border: '1px solid #e2e1dd', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginRight: '8px' },
    error: { fontSize: '12px', color: '#c04040', marginBottom: '16px' }
  }

async function handleCreate() {
  if (!fullName || !hireDate) { setError('Please fill in name and start date.'); return }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address.'); return }
  setLoading(true)
  setError('')

  const { data: roleData } = await supabase.from('roles').select('brand').eq('id', roleId).single()
  const brand = roleData?.brand || 'ISL'

  const existingEmployees = await supabase
    .from('employees')
    .select('id, full_name, onboarding_instances (id, status)')
    .ilike('full_name', fullName.trim())

  if (existingEmployees.data && existingEmployees.data.length > 0) {
    const hasActive = existingEmployees.data.some(emp =>
      emp.onboarding_instances?.some(inst => inst.status === 'active')
    )
    if (hasActive) {
      setError(`An active onboarding already exists for someone named "${fullName}". Check the dashboard before continuing.`)
      setLoading(false)
      return
    }
  }

  const { data, error: rpcError } = await supabase.rpc('create_onboarding', {
    p_full_name: fullName.trim(),
    p_email: email,
    p_role_id: roleId,
    p_hire_date: hireDate,
    p_brand: brand
  })

if (rpcError) {
  setError(handleSupabaseError(rpcError, 'Failed to create onboarding. Please try again.'))
  setLoading(false)
  return
}

  await sendOnboardingStartedEmails(fullName, email, roleName, hireDate)
  await logAudit('onboarding_created', 'onboarding_instance', data.instance_id, {
    employee_name: fullName.trim(),
    role: roleName
  })

  setLoading(false)
  onComplete(data.instance_id)
}

async function sendOnboardingStartedEmails(name, employeeEmail, role, startDate) {
  const startFormatted = new Date(startDate).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
  const hrEmail = await getHrEmail()

  try {
    if (employeeEmail) {
      await supabase.functions.invoke('send-email', {
        body: {
          to: employeeEmail,
          subject: `Welcome to Integrated Staffing, ${name.split(' ')[0]}`,
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #18181b;">
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
    }

    await supabase.functions.invoke('send-email', {
      body: {
        to: hrEmail,
        subject: `New onboarding started: ${name}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #18181b;">
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
  } catch (err) {
    console.error('Email notification failed:', err)
  }
}

  return (
    <Layout session={session} userProfile={userProfile} currentPage="active" onNavigate={onNavigate}>
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