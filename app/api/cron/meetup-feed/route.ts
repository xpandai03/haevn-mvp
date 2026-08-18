/**
 * GET /api/cron/meetup-feed — nightly (0 8 * * * UTC via vercel.json).
 *
 * Builds the anonymized Meetup Spots snapshot from the current released pair set
 * and pushes it (HMAC-signed) to the client's Emergent endpoint. Fail-safe: if
 * the feature flag / endpoint / secret are unset the build still runs and logs,
 * but the push SKIPS — the cron ships dark and turns on when the URL arrives.
 *
 * Auth mirrors the other crons: Authorization: Bearer ${CRON_SECRET}.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildMeetupFeed, pushMeetupFeed } from '@/lib/meetup/buildFeed'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const startedAt = Date.now()

  try {
    const { payload, stats } = await buildMeetupFeed(admin)
    const push = await pushMeetupFeed(payload)

    const summary = {
      pair_count: payload.pair_count,
      released_rows: stats.releasedRows,
      unresolved_city_members: stats.unresolvedCityMembers,
      unresolved_cities: stats.unresolvedCities,
      unknown_tokens: stats.unknownTokens,
      push,
      duration_ms: Date.now() - startedAt,
    }

    console.log(
      `[Cron meetup-feed] pairs=${payload.pair_count} unresolved=${stats.unresolvedCityMembers} ` +
        `unknown_tokens=${stats.unknownTokens.length} push=${JSON.stringify(push)} ${summary.duration_ms}ms`
    )

    // Observability — counts + ops diagnostics only (no member PII crosses here).
    admin
      .from('system_events')
      .insert({ event_type: 'meetup_feed_push', triggered_by: 'cron', metadata: summary })
      .then(
        () => {},
        (err: unknown) => console.error('[Cron meetup-feed] system_events insert failed:', err)
      )

    return NextResponse.json({ ok: true, ...summary })
  } catch (e: any) {
    console.error('[Cron meetup-feed] failed:', e?.message)
    admin
      .from('system_events')
      .insert({
        event_type: 'meetup_feed_failed',
        triggered_by: 'cron',
        metadata: { error: e?.message || String(e), at: new Date().toISOString() },
      })
      .then(() => {}, () => {})
    return NextResponse.json({ ok: false, error: e?.message || 'meetup feed failed' }, { status: 500 })
  }
}
