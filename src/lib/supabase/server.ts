import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client using service role key
// Guards against missing env vars so the build doesn't crash
// Reads env vars lazily so dotenv can populate them before first call

export function getSupabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !supabaseSecretKey) {
    console.warn('[Supabase] Missing env vars — database operations will fail gracefully')
    return null
  }
  return createClient(supabaseUrl, supabaseSecretKey)
}
