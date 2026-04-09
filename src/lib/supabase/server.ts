import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client using service role key
// Guards against missing env vars so the build doesn't crash

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function getSupabaseServer() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[Supabase] Missing env vars — database operations will fail gracefully')
    return null
  }
  return createClient(supabaseUrl, supabaseServiceKey)
}
