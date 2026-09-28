/**
 * GET /api/admin/weekly-pairs?band=match|rec&week=YYYY-MM-DD&scope=<market>&page=N
 *
 * The rows behind the Network Performance "Matches Generated" (band=match) and
 * "Recommendations Generated" (band=rec) cards, for one reporting week.
 *
 * Admin-gated by requireAdminRoute (allowlist); read-only by construction — no
 * write of any kind. Names follow the admin convention (shortName: "Alex C.").
 *
 * ── SOURCES (see lib/admin/weeklyPairs.ts for the full reasoning) ────────────
 *   current week  computed_matches through weeklyBandFilter — the card's own
 *                 query, so the two agree by construction.
 *   past week     match_history, deduplicated — computed_matches has been
 *                 rewritten since. The card's number for a past week is the
 *                 frozen network_snapshots value; both are returned, and any gap
 *                 is labelled on the page (reconcile()).
 *   notified      computed_matches.sms_notified_at (current week) + the week's
 *                 notification_sent events of type 'match' for the channel.
 *
 * Paginated server-side at PAIR_PAGE_SIZE: a recommendations week is ~1,200+
 * rows. The header count is always the full total, never the page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { shortName } from '@/lib/admin/matchRows'
import { resolvePartnershipScope } from '@/lib/metrics/scope'
import {
  currentReportingWeek, formatReportingWeek, weekFromEnding,
} from '@/lib/metrics/reportingWeek'
import {
  weeklyBandFilter, dedupeHistory, countPairs, toPairRows, sortPairRows, paginate,
  reconcile, parseBand, channelsByPartnership,
  type RawPairRow, type PartnershipLite, type NotifyEvent,
} from '@/lib/admin/weeklyPairs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Admin = ReturnType<typeof createAdminClient>

/** Page through a filtered read so a >1000-row week is never silently truncated. */
async function readAll(admin: Admin, table: string, cols: string, apply: (q: any) => any): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await apply(admin.from(table).select(cols)).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export async function GET(request: NextRequest) {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response

  const params = request.nextUrl.searchParams
  const band = parseBand(params.get('band'))
  if (!band) return NextResponse.json({ error: 'band must be match or rec' }, { status: 400 })

  const weekParam = params.get('week')
  if (weekParam && !/^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    return NextResponse.json({ error: 'week must be YYYY-MM-DD' }, { status: 400 })
  }
  const week = weekParam ? weekFromEnding(weekParam) : currentReportingWeek()
  const isCurrent = week.weekEnding === currentReportingWeek().weekEnding
  const startIso = week.start.toISOString()
  const endIso = week.end.toISOString()

  const scopeParam = params.get('scope')
  const market = scopeParam && scopeParam !== 'network' ? scopeParam : null
  const page = Number(params.get('page') ?? '1')

  const admin = createAdminClient()
  const now = new Date()

  try {
    const resolution = await resolvePartnershipScope(market ? { market } : 'network')
    const scopeIds = resolution.partnershipIds // null = network
    const inScope = (r: RawPairRow) => scopeIds === null || scopeIds.has(r.partnership_a)

    // ── rows + the card's number ─────────────────────────────────────────────
    let raw: RawPairRow[]
    let card: number | null
    if (isCurrent) {
      raw = (await readAll(
        admin, 'computed_matches',
        'partnership_a, partnership_b, score, computed_at, release_at, sms_notified_at',
        weeklyBandFilter(band, startIso, endIso)
      )).map((r) => ({ ...r, released_at: r.release_at })).filter(inScope)
      // The card IS this query (getMetrics resolveWeekly, same filter, same
      // partnership_a scoping). Counted independently rather than assumed, so a
      // recompute landing between the two reads would still be caught below.
      if (scopeIds === null) {
        const { count, error } = await weeklyBandFilter(band, startIso, endIso)(
          admin.from('computed_matches').select('*', { count: 'exact', head: true })
        )
        if (error) throw new Error(`computed_matches count: ${error.message}`)
        card = count ?? 0
      } else {
        card = raw.length
      }
    } else {
      raw = dedupeHistory(await readAll(
        admin, 'match_history',
        'run_date, partnership_a, partnership_b, score, computed_at, released_at',
        weeklyBandFilter(band, startIso, endIso)
      )).filter(inScope)
      let snap = admin.from('network_snapshots').select('metrics').eq('snapshot_date', week.weekEnding)
      snap = market ? snap.eq('market_name', market) : snap.is('market_name', null)
      const { data: snapRow, error } = await snap.maybeSingle()
      if (error) throw new Error(`network_snapshots: ${error.message}`)
      const v = (snapRow as any)?.metrics?.weekly?.[band === 'match' ? 'matchesGenerated' : 'recommendationsGenerated']
      card = typeof v === 'number' ? v : null
    }

    // ── names + cities for everyone on either side ──────────────────────────
    const ids = new Set<string>()
    for (const r of raw) { ids.add(r.partnership_a); ids.add(r.partnership_b) }
    const people = new Map<string, PartnershipLite>()
    const idList = [...ids]
    for (let i = 0; i < idList.length; i += 200) {
      const { data, error } = await admin
        .from('partnerships').select('id, display_name, city').in('id', idList.slice(i, i + 200))
      if (error) throw new Error(`partnerships: ${error.message}`)
      for (const p of (data ?? []) as any[]) people.set(p.id, { name: shortName(p.display_name), city: p.city ?? null })
    }

    // ── notification channel (matches only; recommendations are never pinged) ─
    let events: NotifyEvent[] = []
    if (band === 'match') {
      const ev = await readAll(admin, 'system_events', 'metadata', (q) =>
        q.eq('event_type', 'notification_sent')
          .eq('metadata->>notification_type', 'match')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
      )
      events = ev
        .map((e: any) => e.metadata)
        .filter((m: any) => m?.partnership_id)
        .map((m: any) => ({ partnershipId: m.partnership_id, smsSent: !!m.sms_sent, emailSent: !!m.email_sent }))
    }

    const rows = sortPairRows(toPairRows(raw, people, channelsByPartnership(events), { band, isCurrent, now }))
    const paged = paginate(rows, page)

    return NextResponse.json({
      band,
      week: {
        weekEnding: week.weekEnding,
        start: startIso,
        end: endIso,
        label: formatReportingWeek(week),
        isCurrent,
      },
      scopeLabel: resolution.isNetwork ? 'Network' : resolution.marketName,
      source: isCurrent ? 'computed_matches' : 'match_history',
      total: rows.length,
      pairs: countPairs(raw),
      reconcile: reconcile(card, rows.length),
      page: paged.page,
      pages: paged.pages,
      rows: paged.rows,
      generatedAt: now.toISOString(),
    })
  } catch (e: any) {
    console.error('[admin/weekly-pairs]', e?.message)
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 })
  }
}
