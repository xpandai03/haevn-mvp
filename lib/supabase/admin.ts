import { createClient } from '@supabase/supabase-js'

/**
 * Admin client that bypasses RLS using service role key
 * USE WITH CAUTION - only for server-side operations
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // DEBUG: Log credential status for production verification
  console.log('[Supabase Admin] 🔐 Initializing admin client:', {
    hasUrl: !!supabaseUrl,
    hasServiceKey: !!serviceRoleKey,
    urlPrefix: supabaseUrl?.substring(0, 30) || 'MISSING',
    keyPrefix: serviceRoleKey?.substring(0, 8) || 'MISSING',
    keyType: serviceRoleKey?.startsWith('eyJ') ? 'service_role' : serviceRoleKey?.startsWith('sbp_') ? 'service_role' : 'unknown'
  })

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[Supabase Admin] ❌ Missing credentials:', {
      url: !!supabaseUrl,
      key: !!serviceRoleKey
    })
    throw new Error('Missing Supabase admin credentials')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
