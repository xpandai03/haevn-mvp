/**
 * CITY-BASED RELEASE GATING — single source of truth.
 * =============================================================================
 * Release/notify must reach ONLY members in a LIVE market. Users are loaded for
 * cities that haven't launched (Tampa ~90d out, Portland building); without this
 * gate a Match Monday matches/notifies a pre-launch user.
 *
 * RESOLUTION
 *   partnerships.city -> msa_allowed_zips.city -> msa_name -> markets.is_live
 *   Joined on CITY, not zip (partnerships.zip_code is ~97% NULL).
 *
 * FAIL CLOSED — the core invariant
 *   Unresolved city, missing market row, or an unreadable markets table => NOT
 *   released/notified. Under-releasing is recoverable; matching a pre-launch
 *   user is not. Every fail-closed path logs loudly rather than silently
 *   excluding.
 *
 * SCOPE
 *   Gates RELEASE + NOTIFY + the member READ path. NEVER computation, never
 *   scoring — every partnership is still computed and stored exactly as before.
 *
 * WHY THE READ PATH MATTERS (the leak)
 *   Release is PASSIVE: a row becomes visible the moment release_at <= now. No
 *   cron has to run. So gating only the crons leaks — a row written with
 *   release_at = next Monday self-releases when Monday arrives. The read gate is
 *   the only leak-proof point.
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ─────────────────────────────────────────────────────────────────────────────
// MODE CONTROL — the (C) <-> (B) switch for already-released rows
// ─────────────────────────────────────────────────────────────────────────────
/**
 * As of gating, 57 rows for non-live-market members (Portland, Tampa/St. Pete,
 * Eugene, Houston, ...) were ALREADY released and notified in the Jun 29 blast.
 *
 *   MODE C (default, HIDE_ALL_NON_LIVE = false):
 *     Those rows stay visible — they were already seen/emailed; yanking them is
 *     its own bad UX. Anything releasing AFTER the grandfather instant is gated,
 *     so no NEW pre-launch release can happen.
 *
 *   MODE B (HIDE_ALL_NON_LIVE = true):
 *     Portland/Tampa go fully dark — every non-live-market match is hidden,
 *     regardless of when it released. ONE-LINE SWITCH, no data mutation, and
 *     instantly reversible by flipping back.
 *
 * Achieving B via this flag is strictly better than mutating release_at: it is
 * reversible and destroys no history. (A data-level push-forward remains
 * available if the client ever wants it, but is not required for B.)
 */
export const HIDE_ALL_NON_LIVE = false

/**
 * Rows released before this instant are grandfathered under MODE C. Set to the
 * gate's activation time. Anything releasing after is gated normally, which is
 * what makes MODE C leak-proof going forward.
 */
export const GRANDFATHER_RELEASED_BEFORE = '2026-07-16T00:00:00.000Z'

// ─────────────────────────────────────────────────────────────────────────────

export const normalizeCity = (city: string | null | undefined): string =>
  String(city ?? '').trim().toLowerCase()

export interface MarketIndex {
  /** normalized city -> market_name */
  cityToMarket: Map<string, string>
  /** market_name values with is_live = true */
  liveMarkets: Set<string>
  /** false when the index could not be built -> caller must fail closed */
  ok: boolean
}

let cached: { idx: MarketIndex; at: number } | null = null
const TTL_MS = 60_000

/** Load (and briefly cache) the city->market lookup + live-market set. */
export async function loadMarketIndex(force = false): Promise<MarketIndex> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.idx

  const admin = createAdminClient()
  const [zipsRes, marketsRes] = await Promise.all([
    admin.from('msa_allowed_zips').select('city, msa_name'),
    admin.from('markets').select('market_name, is_live'),
  ])

  if (zipsRes.error || marketsRes.error) {
    // FAIL CLOSED, loudly. Most likely cause: migration 043 not applied yet.
    console.error(
      '[releaseGate] FAIL CLOSED — could not build market index. Nobody will be released/notified.',
      { zips: zipsRes.error?.message, markets: marketsRes.error?.message }
    )
    return { cityToMarket: new Map(), liveMarkets: new Set(), ok: false }
  }

  const cityToMarket = new Map<string, string>()
  for (const z of zipsRes.data ?? []) {
    if (z.city && z.msa_name) cityToMarket.set(normalizeCity(z.city), z.msa_name)
  }
  const liveMarkets = new Set(
    (marketsRes.data ?? []).filter((m: any) => m.is_live).map((m: any) => m.market_name as string)
  )

  const idx: MarketIndex = { cityToMarket, liveMarkets, ok: true }
  cached = { idx, at: Date.now() }
  return idx
}

/** Resolve a free-text city to its market. null = unresolved (=> excluded). */
export function resolveMarket(city: string | null | undefined, idx: MarketIndex): string | null {
  return idx.cityToMarket.get(normalizeCity(city)) ?? null
}

/** Is this city in a LIVE market? Fail closed on unresolved / bad index. */
export function isCityLive(city: string | null | undefined, idx: MarketIndex): boolean {
  if (!idx.ok) return false
  const market = resolveMarket(city, idx)
  if (!market) return false
  return idx.liveMarkets.has(market)
}

export interface EligibilityResult {
  /** partnership ids in a LIVE market — the only ones release/notify may touch */
  eligible: Set<string>
  /** partnership ids excluded (non-live market OR unresolved city) */
  excluded: Set<string>
  /** excluded broken down by city, for auditable logging */
  excludedByCity: Record<string, number>
  ok: boolean
}

/**
 * Partition partnership ids by market-live eligibility.
 * @param ids restrict to these partnership ids (omit = all partnerships)
 */
export async function getReleaseEligibility(ids?: string[]): Promise<EligibilityResult> {
  const idx = await loadMarketIndex()
  const admin = createAdminClient()

  let q = admin.from('partnerships').select('id, city')
  if (ids && ids.length > 0) q = q.in('id', ids)
  const { data, error } = await q.limit(10000)

  if (error || !idx.ok) {
    console.error('[releaseGate] FAIL CLOSED — eligibility unavailable.', error?.message)
    return { eligible: new Set(), excluded: new Set(ids ?? []), excludedByCity: {}, ok: false }
  }

  const eligible = new Set<string>()
  const excluded = new Set<string>()
  const excludedByCity: Record<string, number> = {}

  for (const p of (data ?? []) as { id: string; city: string | null }[]) {
    if (isCityLive(p.city, idx)) {
      eligible.add(p.id)
    } else {
      excluded.add(p.id)
      const key = p.city || '(no city)'
      excludedByCity[key] = (excludedByCity[key] ?? 0) + 1
    }
  }
  return { eligible, excluded, excludedByCity, ok: true }
}

/**
 * READ-PATH decision for one already-fetched match row.
 * MODE C: a row released before the grandfather instant stays visible.
 * MODE B: nothing in a non-live market is ever visible.
 */
export function isRowVisibleForNonLiveMarket(releaseAt: string | null | undefined): boolean {
  if (HIDE_ALL_NON_LIVE) return false // MODE B — fully dark
  if (!releaseAt) return false // no release_at -> never grandfathered
  return releaseAt < GRANDFATHER_RELEASED_BEFORE // MODE C — grandfathered only
}
