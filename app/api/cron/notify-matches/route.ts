import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotification, buildSignInUrl } from '@/lib/services/notifications'
import { getReleaseEligibility } from '@/lib/markets/releaseGate'

/**
 * Why a run is being logged. A 0-eligible run is HEALTHY — it means no user has
 * a pair they haven't already been notified about ("you have a new match" only
 * fires for genuinely new pairs). Before this, a 0-row run returned early and
 * wrote nothing, so a silent no-op was indistinguishable from a broken cron.
 */
type NotifyReason = 'no_new_pairs' | 'sent' | 'error'

interface NotifyRunLog {
  eligible: number
  sent: number
  skipped: number
  errors: number
  reason: NotifyReason
  detail?: string
  /** City-gating audit: how many partnerships were withheld because their
   *  market is not live (or their city didn't resolve -> fail closed). Never a
   *  silent skip — this is the record that a pre-launch city was protected. */
  excluded_non_live_market?: number
  excluded_by_city?: Record<string, number>
  /** Set when the market index could not be built: we failed CLOSED. */
  gate_failed_closed?: boolean
}

/**
 * Observability only — writes one `notify_run` system_event on EVERY exit path
 * (0-row, success, and error). Never throws; never affects who gets notified.
 */
async function logNotifyRun(
  supabase: ReturnType<typeof createAdminClient>,
  log: NotifyRunLog
) {
  try {
    await supabase.from('system_events').insert({
      event_type: 'notify_run',
      triggered_by: 'cron',
      metadata: log,
    })
  } catch (err) {
    console.error('[Cron notify-matches] notify_run log failed:', err)
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const summary = { sent: 0, skipped: 0, errors: 0 }

  try {
    // Find all partnerships with released-but-un-notified results. Notify the
    // full launch set: Matches (>= 80) AND Recommendations (77–79). Both bands
    // get the "your matches are ready" SMS so all 87 recipients are covered.
    const { data: rows, error: queryError } = await supabase
      .from('computed_matches')
      .select('partnership_a')
      .gte('score', 77)
      .lte('release_at', new Date().toISOString())
      .is('sms_notified_at', null)

    if (queryError) {
      console.error('[Cron notify-matches] Query error:', queryError)
      await logNotifyRun(supabase, {
        eligible: 0, sent: 0, skipped: 0, errors: 1,
        reason: 'error', detail: queryError.message,
      })
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    if (!rows || rows.length === 0) {
      // HEALTHY no-op: nobody has an un-notified pair. Logged (not silent) so the
      // console can tell "0 new pairs, nothing to notify" apart from a failure.
      console.log('[Cron notify-matches] No un-notified matches found')
      await logNotifyRun(supabase, {
        eligible: 0, sent: 0, skipped: 0, errors: 0, reason: 'no_new_pairs',
      })
      return NextResponse.json({ ...summary, message: 'No matches to notify' })
    }

    // Deduplicate partnership IDs
    const candidateIds = [...new Set(rows.map(r => r.partnership_a))]

    // ── CITY GATE ────────────────────────────────────────────────────────────
    // Only members in a LIVE market may be notified. Users are loaded for cities
    // that haven't launched (Tampa/Portland) — notifying them is user-facing and
    // hard to undo. Unresolved city => excluded (fail closed).
    const gate = await getReleaseEligibility(candidateIds)
    const partnershipIds = candidateIds.filter(id => gate.eligible.has(id))
    const excludedCount = candidateIds.length - partnershipIds.length

    if (!gate.ok) {
      // Could not resolve markets (e.g. migration not applied). Send NOTHING.
      console.error('[Cron notify-matches] FAIL CLOSED — market gate unavailable; notifying nobody.')
      await logNotifyRun(supabase, {
        eligible: 0, sent: 0, skipped: candidateIds.length, errors: 0,
        reason: 'error', detail: 'market gate unavailable — failed closed',
        excluded_non_live_market: candidateIds.length,
        gate_failed_closed: true,
      })
      return NextResponse.json({ ...summary, skipped: candidateIds.length, message: 'market gate unavailable — failed closed' })
    }

    if (excludedCount > 0) {
      console.log(
        `[Cron notify-matches] CITY GATE withheld ${excludedCount} partnership(s) in non-live markets:`,
        gate.excludedByCity
      )
    }
    console.log(`[Cron notify-matches] ${partnershipIds.length} partnerships to notify (live markets only)`)

    if (partnershipIds.length === 0) {
      await logNotifyRun(supabase, {
        eligible: 0, sent: 0, skipped: excludedCount, errors: 0,
        reason: 'no_new_pairs',
        excluded_non_live_market: excludedCount,
        excluded_by_city: gate.excludedByCity,
      })
      return NextResponse.json({ ...summary, skipped: excludedCount, message: 'No live-market matches to notify' })
    }

    for (const partnershipId of partnershipIds) {
      // Phone may be null — the imported cohort has no phone numbers, so EMAIL
      // is the primary channel. We no longer skip no-phone recipients.
      const { data: partnership } = await supabase
        .from('partnerships')
        .select('id, phone')
        .eq('id', partnershipId)
        .single()

      // Resolve the owner (needed for the live-market gate, email, magic link).
      const { data: member } = await supabase
        .from('partnership_members')
        .select('user_id')
        .eq('partnership_id', partnershipId)
        .limit(1)
        .single()

      if (member) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('msa_status')
          .eq('user_id', member.user_id)
          .single()

        // Mirror the matches-display gate: only an explicit 'waitlist' blocks;
        // 'live' and legacy null are both notifiable (imported cohort is null).
        if (profile?.msa_status === 'waitlist') {
          console.log(`[Cron notify-matches] Skip ${partnershipId}: waitlisted`)
          summary.skipped++
          await markNotified(supabase, partnershipId)
          continue
        }
      }

      // Owner email — the primary channel for this launch (all imported users
      // have one; none have a phone).
      let userEmail: string | null = null
      if (member) {
        const { data: authUser } = await supabase.auth.admin.getUserById(member.user_id)
        userEmail = authUser?.user?.email || null
      }

      // Unreachable on ANY channel — don't burn the notified flag so it can be
      // retried if contact info is added later.
      if (!partnership?.phone && !userEmail) {
        console.log(`[Cron notify-matches] Skip ${partnershipId}: no phone AND no email`)
        summary.skipped++
        continue
      }

      // Per-user passwordless magic sign-in link (imported users have no
      // password). Delivered in the email CTA (and SMS if a phone ever exists).
      const signInUrl = userEmail ? await buildSignInUrl(userEmail) : null

      // Send via notification system. SMS only fires if a phone exists; email
      // carries the branded magic link for the no-phone cohort.
      const result = await sendNotification({
        type: 'match',
        phone: partnership?.phone ?? null,
        email: userEmail,
        partnershipId,
        signInUrl: signInUrl ?? undefined,
      })

      if (result.sms.sent || result.email.sent) {
        console.log(`[Cron notify-matches] Notified ${partnershipId}: sms=${result.sms.sent} email=${result.email.sent}`)
        summary.sent++
        await markNotified(supabase, partnershipId)
      } else {
        console.error(`[Cron notify-matches] All channels failed for ${partnershipId}`)
        summary.errors++
        // Do NOT mark as notified — retry next run
      }
    }

    console.log('[Cron notify-matches] Complete:', summary)

    // Log system events (existing tiles keep reading these — unchanged)
    await supabase.from('system_events').insert([
      { event_type: 'match_release', triggered_by: 'cron', metadata: { released: partnershipIds.length } },
      { event_type: 'sms_notify', triggered_by: 'cron', metadata: summary },
    ]).then(() => {}, () => {})

    // Always-written run log. 'error' only when we had eligible users and
    // delivered to none of them; otherwise the run did its job.
    await logNotifyRun(supabase, {
      eligible: partnershipIds.length,
      sent: summary.sent,
      skipped: summary.skipped,
      errors: summary.errors,
      reason: summary.sent === 0 && summary.errors > 0 ? 'error' : 'sent',
      excluded_non_live_market: excludedCount,
      excluded_by_city: gate.excludedByCity,
    })

    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('[Cron notify-matches] Unexpected error:', error)
    await logNotifyRun(supabase, {
      eligible: 0,
      sent: summary.sent,
      skipped: summary.skipped,
      errors: summary.errors + 1,
      reason: 'error',
      detail: error?.message || String(error),
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function markNotified(supabase: ReturnType<typeof createAdminClient>, partnershipId: string) {
  const { error } = await supabase
    .from('computed_matches')
    .update({ sms_notified_at: new Date().toISOString() })
    .eq('partnership_a', partnershipId)
    .is('sms_notified_at', null)

  if (error) {
    console.error(`[Cron notify-matches] Failed to mark notified for ${partnershipId}:`, error)
  }
}
