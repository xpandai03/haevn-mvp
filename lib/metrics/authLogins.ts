/**
 * Login read — the single engagement-side reader of auth.users.last_sign_in_at.
 *
 * last_sign_in_at lives in the auth schema, so it's read via the Supabase admin
 * API (listUsers pagination), NOT a .from() query. Returns the TIMESTAMP per user
 * (not just a boolean) because engagement needs both "ever" (value present) and
 * "active this week" (value in range).
 *
 * PR #8's lib/renotify/audience.ts has its own boolean-set reader
 * (getLoggedInUserIds); that re-notify engine file is intentionally left untouched
 * (out of scope). This is the engagement reader; a later cleanup can dedupe them.
 * Per-request only — ~630 users, ~1 paginated pass; no caching infra.
 */

import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

/** Map of user_id → last_sign_in_at (ISO string) or null (never signed in). */
export async function getLastSignInMap(admin: Admin): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    for (const u of data.users) map.set(u.id, u.last_sign_in_at ?? null)
    if (data.users.length < 1000) break
  }
  return map
}
