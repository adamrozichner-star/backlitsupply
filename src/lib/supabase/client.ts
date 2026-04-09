import { createClient } from '@supabase/supabase-js'

// Client-side Supabase client using anon key
// Guards against missing env vars

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export function getSupabaseClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    console.warn('[Supabase] Missing env vars — client operations will fail gracefully')
    return null
  }
  return createClient(supabaseUrl, supabasePublishableKey)
}
