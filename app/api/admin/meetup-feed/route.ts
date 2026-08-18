/**
 * Meetup Spots admin surface. Allowlist-gated (mirrors /api/admin/match-history).
 *
 *   POST { dry_run: true, limit?: number }
 *     → build the snapshot and RETURN it to the admin WITHOUT pushing. Lets us
 *       show the client a real sample record (in a Loom) with nothing leaving
 *       production. `limit` caps the returned records (default 5) for readability;
 *       pass limit: 0 for the full payload.
 *   POST { dry_run: false }  (or omitted)
 *     → build AND push on demand (fail-safe if unconfigured), for the live demo.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildMeetupFeed, pushMeetupFeed } from '@/lib/meetup/buildFeed'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response

  const body = await request.json().catch(() => ({}))
  const dryRun = body?.dry_run !== false // default true — safe by default for demos
  const limit = typeof body?.limit === 'number' ? body.limit : 5

  const admin = createAdminClient()
  const { payload, stats } = await buildMeetupFeed(admin)

  if (dryRun) {
    const sample = limit > 0 ? payload.pairs.slice(0, limit) : payload.pairs
    return NextResponse.json({
      dry_run: true,
      pushed: false,
      snapshot_date: payload.snapshot_date,
      pair_count: payload.pair_count,
      stats,
      sample_size: sample.length,
      sample,
    })
  }

  const push = await pushMeetupFeed(payload)
  console.log(`[admin/meetup-feed] manual push pairs=${payload.pair_count} push=${JSON.stringify(push)}`)
  return NextResponse.json({ dry_run: false, pair_count: payload.pair_count, stats, push })
}
