/**
 * Nudge-state derivation: has the MATCH nudged the VIEWER?
 *
 * `nudges` is keyed on auth user ids (sender_id → recipient_id). "This match
 * nudged the viewer" = a row where sender_id is the match partnership's member
 * user id and recipient_id is one of the viewer partnership's member user ids.
 * The table is effectively empty today, so the nudged card state ships dark until
 * real nudge data exists — this query is what lights it up when it does.
 */

import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

async function memberUserIds(admin: Admin, partnershipId: string): Promise<string[]> {
  const { data } = await admin.from('partnership_members').select('user_id').eq('partnership_id', partnershipId)
  return (data ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean)
}

/** True when any member of `matchPartnershipId` has nudged any member of `viewerPartnershipId`. */
export async function hasMatchNudgedViewer(
  admin: Admin,
  viewerPartnershipId: string,
  matchPartnershipId: string
): Promise<boolean> {
  const [viewerUsers, matchUsers] = await Promise.all([
    memberUserIds(admin, viewerPartnershipId),
    memberUserIds(admin, matchPartnershipId),
  ])
  if (viewerUsers.length === 0 || matchUsers.length === 0) return false

  const { data, error } = await admin
    .from('nudges')
    .select('id')
    .in('sender_id', matchUsers)
    .in('recipient_id', viewerUsers)
    .limit(1)

  if (error) {
    console.warn('[nudgeState] query failed (treating as no nudge):', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}
