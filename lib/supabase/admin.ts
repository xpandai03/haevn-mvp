import { createClient } from '@supabase/supabase-js'

const KNOWN_SUPABASE_URL = 'https://sdepasybfkmxcswaxnsz.supabase.co'

function getSupabaseUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
  ].filter(Boolean).map(u => u!.replace(/\/+$/, ''))

  for (const url of candidates) {
    if (url.includes('supabase.co') || url.includes('supabase.in')) {
      return url
    }
  }

  console.warn('[Supabase Admin] No valid Supabase URL in env vars, using hardcoded fallback')
  return KNOWN_SUPABASE_URL
}

/**
 * Admin client that bypasses RLS using service role key
 * USE WITH CAUTION - only for server-side operations
 */
export function createAdminClient() {
  const supabaseUrl = getSupabaseUrl()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
