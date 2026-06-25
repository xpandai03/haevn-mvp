/**
 * Admin API Route: Recompute All Matches
 * 
 * Admin-only endpoint to trigger recomputation of all matches.
 * Useful for backfilling existing users or refreshing match data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/admin/allowlist'
import { recomputeAllMatches } from '@/lib/services/computeMatches'

// Full-pool recompute is long-running; match the cron's ceiling (the cron route
// already sets this). The console no longer REQUIRES this request to show data
// (it reads stored computed_matches on load) — this just makes the dev's manual
// "Recompute All Matches" more tolerant.
export const maxDuration = 300

// Temporary GET handler to verify deployment build version (no auth required)
export async function GET() {
  return NextResponse.json({
    build: '2026-03-30T2',
    commit: 'b32dcce+GET',
    route: 'app/api/admin/recompute-matches/route.ts',
    timestamp: new Date().toISOString(),
  })
}

export async function POST(request: NextRequest) {
  console.log(`🔥 ACTIVE RECOMPUTE PATH — route.ts BUILD=2026-03-30T1`)
  try {
    // Verify admin access
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email || !isAdminUser(user.email)) {
      console.log(`🔥 RECOMPUTE DENIED — not admin: ${user?.email}`)
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    console.log(`🔥 RECOMPUTE AUTHORIZED — admin=${user.email}, calling recomputeAllMatches()`)

    // Capture run start BEFORE computing so the same-day release override
    // below only touches rows written during this run.
    const runStartedAt = new Date()

    // Trigger recomputation (this may take a while)
    const result = await recomputeAllMatches()

    // Same-day release override — mirrors the cron at
    // app/api/cron/recompute-matches/route.ts. recomputeAllMatches() sets
    // release_at via getNextMonday(), which on a Monday after 12:00 UTC
    // returns NEXT Monday. Without this, clicking "Recompute" on Monday
    // morning would push every match a week out (and clobber the cron's
    // same-day release). Pull this run's rows forward to today 12:00 UTC.
    //
    // The cron is scheduled Mondays only (0 12 * * 1) so it needs no day
    // guard; the admin button can be clicked any day, so we gate on Monday
    // to preserve the weekly cadence and avoid releasing early mid-week.
    let rowsReleasedToday = 0
    const isMonday = runStartedAt.getUTCDay() === 1 // 0=Sun, 1=Mon
    if (isMonday) {
      const admin = createAdminClient()
      const todayNoonUtc = new Date(runStartedAt)
      todayNoonUtc.setUTCHours(12, 0, 0, 0)
      const todayNoonUtcIso = todayNoonUtc.toISOString()

      const { data: releasedRows, error: releaseError } = await admin
        .from('computed_matches')
        .update({ release_at: todayNoonUtcIso })
        .gte('computed_at', runStartedAt.toISOString()) // only this run's rows
        .gt('release_at', todayNoonUtcIso) // only ones scheduled later
        .select('id')

      rowsReleasedToday = releasedRows?.length ?? 0

      if (releaseError) {
        console.error('[API /admin/recompute-matches] Release update failed:', releaseError)
      } else {
        console.log(
          `[API /admin/recompute-matches] Pulled ${rowsReleasedToday} rows forward to release_at=${todayNoonUtcIso}`
        )
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        total: result.total,
        computed: result.computed,
        errors: result.errors,
        rows_released_today: rowsReleasedToday,
        details: result.details, // Full per-partnership breakdown
      },
    })
  } catch (error: any) {
    console.error('[API /admin/recompute-matches] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to recompute matches',
      },
      { status: 500 }
    )
  }
}
