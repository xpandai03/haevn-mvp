import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

// Known Supabase project URL — hardcoded fallback because NEXT_PUBLIC_SUPABASE_URL
// may be unavailable or misconfigured in Vercel serverless runtime.
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

  console.warn('[Supabase Server] No valid Supabase URL in env vars, using hardcoded fallback')
  return KNOWN_SUPABASE_URL
}

/**
 * Creates a Supabase server client with cookie-based auth.
 * Safe to use in route handlers, server actions, and server components.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    getSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component context - cookies can't be set here
          }
        },
      },
    }
  )
}

/**
 * Service role client for admin operations (API routes only!)
 * WARNING: Never expose this to the client or use in Server Components
 */
export async function createServiceRoleClient(): Promise<SupabaseClient<Database>> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(
    getSupabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // Service role client doesn't need cookies
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
