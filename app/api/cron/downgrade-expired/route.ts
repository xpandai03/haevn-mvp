import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

/**
 * Daily cron that downgrades expired HAEVN+ memberships in the DB.
 *
 * Gating is already enforced at read time (getUserMembershipTier and
 * loadSidebarContext both treat a paid tier past membership_expires_at as
 * 'free'), so this cron is a hygiene pass — it makes the stored state match
 * what users already experience, rather than being load-bearing for access.
 *
 * Flow:
 *   1. Auth-gate by Bearer $CRON_SECRET (same pattern as recompute-matches).
 *   2. Set membership_tier='free' on every partnership whose
 *      membership_expires_at is in the past and is still non-free.
 *   3. Leave membership_expires_at intact for purchase-history auditing.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nowIso = new Date().toISOString()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('partnerships')
    .update({ membership_tier: 'free' })
    .lt('membership_expires_at', nowIso)
    .neq('membership_tier', 'free')
    .select('id')

  if (error) {
    console.error('[Cron downgrade-expired] Update failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const downgraded = data?.length ?? 0
  console.log(`[Cron downgrade-expired] Downgraded ${downgraded} expired memberships at ${nowIso}`)

  return NextResponse.json({ ok: true, downgraded, ran_at: nowIso })
}
