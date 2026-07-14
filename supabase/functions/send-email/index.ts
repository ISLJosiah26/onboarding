import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

// Recipients must belong to the organization: the company mail domain, a known
// employee address, or a configured system address. This stops the function
// from being used as an open relay for arbitrary external mail.
const ALLOWED_DOMAINS = ['integratedstaffing.ca'];

function domainOf(addr: string): string {
  const at = addr.lastIndexOf('@');
  return at === -1 ? '' : addr.slice(at + 1).toLowerCase().trim();
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { to, subject, html }: EmailPayload = await req.json();
    const recipients = (Array.isArray(to) ? to : [to])
      .map(r => (r ?? '').toString().trim()).filter(Boolean);

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipient provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const needsLookup = recipients.filter(r => !ALLOWED_DOMAINS.includes(domainOf(r)));
    const allowed = new Set<string>();
    if (needsLookup.length > 0) {
      const lower = needsLookup.map(r => r.toLowerCase());
      const [{ data: emps }, { data: settings }] = await Promise.all([
        supabaseAdmin.from('employees').select('email').in('email', needsLookup),
        supabaseAdmin.from('system_settings').select('value')
          .in('key', ['hr_notification_email', 'tech_support_email']),
      ]);
      (emps ?? []).forEach(e => e.email && allowed.add(e.email.toLowerCase()));
      (settings ?? []).forEach(s => s.value && allowed.add(String(s.value).toLowerCase()));
      for (let i = 0; i < needsLookup.length; i++) {
        if (!allowed.has(lower[i])) {
          return new Response(JSON.stringify({ error: `Recipient not permitted: ${needsLookup[i]}` }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing API key' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Integrated Launch <onboarding@integratedstaffing.ca>',
        to: recipients, subject, html,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
