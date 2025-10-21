'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * NUCLEAR OPTION: Force clear ALL session data
 *
 * Use this when normal signOut doesn't work.
 * Clears ALL cookies, not just auth cookies.
 */
export async function forceClearSession(): Promise<{ success: boolean, clearedCount: number }> {
  console.log('[forceClearSession] 💣 NUCLEAR OPTION - Clearing ALL session data')

  try {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()

    console.log('[forceClearSession] Total cookies found:', allCookies.length)

    let clearedCount = 0

    // Clear ALL cookies (not just auth cookies)
    allCookies.forEach(cookie => {
      console.log('[forceClearSession] Deleting cookie:', cookie.name)
      cookieStore.delete(cookie.name)
      clearedCount++
    })

    // Also clear specific known cookie names (in case getAll() misses some)
    const knownCookieNames = [
      'sb-localhost-auth-token',
      'sb-localhost-auth-token-code-verifier',
      'haevn-auth',
      'haevn_onboarding'
    ]

    knownCookieNames.forEach(name => {
      console.log('[forceClearSession] Force deleting:', name)
      cookieStore.delete(name)
    })

    console.log('[forceClearSession] ✅ Cleared', clearedCount, 'cookies')
    console.log('[forceClearSession] ✅ Force cleared known auth cookies')

    return { success: true, clearedCount }
  } catch (error) {
    console.error('[forceClearSession] ❌ Error:', error)
    return { success: false, clearedCount: 0 }
  }
}

/**
 * Debug helper: List all current cookies
 */
export async function listAllCookies(): Promise<{ name: string, value: string }[]> {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  console.log('[listAllCookies] Found', allCookies.length, 'cookies:')
  allCookies.forEach(cookie => {
    console.log('  -', cookie.name, '=', cookie.value.substring(0, 50) + '...')
  })

  return allCookies.map(c => ({ name: c.name, value: c.value }))
}
