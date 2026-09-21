/**
 * GET /api/cron/warm-interpretations — post-recompute cache warmer.
 *
 * Pre-generates match interpretations for the released pair-directions whose
 * VIEWER (partnership_a) has ever logged in — the ~60% subset that is realistically
 * viewable — so members never wait on a first-view generation. On-demand cache-fill
 * covers the tail. Skips the ~40% never-logged-in-viewer directions (pure waste
 * until they sign in).
 *
 * Ships behind INTERPRETATION_WARM_ENABLED (default OFF — enabled with a later
 * deploy). Auth: Bearer $CRON_SECRET. Scheduled after Monday recompute (12:00) so
 * it warms the fresh set.
 *
 * ── CHUNKED, BECAUSE THE FULL SET DOES NOT FIT ──────────────────────────────
 * Measured 2026-09-20: generation averages ~12s, and the viewer set is ~683
 * directions — about 9,500s against a 300s ceiling, 32x over. Even at
 * concurrency 8 it is ~1,200s, so parallelism alone does not close it. The run
 * therefore takes a TIME BUDGET (240s, inside the 300s ceiling) and stops
 * cleanly when it is spent.
 *
 * THE CACHE IS THE CURSOR. No progress table, no offset to persist, no state to
 * corrupt: a direction is "done" when a fresh row exists for it, which
 * getMatchInterpretation already decides via engine_version + source_computed_at
 * + schema_version. A continuation run simply asks the same question again and
 * finds less to do. That also makes the chunking safe against a mid-run crash,
 * a redeploy, or a changed audience — there is nothing to resume, only work
 * remaining.
 *
 * WARM_COVERAGE picks the set: 'viewers' (default, ~683 directions, ~$0.93/wk
 * on mini) or 'all' (every released direction, ~$2.99/wk). Everyone outside the
 * warm set still gets a report — generated on demand via
 * ensureMatchInterpretation and cached for the next viewer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMatchInterpretation } from '@/lib/matches/getMatchInterpretation'
import { WARM_SOFT_BUDGET_MS, warmCoverage } from '@/lib/matches/warmConfig'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const enabled = process.env.INTERPRETATION_WARM_ENABLED === 'true'
  const admin = createAdminClient()
  const startedAt = Date.now()
  const coverage = warmCoverage()
  const budgetMs = WARM_SOFT_BUDGET_MS

  // Released directional rows (viewer = partnership_a).
  const now = new Date().toISOString()
  const rows: { partnership_a: string; partnership_b: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from('computed_matches')
      .select('partnership_a, partnership_b')
      .lte('release_at', now)
      .range(from, from + 999)
    if (!data || data.length === 0) break
    rows.push(...(data as any))
    if (data.length < 1000) break
  }

  // Viewers (partnership_a owners) who have ever logged in.
  const members: { partnership_id: string; user_id: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await admin.from('partnership_members').select('partnership_id, user_id').range(from, from + 999)
    if (!data || data.length === 0) break
    members.push(...(data as any))
    if (data.length < 1000) break
  }
  const usersByPartnership = new Map<string, string[]>()
  for (const m of members) {
    const a = usersByPartnership.get(m.partnership_id) ?? []
    a.push(m.user_id)
    usersByPartnership.set(m.partnership_id, a)
  }
  const loggedIn = new Set<string>()
  for (let page = 1; ; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (!data?.users?.length) break
    for (const u of data.users) if (u.last_sign_in_at) loggedIn.add(u.id)
    if (data.users.length < 1000) break
  }
  const viewerLoggedIn = (pid: string) => (usersByPartnership.get(pid) ?? []).some((u) => loggedIn.has(u))

  // 'all' warms every released direction; 'viewers' (default) warms only those
  // whose viewer has ever signed in — the difference is ~$0.93/wk vs ~$2.99/wk.
  const targets = coverage === 'all' ? rows : rows.filter((r) => viewerLoggedIn(r.partnership_a))

  if (!enabled) {
    console.log(`[Cron warm-interpretations] DISABLED — would warm ${targets.length}/${rows.length} directions (coverage=${coverage}, flag off)`)
    return NextResponse.json({ ok: true, enabled: false, coverage, wouldWarm: targets.length, released: rows.length })
  }

  let generated = 0
  let cached = 0
  let degraded = 0
  let processed = 0
  let tokensIn = 0
  let tokensOut = 0
  let costUsd = 0
  let budgetExhausted = false

  for (const r of targets) {
    // Stop BEFORE starting work we cannot finish. A generation averages ~12s,
    // so beginning one at 239s would overrun the ceiling and lose the write.
    if (Date.now() - startedAt > budgetMs) { budgetExhausted = true; break }
    const res = await getMatchInterpretation(admin, r.partnership_a, r.partnership_b)
    processed++
    if (res.source === 'cache') cached++
    else if (res.source === 'generated') generated++
    else degraded++
    if (res.usage) {
      tokensIn += res.usage.prompt_tokens
      tokensOut += res.usage.completion_tokens
      costUsd += res.usage.cost_usd
    }
  }

  const remaining = targets.length - processed
  const summary = {
    coverage,
    released: rows.length,
    eligible: targets.length,
    processed,
    generated,
    cached,
    degraded,
    // Non-zero means this run hit its time budget and stopped cleanly; the next
    // invocation continues, because the cache itself is the cursor.
    remaining,
    budget_exhausted: budgetExhausted,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: Number(costUsd.toFixed(5)),
    duration_ms: Date.now() - startedAt,
  }
  console.log(`[Cron warm-interpretations] ${JSON.stringify(summary)}`)
  admin.from('system_events').insert({ event_type: 'interpretation_warm', triggered_by: 'cron', metadata: summary }).then(() => {}, () => {})
  return NextResponse.json({ ok: true, enabled: true, ...summary })
}
