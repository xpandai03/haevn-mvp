import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recomputeAllMatches } from '@/lib/services/computeMatches'
import { getReleaseEligibility } from '@/lib/markets/releaseGate'

// Long-running: iterates every live partnership and computes pairwise
// compatibility. 300s is the Pro-plan max; Hobby caps lower but this
// is the right ceiling for the work this does.
export const maxDuration = 300

/**
 * Weekly Match Monday cron. Runs at 0 12 * * 1 (12:00 UTC = 8:00 AM
 * ET) — two hours before /api/cron/notify-matches at 0 14 * * 1.
 *
 * Flow:
 *   1. Auth-gate by Bearer $CRON_SECRET (same pattern as notify-matches).
 *   2. Call recomputeAllMatches() — iterates every partnership with
 *      profile_state='live' and writes computed_matches rows. Each row
 *      gets release_at via getNextMonday() in computeMatches.ts which,
 *      because the cron fires AT 12:00 UTC Monday (not before it),
 *      sets release_at to NEXT Monday — one week away.
 *   3. Override release_at on every row from this run to TODAY 12:00
 *      UTC so the freshly computed matches are visible immediately
 *      and the notify cron at 14:00 UTC picks them up the same day.
 *      Bounded to runs from this cron only via a runStartedAt filter.
 *   4. Log a row to system_events with full counts for observability.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runStartedAt = new Date()
  console.log(`[Cron recompute-matches] Started at ${runStartedAt.toISOString()}`)

  let recomputeResult
  try {
    recomputeResult = await recomputeAllMatches()
  } catch (error: any) {
    console.error('[Cron recompute-matches] recomputeAllMatches threw:', error)
    return NextResponse.json(
      { error: error?.message || 'recomputeAllMatches threw', stage: 'compute' },
      { status: 500 }
    )
  }

  console.log(
    `[Cron recompute-matches] Compute done: total=${recomputeResult.total} computed=${recomputeResult.computed} errors=${recomputeResult.errors}`
  )

  // Pull every row written during this run forward so it releases
  // today instead of next Monday. Today's 12:00 UTC is the canonical
  // "8 AM ET release" timestamp the rest of the system expects.
  const admin = createAdminClient()
  const todayNoonUtc = new Date(runStartedAt)
  todayNoonUtc.setUTCHours(12, 0, 0, 0)
  const todayNoonUtcIso = todayNoonUtc.toISOString()

  // ── CITY GATE ──────────────────────────────────────────────────────────────
  // Only pull rows forward for members in a LIVE market. Rows for non-live
  // markets (Tampa/Portland pre-launch) keep their future release_at and are
  // never surfaced this cycle. Unresolved city => excluded (fail closed).
  // NOTE: this gates RELEASE only — every partnership was still computed above.
  const gate = await getReleaseEligibility()
  const eligibleIds = [...gate.eligible]

  let releasedCount = 0
  let releaseError: { message: string } | null = null

  if (!gate.ok) {
    releaseError = { message: 'market gate unavailable — failed closed, released nothing' }
    console.error('[Cron recompute-matches] FAIL CLOSED — market gate unavailable; released nothing.')
  } else if (eligibleIds.length === 0) {
    console.warn('[Cron recompute-matches] No live-market partnerships — released nothing.')
  } else {
    // Chunk the IN() list — eligible can be in the hundreds.
    const CHUNK = 200
    for (let i = 0; i < eligibleIds.length; i += CHUNK) {
      const { data: rows, error } = await admin
        .from('computed_matches')
        .update({ release_at: todayNoonUtcIso })
        .gte('computed_at', runStartedAt.toISOString())
        .gt('release_at', todayNoonUtcIso)
        .in('partnership_a', eligibleIds.slice(i, i + CHUNK))
        .select('id')
      if (error) { releaseError = error; break }
      releasedCount += rows?.length ?? 0
    }
    const withheld = Object.values(gate.excludedByCity).reduce((s, n) => s + n, 0)
    if (withheld > 0) {
      console.log(
        `[Cron recompute-matches] CITY GATE withheld ${withheld} partnership(s) in non-live markets from release:`,
        gate.excludedByCity
      )
    }
  }

  if (releaseError) {
    console.error('[Cron recompute-matches] Release update failed:', releaseError)
  } else {
    console.log(
      `[Cron recompute-matches] Pulled ${releasedCount} rows forward to release_at=${todayNoonUtcIso}`
    )
  }

  // Observability row — same shape convention as notify-matches uses.
  const metadata = {
    partnerships_total: recomputeResult.total,
    partnerships_computed: recomputeResult.computed,
    errors: recomputeResult.errors,
    rows_released_today: releasedCount,
    release_at: todayNoonUtcIso,
    // City-gating audit — exclusions are never silent.
    excluded_non_live_market: Object.values(gate.excludedByCity).reduce((s, n) => s + n, 0),
    excluded_by_city: gate.excludedByCity,
    gate_failed_closed: !gate.ok,
    started_at: runStartedAt.toISOString(),
    finished_at: new Date().toISOString(),
  }
  await admin
    .from('system_events')
    .insert({
      event_type: 'match_recompute',
      triggered_by: 'cron',
      metadata,
    })
    .then(
      () => {},
      (err) => console.error('[Cron recompute-matches] system_events insert failed:', err)
    )

  return NextResponse.json({
    ok: true,
    ...metadata,
    release_update_error: releaseError?.message ?? null,
  })
}
