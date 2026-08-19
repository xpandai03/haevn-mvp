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
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMatchInterpretation } from '@/lib/matches/getMatchInterpretation'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const enabled = process.env.INTERPRETATION_WARM_ENABLED === 'true'
  const admin = createAdminClient()
  const startedAt = Date.now()

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

  const targets = rows.filter((r) => viewerLoggedIn(r.partnership_a))

  if (!enabled) {
    console.log(`[Cron warm-interpretations] DISABLED — would warm ${targets.length}/${rows.length} directions (flag off)`)
    return NextResponse.json({ ok: true, enabled: false, wouldWarm: targets.length, released: rows.length })
  }

  let generated = 0
  let cached = 0
  let degraded = 0
  for (const r of targets) {
    const res = await getMatchInterpretation(admin, r.partnership_a, r.partnership_b)
    if (res.source === 'cache') cached++
    else if (res.source === 'generated') generated++
    else degraded++
  }
  const summary = { released: rows.length, warmed: targets.length, generated, cached, degraded, duration_ms: Date.now() - startedAt }
  console.log(`[Cron warm-interpretations] ${JSON.stringify(summary)}`)
  admin.from('system_events').insert({ event_type: 'interpretation_warm', triggered_by: 'cron', metadata: summary }).then(() => {}, () => {})
  return NextResponse.json({ ok: true, enabled: true, ...summary })
}
