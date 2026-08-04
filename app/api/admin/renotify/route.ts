import { NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { runReNotify } from '@/lib/renotify/runReNotify'
import { getSuppressionCounts } from '@/lib/suppression/emailSuppressions'

/**
 * Admin visibility + manual dry-run trigger for the re-notify engine.
 *   GET  → latest run summary (counts only, IDs never emails).
 *   POST → force a DRY-RUN now (never sends live) so a Monday audience can be
 *          reviewed before RENOTIFY_ENABLED is flipped on. Live sends only ever
 *          happen via the cron when the flag is true.
 * Allowlist-gated (requireAdminRoute).
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET() {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response

  const admin = createAdminClient()
  const { data: latest } = await admin
    .from('renotify_log')
    .select('run_date')
    .order('run_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latest) {
    return NextResponse.json({ latestRun: null, message: 'No re-notify runs recorded yet.' })
  }

  const runDate = latest.run_date
  const { data: rows } = await admin.from('renotify_log').select('*').eq('run_date', runDate)

  const summary = {
    runDate,
    dryRun: (rows?.[0] as any)?.dry_run ?? null,
    total: rows?.length ?? 0,
    sent: { sms: 0, email: 0 },
    suppressed: { login_detected: 0, cap_reached: 0, email_suppressed: 0 },
    failures: 0,
    byVariant: { has_phone: 0, no_phone: 0 },
  }
  for (const r of (rows ?? []) as any[]) {
    if (r.sms_status === 'sent') summary.sent.sms++
    if (r.email_status === 'sent') summary.sent.email++
    if (r.suppressed_reason === 'login_detected') summary.suppressed.login_detected++
    if (r.suppressed_reason === 'cap_reached') summary.suppressed.cap_reached++
    if (r.suppressed_reason === 'email_suppressed') summary.suppressed.email_suppressed++
    if (r.sms_status === 'failed' || r.email_status === 'failed') summary.failures++
    if (r.variant === 'has_phone') summary.byVariant.has_phone++
    else if (r.variant === 'no_phone') summary.byVariant.no_phone++
  }

  // Standing suppression list totals (bounce/complaint/unsubscribe), independent
  // of any single run — the deliverability/compliance surface.
  const emailSuppressions = await getSuppressionCounts(admin)

  return NextResponse.json({ latestRun: summary, emailSuppressions })
}

export async function POST() {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response

  // ALWAYS dry-run — the manual trigger never sends live, only records a report.
  const r = await runReNotify({ enabled: false })
  return NextResponse.json({
    ok: true,
    dryRun: true,
    runDate: r.runDate,
    eligible: r.eligible,
    sent: r.sent,
    suppressed: r.suppressed,
    failures: r.failures,
  })
}
