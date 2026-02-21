import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/supabase'

// Known Supabase project URL — hardcoded fallback because NEXT_PUBLIC_SUPABASE_URL
// is baked into the client bundle at build time and may be misconfigured
// (e.g. set to the Vercel app URL instead of the Supabase project URL).
const KNOWN_SUPABASE_URL = 'https://sdepasybfkmxcswaxnsz.supabase.co'

function getSupabaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const url = raw.replace(/\/+$/, '')
  if (url.includes('supabase.co') || url.includes('supabase.in')) {
    return url
  }
  console.warn(
    '[Supabase Client] NEXT_PUBLIC_SUPABASE_URL does not point to Supabase:',
    url || '(empty)',
    '— using hardcoded fallback'
  )
  return KNOWN_SUPABASE_URL
}

const resolvedUrl = getSupabaseUrl()
const resolvedAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

console.log('[Supabase Client] URL =', resolvedUrl)

// Instrumented fetch — logs all /auth/v1/ requests for debugging
const instrumentedFetch: typeof globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : (input as Request).url
  const method = init?.method || 'GET'

  if (url.includes('/auth/v1/')) {
    console.log(`[Supabase fetch] >>> ${method} ${url}`)
  }

  const response = await globalThis.fetch(input, init)

  if (url.includes('/auth/v1/')) {
    try {
      const clone = response.clone()
      const text = await clone.text()
      console.log(`[Supabase fetch] <<< ${method} ${url} → ${response.status} body=${text.slice(0, 200)}`)
    } catch { /* ignore clone errors */ }
  }

  return response
}

// Browser client with cookie-based session persistence for SSR
export const supabase = createBrowserClient<Database>(
  resolvedUrl,
  resolvedAnonKey,
  {
    global: { fetch: instrumentedFetch }
  }
)

// Export a function for compatibility with existing code
export function createClient() {
  return supabase
}