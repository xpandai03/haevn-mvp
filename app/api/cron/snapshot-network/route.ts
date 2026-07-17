import { NextRequest, NextResponse } from 'next/server'
import { runNetworkSnapshot } from '@/lib/metrics/runSnapshot'

/**
 * Weekly Network Performance snapshot cron.
 *
 * Schedule: 0 23 * * 6 (Saturday 23:00 UTC — see vercel.json). Captures the
 * reporting week at its END, BEFORE the Monday 12:00 UTC recompute cron
 * destructively rewrites computed_matches (which would otherwise misattribute
 * the week's match counts). Both this cron and the admin manual-trigger snapshot
 * currentReportingWeek(now), so the row upserts to final numbers by Saturday.
 *
 * Auth: Bearer $CRON_SECRET, matching the existing crons (recompute-matches /
 * notify-matches). NEVER the hardcoded-secret pattern from blast/test-notify.
 */
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runNetworkSnapshot()
    console.log('[Cron snapshot-network]', JSON.stringify(result))
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron snapshot-network] failed:', err?.message ?? err)
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 })
  }
}
