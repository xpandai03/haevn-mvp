/**
 * Admin Access Server Actions
 *
 * Server-side checks for admin access.
 * The allowlist is never exposed to the client.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin/allowlist'

/**
 * Check if the current authenticated user has admin access.
 * This is safe to call from client components - only returns a boolean.
 */
export async function checkAdminAccess(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return false
    }

    return isAdminUser(user.email)
  } catch {
    return false
  }
}
