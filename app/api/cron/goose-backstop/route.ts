import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseGooseRepo } from '@/lib/goose/repo'
import { runGooseBackstop } from '@/lib/goose/run'

/**
 * Goose compute backstop. Schedule: every 5 minutes (vercel.json).
 *
 * Retries event cohorts whose compute failed (until the event starts), picks
 * up a compute whose function died mid-run (expired lease → alert + retry
 * together), and sends one "not ready at event start" alert when retries stop.
 * The in-run retries in runGooseCompute handle the common case within seconds;
 * this only covers what outlives a single invocation.
 *
 * INERT unless GOOSE_BACKSTOP_ENABLED=true. With no cohorts it does one cheap
 * read. Auth: Bearer $CRON_SECRET, matching the existing crons.
 */
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (process.env.GOOSE_BACKSTOP_ENABLED !== 'true') {
    return NextResponse.json({ ok: true, skipped: 'GOOSE_BACKSTOP_ENABLED not set' })
  }

  try {
    const summary = await runGooseBackstop(createSupabaseGooseRepo())
    if (summary.examined > 0) console.log('[Cron goose-backstop]', JSON.stringify(summary))
    return NextResponse.json({ ok: true, ...summary })
  } catch (err: any) {
    console.error('[Cron goose-backstop] failed:', err?.message ?? err)
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 })
  }
}
