import { NextRequest, NextResponse } from 'next/server'
import { runReNotify } from '@/lib/renotify/runReNotify'

/**
 * Weekly match RE-notification cron. Schedule: 0 16 * * 1 (Monday 16:00 UTC) —
 * AFTER recompute (12:00) and notify-new (14:00), with a safe gap. Re-notifies
 * partnerships with released matches whose members have never logged in.
 *
 * Respects RENOTIFY_ENABLED (default false → dry-run, NO provider calls).
 * Auth: Bearer $CRON_SECRET, matching the existing crons. Never the hardcoded-secret pattern.
 */
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const r = await runReNotify()
    console.log(
      `[Cron renotify] run=${r.runDate} dryRun=${r.dryRun} eligible=${r.eligible} ` +
        `sms=${r.sent.sms} email=${r.sent.email} suppressed=${JSON.stringify(r.suppressed)} failures=${r.failures}`
    )
    return NextResponse.json({
      ok: true,
      runDate: r.runDate,
      dryRun: r.dryRun,
      eligible: r.eligible,
      sent: r.sent,
      suppressed: r.suppressed,
      failures: r.failures,
    })
  } catch (err: any) {
    console.error('[Cron renotify] failed:', err?.message ?? err)
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 })
  }
}
