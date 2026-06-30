/**
 * Launch email blast — the corrected-cron send path, driven in controllable
 * BATCHES so the operator gets a live per-recipient tally and can stop on mass
 * failure. Identical logic to cron/notify-matches: recipients = partnerships
 * with a released, un-notified result at score >= 77 (Matches + Recommendations),
 * gated to live markets; each gets the branded magic-link email (SMS only if a
 * phone exists — the imported cohort has none); sms_notified_at is set on
 * success so reruns/next batches don't double-send.
 *
 * ⚠️ TEMPORARY, secret-gated. Delete after launch.
 *
 * GET /api/admin/blast-matches?secret=...&limit=15   (omit limit for default 15)
 *     &dry=1  -> report who WOULD be sent, send nothing
 */
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotification, buildSignInUrl, serializeNotifyError } from '@/lib/services/notifications'

export const maxDuration = 300

const SECRET = 'biuHbjkiCAKCMk0oi_Ly6EC4yZA'

function ok(provided: string | null): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(SECRET)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  if (!ok(url.searchParams.get('secret'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '15', 10) || 15, 1), 40)
  const dry = url.searchParams.get('dry') === '1'
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Recipient pool: released, un-notified, score >= 77 (Matches + Recommendations).
  const { data: rows, error: qErr } = await supabase
    .from('computed_matches')
    .select('partnership_a')
    .gte('score', 77)
    .lte('release_at', now)
    .is('sms_notified_at', null)
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  const allRemaining = [...new Set((rows || []).map((r) => r.partnership_a))]
  const batch = allRemaining.slice(0, limit)

  const results: Array<{
    partnership: string
    email: string | null
    emailSent: boolean
    smsSent: boolean
    error: string | null
    skippedReason?: string
  }> = []
  let accepted = 0
  let failed = 0
  let skipped = 0

  for (const partnershipId of batch) {
    const { data: partnership } = await supabase
      .from('partnerships').select('id, phone').eq('id', partnershipId).single()

    const { data: member } = await supabase
      .from('partnership_members').select('user_id').eq('partnership_id', partnershipId).limit(1).single()

    // Live-market gate (matches the cron).
    if (member) {
      const { data: profile } = await supabase
        .from('profiles').select('msa_status').eq('user_id', member.user_id).single()
      if (profile?.msa_status !== 'live') {
        skipped++
        results.push({ partnership: partnershipId, email: null, emailSent: false, smsSent: false, error: null, skippedReason: 'not_live_market' })
        if (!dry) await markNotified(supabase, partnershipId)
        continue
      }
    }

    let userEmail: string | null = null
    if (member) {
      const { data: authUser } = await supabase.auth.admin.getUserById(member.user_id)
      userEmail = authUser?.user?.email || null
    }

    if (!partnership?.phone && !userEmail) {
      skipped++
      results.push({ partnership: partnershipId, email: null, emailSent: false, smsSent: false, error: null, skippedReason: 'no_phone_no_email' })
      continue
    }

    if (dry) {
      results.push({ partnership: partnershipId, email: userEmail, emailSent: false, smsSent: false, error: null, skippedReason: 'dry_run' })
      continue
    }

    const signInUrl = userEmail ? await buildSignInUrl(userEmail) : null
    const result = await sendNotification({
      type: 'match',
      phone: partnership?.phone ?? null,
      email: userEmail,
      partnershipId,
      signInUrl: signInUrl ?? undefined,
    })

    const sentAny = result.email.sent || result.sms.sent
    if (sentAny) {
      accepted++
      await markNotified(supabase, partnershipId)
    } else {
      failed++
    }
    results.push({
      partnership: partnershipId,
      email: userEmail,
      emailSent: result.email.sent,
      smsSent: result.sms.sent,
      error: serializeNotifyError(result.email.error) || serializeNotifyError(result.sms.error),
    })
  }

  return NextResponse.json({
    dry,
    batchProcessed: batch.length,
    accepted,
    failed,
    skipped,
    remainingBeforeBatch: allRemaining.length,
    remainingAfterBatch: dry ? allRemaining.length : Math.max(0, allRemaining.length - accepted - skipped),
    fromAddress: 'HAEVN <notifications@haevn.app>',
    results,
  })
}

async function markNotified(supabase: ReturnType<typeof createAdminClient>, partnershipId: string) {
  await supabase
    .from('computed_matches')
    .update({ sms_notified_at: new Date().toISOString() })
    .eq('partnership_a', partnershipId)
    .is('sms_notified_at', null)
}
