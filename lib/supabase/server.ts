import type { Database } from '@/lib/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

// Lazy imports to avoid build-time SSR mismatch errors
// This prevents "You're importing a component that needs next/headers" error
let createServerClientFn: any
let cookiesFn: any

/**
 * Creates a Supabase server client with lazy-loaded dependencies
 * Safe to import in any context (middleware, route handlers, server components)
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  // Lazy-load dependencies at runtime only when needed
  if (!createServerClientFn) {
    const ssr = await import('@supabase/ssr')
    createServerClientFn = ssr.createServerClient
    const nh = await import('next/headers')
    cookiesFn = nh.cookies
  }

  const cookieStore = await cookiesFn()

  return createServerClientFn<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // In production, use secure cookies for cross-domain (Veriff)
              // In development, use lax for localhost
              const isProduction = process.env.NODE_ENV === 'production'
              cookieStore.set(name, value, {
                ...options,
                sameSite: isProduction ? 'none' : 'lax',
                secure: isProduction
              })
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

  // Lazy-load createServerClient
  if (!createServerClientFn) {
    const ssr = await import('@supabase/ssr')
    createServerClientFn = ssr.createServerClient
  }

  return createServerClientFn<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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
