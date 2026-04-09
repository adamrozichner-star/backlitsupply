import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client using service role key
// Guards against missing env vars so the build doesn't crash

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

export function getSupabaseServer() {
  if (!supabaseUrl || !supabaseSecretKey) {
    console.warn('[Supabase] Missing env vars — database operations will fail gracefully')
    return null
  }
  return createClient(supabaseUrl, supabaseSecretKey)
}
