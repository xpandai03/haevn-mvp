import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/admin/allowlist'
import { recomputeAllMatches } from '@/lib/services/computeMatches'
import { sendNotification } from '@/lib/services/notifications'

/**
 * POST /api/admin/run-full-cycle
 *
 * Runs the complete Match Monday cycle in one click:
 *   1. Recompute all matches
 *   2. Force-release all pending matches
 *   3. Send SMS/email notifications for newly released matches
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email || !isAdminUser(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const results = {
    compute: { total: 0, computed: 0, errors: 0 },
    release: { released: 0 },
    notify: { sent: 0, skipped: 0, errors: 0 },
  }

  // ── Step 1: Recompute all matches ──
  console.log('[run-full-cycle] Step 1: Recomputing all matches...')
  try {
    const computeResult = await recomputeAllMatches()
    results.compute = {
      total: computeResult.total,
      computed: computeResult.computed,
      errors: computeResult.errors,
    }
    console.log(`[run-full-cycle] Compute done: ${computeResult.computed}/${computeResult.total} partnerships`)
  } catch (err: any) {
    console.error('[run-full-cycle] Compute failed:', err.message)
    results.compute.errors = 1
  }

  // ── Step 2: Force-release all pending matches ──
  console.log('[run-full-cycle] Step 2: Releasing pending matches...')
  const now = new Date().toISOString()

  const { count: pendingBefore } = await admin
    .from('computed_matches')
    .select('id', { count: 'exact', head: true })
    .gt('release_at', now)

  const { error: releaseError } = await admin
    .from('computed_matches')
    .update({ release_at: now })
    .gt('release_at', now)

  if (releaseError) {
    console.error('[run-full-cycle] Release error:', releaseError)
  }
  results.release.released = pendingBefore ?? 0
  console.log(`[run-full-cycle] Released ${results.release.released} matches`)

  // ── Step 3: Send notifications for unnotified matches ──
  console.log('[run-full-cycle] Step 3: Sending notifications...')

  const { data: unnotifiedRows } = await admin
    .from('computed_matches')
    .select('partnership_a')
    .lte('release_at', new Date().toISOString())
    .is('sms_notified_at', null)

  const partnershipIds = [...new Set((unnotifiedRows || []).map(r => r.partnership_a))]
  console.log(`[run-full-cycle] ${partnershipIds.length} partnerships to notify`)

  for (const partnershipId of partnershipIds) {
    const { data: partnership } = await admin
      .from('partnerships')
      .select('id, phone')
      .eq('id', partnershipId)
      .single()

    if (!partnership?.phone) {
      results.notify.skipped++
      await markNotified(admin, partnershipId)
      continue
    }

    // Check live market
    const { data: member } = await admin
      .from('partnership_members')
      .select('user_id')
      .eq('partnership_id', partnershipId)
      .limit(1)
      .single()

    if (member) {
      const { data: profile } = await admin
        .from('profiles')
        .select('msa_status')
        .eq('user_id', member.user_id)
        .single()

      if (profile?.msa_status !== 'live') {
        results.notify.skipped++
        await markNotified(admin, partnershipId)
        continue
      }
    }

    // Get email
    let userEmail: string | null = null
    if (member) {
      const { data: authUser } = await admin.auth.admin.getUserById(member.user_id)
      userEmail = authUser?.user?.email || null
    }

    const result = await sendNotification({
      type: 'match',
      phone: partnership.phone,
      email: userEmail,
    })

    if (result.sms.sent || result.email.sent) {
      results.notify.sent++
      await markNotified(admin, partnershipId)
    } else {
      results.notify.errors++
    }
  }

  // ── Log system events ──
  await admin.from('system_events').insert([
    { event_type: 'match_compute', triggered_by: 'admin_full_cycle', metadata: results.compute },
    { event_type: 'match_release', triggered_by: 'admin_full_cycle', metadata: results.release },
    { event_type: 'sms_notify', triggered_by: 'admin_full_cycle', metadata: results.notify },
  ]).then(() => {}, () => {})

  console.log('[run-full-cycle] Complete:', results)
  return NextResponse.json(results)
}

async function markNotified(admin: ReturnType<typeof createAdminClient>, partnershipId: string) {
  await admin
    .from('computed_matches')
    .update({ sms_notified_at: new Date().toISOString() })
    .eq('partnership_a', partnershipId)
    .is('sms_notified_at', null)
}
