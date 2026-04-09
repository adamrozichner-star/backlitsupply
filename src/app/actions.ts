'use server'

import { getSupabaseServer } from '@/lib/supabase/server'

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
    const { error } = await supabase.from('leads').insert({
      name,
      business_name: business_name || null,
      email,
      source: 'website',
    })
    if (error) {
      console.error('[Lead] Supabase insert failed:', error.message)
      return { success: false, error: 'Failed to save. Try again.' }
    }
  } else {
    console.log('[Lead] No Supabase — logging locally:', { name, business_name, email })
  }

  // TODO: Resend notification email to adam@backlitsupply.com
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({
  //   from: 'Backlit Supply <notifications@backlitsupply.com>',
  //   to: 'adam@backlitsupply.com',
  //   subject: `New lead: ${business_name || name}`,
  //   text: `Name: ${name}\nBusiness: ${business_name}\nEmail: ${email}`,
  // })

  return { success: true }
}
