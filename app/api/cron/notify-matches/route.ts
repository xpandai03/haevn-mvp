import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotification } from '@/lib/services/notifications'
import { getReleaseEligibility } from '@/lib/markets/releaseGate'
import { issueNotifySignInUrl } from '@/lib/auth/notifySignIn'
import { noMatchPingEnabled } from '@/lib/notify/noMatchAudience'
import { runNoMatchPing, realPingSender, type PingRunResult } from '@/lib/notify/runNoMatchPing'

// Two phases now (matches, then the no-match ping) over an audience that can
// reach ~450 members once release opens to all markets. The ping runner keeps
// its own soft budget well inside this ceiling.
export const maxDuration = 300

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
  /** False once RELEASE_ALL_MARKETS is on: the exclusions above withheld nobody. */
  gate_enforced?: boolean
  /** Second phase. Absent when NO_MATCH_PING_ENABLED is off. */
  no_match_ping?: PingRunResult | { enabled: false }
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

/** What the match phase produced, and whether the run may continue to the ping. */
interface MatchPhaseResult {
  summary: { sent: number; skipped: number; errors: number }
  /** Partnerships messaged in THIS run — excluded from the ping, always. */
  notifiedThisRun: Set<string>
  log: Partial<NotifyRunLog> & { eligible: number; reason: NotifyReason }
  /**
   * True when the market gate could not be built. The ping is skipped too: if we
   * cannot resolve markets we cannot pick the right copy variant, and sending
   * "we're building in your city" to a live market is the mistake the two
   * variants exist to prevent.
   */
  gateFailedClosed: boolean
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  try {
    const phase = await runMatchPhase(supabase)
    const { summary } = phase

    // ── PHASE 2: the no-match ping ──────────────────────────────────────────
    // Runs on EVERY match-phase outcome, including "no new pairs" — on a typical
    // Monday there are no new matches, which is precisely the week the ping is
    // the only thing a member hears. Default OFF.
    let ping: PingRunResult | { enabled: false } = { enabled: false }
    if (noMatchPingEnabled() && !phase.gateFailedClosed) {
      try {
        ping = await runNoMatchPing({
          admin: supabase,
          sender: realPingSender(supabase),
          excludePartnershipIds: phase.notifiedThisRun,
        })
        console.log('[Cron notify-matches] no-match ping:', ping)
      } catch (e: any) {
        // The ping must never take the match phase down with it.
        console.error('[Cron notify-matches] no-match ping threw (non-fatal):', e?.message)
      }
    }

    await logNotifyRun(supabase, {
      skipped: 0,
      errors: 0,
      sent: 0,
      ...phase.log,
      no_match_ping: ping,
    } as NotifyRunLog)

    return NextResponse.json({ ...summary, no_match_ping: ping })
  } catch (error: any) {
    console.error('[Cron notify-matches] Unexpected error:', error)
    await logNotifyRun(supabase, {
      eligible: 0,
      sent: 0,
      skipped: 0,
      errors: 1,
      reason: 'error',
      detail: error?.message || String(error),
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function runMatchPhase(
  supabase: ReturnType<typeof createAdminClient>
): Promise<MatchPhaseResult> {
  const summary = { sent: 0, skipped: 0, errors: 0 }
  const notifiedThisRun = new Set<string>()

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
    // A failed READ is not a failed gate: the ping builds its own audience and
    // can still reach members this Monday.
    return {
      summary, notifiedThisRun, gateFailedClosed: false,
      log: { eligible: 0, errors: 1, reason: 'error', detail: queryError.message },
    }
  }

  if (!rows || rows.length === 0) {
    // HEALTHY no-op: nobody has an un-notified pair. Logged (not silent) so the
    // console can tell "0 new pairs, nothing to notify" apart from a failure.
    console.log('[Cron notify-matches] No un-notified matches found')
    return {
      summary, notifiedThisRun, gateFailedClosed: false,
      log: { eligible: 0, reason: 'no_new_pairs' },
    }
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
    summary.skipped = candidateIds.length
    return {
      summary, notifiedThisRun, gateFailedClosed: true,
      log: {
        eligible: 0, skipped: candidateIds.length,
        reason: 'error', detail: 'market gate unavailable — failed closed',
        excluded_non_live_market: candidateIds.length,
        gate_failed_closed: true,
      },
    }
  }

  // Under RELEASE_ALL_MARKETS the gate withholds nobody; the same counts are
  // still logged so the Monday readout keeps its per-city spread.
  if (excludedCount > 0) {
    console.log(
      `[Cron notify-matches] CITY GATE withheld ${excludedCount} partnership(s) in non-live markets:`,
      gate.excludedByCity
    )
  } else if (!gate.gateEnforced) {
    console.log(
      '[Cron notify-matches] RELEASE_ALL_MARKETS on — no market withheld. Non-live city spread (reporting only):',
      gate.excludedByCity
    )
  }
  console.log(`[Cron notify-matches] ${partnershipIds.length} partnerships to notify`)

  if (partnershipIds.length === 0) {
    summary.skipped = excludedCount
    return {
      summary, notifiedThisRun, gateFailedClosed: false,
      log: {
        eligible: 0, skipped: excludedCount, reason: 'no_new_pairs',
        excluded_non_live_market: excludedCount,
        excluded_by_city: gate.excludedByCity,
        gate_enforced: gate.gateEnforced,
      },
    }
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

    // HANDOFF sign-in link — NOT a raw magic link.
    //
    // This used to call buildSignInUrl(), which mails a single-use Supabase
    // magic link. Mail scanners GET every URL in an email within seconds and
    // burn it, so the member arrives second and sees "expired" (the 2026-08-25
    // impersonation incident, and the reason PR #27/#29 introduced handoffs).
    // Opening release to all markets multiplies Monday link volume, so the
    // failure mode would scale with it. See lib/auth/notifySignIn.ts.
    const signInUrl =
      userEmail && member
        ? await issueNotifySignInUrl(supabase, userEmail, member.user_id)
        : null

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
      notifiedThisRun.add(partnershipId)
      await markNotified(supabase, partnershipId)
    } else {
      console.error(`[Cron notify-matches] All channels failed for ${partnershipId}`)
      summary.errors++
      // Do NOT mark as notified — retry next run
    }
  }

  console.log('[Cron notify-matches] Match phase complete:', summary)

  // Log system events (existing tiles keep reading these — unchanged)
  await supabase.from('system_events').insert([
    { event_type: 'match_release', triggered_by: 'cron', metadata: { released: partnershipIds.length } },
    { event_type: 'sms_notify', triggered_by: 'cron', metadata: summary },
  ]).then(() => {}, () => {})

  // 'error' only when we had eligible users and delivered to none of them;
  // otherwise the phase did its job.
  return {
    summary, notifiedThisRun, gateFailedClosed: false,
    log: {
      eligible: partnershipIds.length,
      sent: summary.sent,
      skipped: summary.skipped,
      errors: summary.errors,
      reason: summary.sent === 0 && summary.errors > 0 ? 'error' : 'sent',
      excluded_non_live_market: excludedCount,
      excluded_by_city: gate.excludedByCity,
      gate_enforced: gate.gateEnforced,
    },
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
