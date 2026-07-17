/**
 * Shared admin gate. Replaces the getUser() + isAdminUser() boilerplate that is
 * currently copy-pasted into every admin page and route.
 *
 * - requireAdminPage(): for server components / layouts — redirects on failure.
 * - requireAdminRoute(): for route handlers — returns a 401 response to return.
 *
 * Both use the cookie client (RLS-enforced) purely to resolve identity; actual
 * data queries still use createAdminClient() at the call site. This is the gate,
 * not the query client.
 *
 * NOTE (follow-up): the existing admin pages/routes are intentionally left on
 * their inline gates in this PR. They should be migrated to this helper next.
 */

import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin/allowlist'

/** Resolve the current user if (and only if) they are an admin. */
async function resolveAdmin(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminUser(user.email)) return null
  return user
}

/** Page/layout gate: returns the admin user, or redirects non-admins away. */
export async function requireAdminPage(): Promise<User> {
  const user = await resolveAdmin()
  if (!user) redirect('/account-details')
  return user
}

export type AdminRouteGate =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

/**
 * Route-handler gate. Usage:
 *   const gate = await requireAdminRoute()
 *   if (!gate.ok) return gate.response
 *   const { user } = gate
 */
export async function requireAdminRoute(): Promise<AdminRouteGate> {
  const user = await resolveAdmin()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { ok: true, user }
}
