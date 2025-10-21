'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * Server-side sign out that properly clears HTTP cookies
 *
 * CRITICAL: Client-side signOut can't clear HTTP cookies due to browser security.
 * This server action ensures cookies are cleared so server-side auth checks work correctly.
 */
export async function serverSignOut(): Promise<{ success: boolean, error: string | null }> {
  try {
    console.log('[serverSignOut] Starting server-side sign out...')

    // Get server Supabase client (uses cookies)
    const supabase = await createClient()

    // Get current session before clearing
    const { data: { session } } = await supabase.auth.getSession()
    console.log('[serverSignOut] Current session user:', session?.user?.id)
    console.log('[serverSignOut] Current session email:', session?.user?.email)

    // Sign out via server client (this should clear cookies)
    console.log('[serverSignOut] Calling supabase.auth.signOut()...')
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('[serverSignOut] ❌ Supabase signOut error:', error)
      // Continue anyway to force clear cookies
    } else {
      console.log('[serverSignOut] ✅ Supabase signOut successful')
    }

    // CRITICAL: Manually clear all Supabase auth cookies
    // This ensures cookies are gone even if Supabase signOut fails
    console.log('[serverSignOut] Manually clearing auth cookies...')
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()

    console.log('[serverSignOut] Total cookies before cleanup:', allCookies.length)

    let clearedCount = 0
    allCookies.forEach(cookie => {
      // Clear any Supabase auth-related cookies
      // Pattern: sb-{project-ref}-auth-token, sb-{project-ref}-auth-token-code-verifier, etc.
      if (cookie.name.startsWith('sb-') && cookie.name.includes('auth')) {
        console.log('[serverSignOut] Deleting cookie:', cookie.name)
        cookieStore.delete(cookie.name)
        clearedCount++
      }
    })

    console.log('[serverSignOut] Cleared', clearedCount, 'auth cookies')

    // Verify session is cleared
    const { data: { session: newSession } } = await supabase.auth.getSession()
    if (newSession) {
      console.warn('[serverSignOut] ⚠️ Session still exists after signOut!')
      console.warn('[serverSignOut] Session user:', newSession.user?.id)
      return { success: false, error: 'Session not cleared' }
    }

    console.log('[serverSignOut] ✅ Server-side sign out complete')
    console.log('[serverSignOut] Session cleared:', !newSession)

    return { success: true, error: null }
  } catch (error) {
    console.error('[serverSignOut] ❌ Unexpected error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Server-side function to check current auth state
 * Useful for debugging cookie persistence issues
 */
export async function checkServerAuthState(): Promise<{ userId: string | null, email: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    console.log('[checkServerAuthState] Server-side user:', user?.id)
    console.log('[checkServerAuthState] Server-side email:', user?.email)

    return {
      userId: user?.id || null,
      email: user?.email || null
    }
  } catch (error) {
    console.error('[checkServerAuthState] Error:', error)
    return { userId: null, email: null }
  }
}
