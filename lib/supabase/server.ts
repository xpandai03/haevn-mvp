import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/supabase'

// Regular server client with anon key for server components
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
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

// Service role client for admin operations (API routes only!)
// WARNING: Never expose this to the client or use in Server Components
export function createServiceRoleClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createServerClient<Database>(
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