'use server'

import { getSupabaseServer } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend'

export async function submitLead(formData: FormData) {
  const name = formData.get('name') as string
  const business_name = formData.get('business_name') as string
  const email = formData.get('email') as string

  if (!name || !email) {
    return { success: false, error: 'Name and email are required.' }
  }

  // Insert into Supabase
  const supabase = getSupabaseServer()
  if (supabase) {
    const { error } = await supabase.from('prospects').insert({
      name,
      business_name: business_name || null,
      email,
      source: 'website_lead_form',
      status: 'new',
    })
    if (error) {
      console.error('[Lead] Supabase insert failed:', error.message, error.details, error.hint)
      return { success: false, error: 'Failed to save. Try again.' }
    }
  } else {
    console.log('[Lead] No Supabase — logging locally:', { name, business_name, email })
  }

  // Send notification email (best-effort — never fails the form)
  try {
    const resend = getResend()
    const notifyEmail = process.env.LEAD_NOTIFICATION_EMAIL
    if (resend && notifyEmail) {
      await resend.emails.send({
        from: 'Backlit Supply <onboarding@resend.dev>',
        to: notifyEmail,
        subject: `New lead: ${business_name || name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px;">
            <h2 style="margin-bottom: 16px;">New lead from backlitsupply.com</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Business:</strong> ${business_name || '(not provided)'}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Submitted:</strong> ${new Date().toISOString()}</p>
            <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e5e5;" />
            <p><a href="mailto:${email}">Reply directly to ${name}</a></p>
          </div>
        `,
      })
    }
  } catch (err) {
    console.error('[Lead] Resend notification failed:', err)
  }

  return { success: true }
}
