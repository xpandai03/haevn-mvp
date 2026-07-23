import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadMarketIndex, resolveMarket } from '@/lib/markets/releaseGate'
import {
  bandOf,
  releaseStatusOf,
  shortName,
  dedupePairs,
  filterRows,
  sortRows,
  paginate,
  computeCounts,
  type Connection,
  type MatchRow,
  type SortKey,
} from '@/lib/admin/matchRows'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Admin = ReturnType<typeof createAdminClient>

/**
 * /admin/matches list. Read-only, allowlist-gated. Shows the CURRENT match set
 * (computed_matches is rewritten weekly — no history). Server-side search / filter
 * / sort / pagination. Batched resolution (names, city→market, connections) — no
 * N+1. See docs/plans/admin-matches-page.md.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response

  const admin = createAdminClient()
  const p = request.nextUrl.searchParams
  const nowIso = new Date().toISOString()

  try {
    // One row per unordered pair (computed_matches mirrors every pair). Dedup
    // BEFORE filter/sort/count so counts reflect unique pairs.
    const rows = dedupePairs(await buildRows(admin, nowIso))

    const filtered = filterRows(rows, {
      search: p.get('search') ?? undefined,
      band: (p.get('band') as any) ?? 'all',
      status: (p.get('status') as any) ?? 'all',
      market: p.get('market') ?? 'all',
      scoreMin: p.get('scoreMin') ? Number(p.get('scoreMin')) : undefined,
      scoreMax: p.get('scoreMax') ? Number(p.get('scoreMax')) : undefined,
    })

    const sort = (p.get('sort') as SortKey) ?? 'score'
    const dir = (p.get('dir') as 'asc' | 'desc') ?? 'desc'
    const sorted = sortRows(filtered, sort, dir)

    const page = Math.max(1, Number(p.get('page') ?? '1'))
    const pageSize = Math.min(200, Math.max(1, Number(p.get('pageSize') ?? '50')))
    const { pageRows, total } = paginate(sorted, page, pageSize)

    // Last recompute time = newest computed_at across the set.
    const lastComputedAt = rows.reduce<string | null>(
      (mx, r) => (r.computedAt && (!mx || r.computedAt > mx) ? r.computedAt : mx),
      null
    )

    return NextResponse.json({
      rows: pageRows,
      total,
      page,
      pageSize,
      counts: computeCounts(filtered),
      lastComputedAt,
      generatedAt: nowIso,
    })
  } catch (err: any) {
    console.error('[admin/matches] failed:', err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? 'Failed to load matches' }, { status: 500 })
  }
}

/** Normalized pair key (order-independent). */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

async function buildRows(admin: Admin, nowIso: string): Promise<MatchRow[]> {
  const [cm, members, profiles, partnerships, marketIdx, handshakes, conversations, hidden, rtm] =
    await Promise.all([
      fetchAll(admin, 'computed_matches',
        'id, partnership_a, partnership_b, score, tier, computed_at, release_at, expires_at, saved, sms_notified_at'),
      fetchAll(admin, 'partnership_members', 'partnership_id, user_id'),
      fetchAll(admin, 'profiles', 'user_id, full_name'),
      fetchAll(admin, 'partnerships', 'id, city'),
      loadMarketIndex(true),
      fetchAll(admin, 'handshakes', 'a_partnership, b_partnership'),
      fetchAll(admin, 'conversations', 'participant1_id, participant2_id'),
      fetchAll(admin, 'hidden_matches', 'partnership_id, match_partnership_id'),
      fetchAll(admin, 'ready_to_meet_signals', 'partnership_smaller, partnership_larger'),
    ])

  // partnership → display name ("First L.") from the first member's profile full_name
  const fullNameByUser = new Map<string, string | null>(
    (profiles as { user_id: string; full_name: string | null }[]).map((r) => [r.user_id, r.full_name])
  )
  const nameByPartnership = new Map<string, string | null>()
  const userToPartnership = new Map<string, string>()
  for (const m of members as { partnership_id: string; user_id: string }[]) {
    userToPartnership.set(m.user_id, m.partnership_id)
    if (!nameByPartnership.has(m.partnership_id)) {
      nameByPartnership.set(m.partnership_id, shortName(fullNameByUser.get(m.user_id)))
    }
  }

  // partnership → city / resolved market
  const cityByP = new Map<string, string | null>()
  for (const pp of partnerships as { id: string; city: string | null }[]) cityByP.set(pp.id, pp.city ?? null)
  const marketByP = (id: string) => resolveMarket(cityByP.get(id) ?? null, marketIdx)

  // connection sets keyed by normalized pair
  const connected = new Set<string>()
  for (const h of handshakes as { a_partnership: string; b_partnership: string }[]) {
    connected.add(pairKey(h.a_partnership, h.b_partnership))
  }
  const conversation = new Set<string>()
  for (const c of conversations as { participant1_id: string; participant2_id: string }[]) {
    const pa = userToPartnership.get(c.participant1_id)
    const pb = userToPartnership.get(c.participant2_id)
    if (pa && pb) conversation.add(pairKey(pa, pb))
  }
  const passed = new Set<string>()
  for (const h of hidden as { partnership_id: string; match_partnership_id: string }[]) {
    passed.add(pairKey(h.partnership_id, h.match_partnership_id))
  }
  const readyToMeet = new Set<string>()
  for (const r of rtm as { partnership_smaller: string; partnership_larger: string }[]) {
    readyToMeet.add(pairKey(r.partnership_smaller, r.partnership_larger))
  }
  const connectionOf = (a: string, b: string): Connection => {
    const k = pairKey(a, b)
    if (connected.has(k)) return 'connected'
    if (conversation.has(k)) return 'conversation'
    if (readyToMeet.has(k)) return 'ready_to_meet'
    if (passed.has(k)) return 'passed'
    return null
  }

  return (cm as any[]).map((r): MatchRow => {
    const a = r.partnership_a as string
    const b = r.partnership_b as string
    return {
      id: r.id,
      partnershipA: a,
      partnershipB: b,
      nameA: nameByPartnership.get(a) ?? null,
      nameB: nameByPartnership.get(b) ?? null,
      score: r.score,
      band: bandOf(r.score),
      tier: r.tier ?? null,
      cityA: cityByP.get(a) ?? null,
      cityB: cityByP.get(b) ?? null,
      marketA: marketByP(a),
      marketB: marketByP(b),
      computedAt: r.computed_at ?? null,
      releaseAt: r.release_at ?? null,
      expiresAt: r.expires_at ?? null,
      releaseStatus: releaseStatusOf(r.release_at ?? null, nowIso),
      notified: !!r.sms_notified_at,
      saved: !!r.saved,
      connection: connectionOf(a, b),
      inspectHref: `/admin/match-inspection?a=${a}&b=${b}`,
    }
  })
}

async function fetchAll(admin: Admin, table: string, cols: string): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + 999)
    if (error) {
      // Missing/empty ancillary tables (e.g. signals) must not break the list.
      console.warn(`[admin/matches] ${table} read: ${error.message}`)
      break
    }
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}
