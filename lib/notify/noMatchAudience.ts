/**
 * "No match yet" Match Monday ping — audience selection.
 *
 * Eligible partnership (member unit) =
 *   live profile   : partnerships.profile_state = 'live' (the same base the
 *                    weekly recompute iterates — a completed survey)
 *   AND no visible match : no released, non-expired >= STORE_MIN_SCORE row on
 *                    EITHER side, under the viewer's own market gate
 *   AND due        : no_match_notified_at is NULL, or older than the configured
 *                    interval (per member, not a global cohort)
 *   AND reachable  : at least one non-suppressed member email, or a phone
 *
 * Anyone the MATCH phase touched in the same run is excluded by the caller — a
 * member must never receive both in one Monday.
 *
 * ── ON "NO VISIBLE MATCH": A DELIBERATE APPROXIMATION ───────────────────────
 * The exact read-path predicate lives in getComputedMatchCards and additionally
 * excludes dismissed handshakes, hidden (passed) matches and a tier floor. It is
 * per-viewer and costs several queries each; running it for ~670 partnerships to
 * pick an audience is not worth it.
 *
 * This module reuses everything cheap about that predicate (bidirectional,
 * release_at, expires_at/saved, score floor, the market gate) and omits only the
 * dismissed/hidden exclusions. The error is therefore ONE-DIRECTIONAL: a member
 * whose only matches are all dismissed or hidden is counted as "has a match" and
 * is NOT pinged. We under-ping; we never ping someone who can see a match.
 *
 * Measured against prod on 2026-09-04: 0 handshakes exist and 5 hidden_matches
 * rows exist, none of which flips a partnership. Current error: 0 members.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import {
  loadMarketIndex, isCityLive, releaseAllMarkets, normalizeCity, type MarketIndex,
} from '@/lib/markets/releaseGate'
import { getRenotifySuppressedEmails } from '@/lib/suppression/emailSuppressions'
import { variantForMarket, type NoMatchVariant } from './noMatchCopy'

type Admin = ReturnType<typeof createAdminClient>

/** The score floor computeMatches stores at (STORE_MIN_SCORE). Rows below never exist. */
export const PING_SCORE_FLOOR = 77

// ─── config ─────────────────────────────────────────────────────────────────

/** Master switch for the ping. Default OFF — absent env means no ping is sent. */
export function noMatchPingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NO_MATCH_PING_ENABLED === 'true'
}

/**
 * Repeat interval in weeks. The client's launch value is 1 (weekly); nothing is
 * hardcoded, and a bad value can never mean "never" or "every run" by accident —
 * it falls back to the documented default.
 */
export const DEFAULT_PING_EVERY_N_WEEKS = 1

export function pingEveryNWeeks(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number.parseInt(env.NO_MATCH_PING_EVERY_N_WEEKS ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PING_EVERY_N_WEEKS
}

/**
 * Grace subtracted from the interval so ordinary cron jitter cannot skip a week.
 * The cron fires Monday 14:00 UTC; a run a few minutes early against a timestamp
 * written a few minutes late would otherwise land just short of 7 days and defer
 * the member a whole cycle.
 */
export const PING_INTERVAL_GRACE_MS = 12 * 60 * 60 * 1000

/**
 * Live members in a member's own city at or above which variant A is the true
 * sentence. Below it, variant B is.
 *
 * WHY THIS REPLACED isCityLive(). The variants were written before
 * RELEASE_ALL_MARKETS. Under the old gate "is your market live" and "does HAEVN
 * work where you are" were the same question, so isCityLive() answered both. The
 * flag split them: a Portland member is now matched and notified exactly like an
 * Austin member, but isCityLive('Portland') is still false, so they would have
 * received variant B — "HAEVN is still building its network in Portland" — which
 * reads as "we have not launched here yet" to someone whose neighbours are being
 * matched. That is precisely the false claim the two variants exist to prevent,
 * pointed at the other market.
 *
 * It also cannot be fixed by fixing the data: `markets` holds exactly one row
 * and `msa_allowed_zips` covers only Austin, so isCityLive() is structurally
 * "is this one of 81 Austin-area strings", not a liveness signal.
 *
 * The honest question under all-markets release is density: is there a real
 * network where this member is? That is what the copy actually claims.
 *
 * 20 was chosen from the live distribution, not invented: every threshold from
 * 15 to 24 produces the identical split on the current audience (Portland 77 and
 * Tampa 24 are variant A; Salem 14 and below are variant B), so the exact number
 * is not load-bearing and 20 sits mid-plateau.
 */
export const DEFAULT_NO_MATCH_DENSITY_THRESHOLD = 20

/**
 * Threshold in live members. Configurable so the client can retune without a
 * deploy; a bad value falls back to the documented default rather than meaning
 * "everyone gets A" (0) or "everyone gets B" (huge). Same shape as
 * pingEveryNWeeks for exactly that reason.
 */
export function noMatchDensityThreshold(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number.parseInt(env.NO_MATCH_DENSITY_THRESHOLD ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_NO_MATCH_DENSITY_THRESHOLD
}

/** Is this partnership due for a ping? NULL marker = never pinged = always due. */
export function isDueForPing(
  lastPingedAt: string | null | undefined,
  now: Date,
  everyNWeeks: number
): boolean {
  if (!lastPingedAt) return true
  if (!Number.isFinite(everyNWeeks) || everyNWeeks <= 0) return false
  const last = Date.parse(lastPingedAt)
  if (Number.isNaN(last)) return true // unparseable marker -> treat as never pinged
  const intervalMs = everyNWeeks * 7 * 24 * 60 * 60 * 1000 - PING_INTERVAL_GRACE_MS
  return last <= now.getTime() - intervalMs
}

// ─── pure predicates ────────────────────────────────────────────────────────

export interface MatchRowLite {
  partnership_a: string
  partnership_b: string
  score: number
  release_at: string | null
  expires_at: string | null
  saved: boolean | null
}

/** Is this row released and still active right now? (saved bypasses expiry) */
export function isRowLive(r: MatchRowLite, nowIso: string): boolean {
  if (r.score < PING_SCORE_FLOOR) return false
  if (!r.release_at || r.release_at > nowIso) return false
  if (!r.saved && r.expires_at && r.expires_at <= nowIso) return false
  return true
}

/**
 * Partnerships that can SEE at least one match today.
 *
 * The market gate is applied PER VIEWER, exactly as the read path does it: with
 * RELEASE_ALL_MARKETS off, a Portland member on a released Austin×Portland row
 * still cannot see it, so they remain ping-eligible. Getting this wrong would
 * silently drop members who see an empty matches page.
 */
export function visiblePartnerships(
  rows: MatchRowLite[],
  cityById: Map<string, string | null>,
  idx: MarketIndex,
  nowIso: string,
  allMarkets: boolean
): Set<string> {
  const visible = new Set<string>()
  for (const r of rows) {
    if (!isRowLive(r, nowIso)) continue
    for (const side of [r.partnership_a, r.partnership_b]) {
      if (allMarkets || isCityLive(cityById.get(side) ?? null, idx)) visible.add(side)
    }
  }
  return visible
}

/** The two fields density needs. A subset of the partnerships rows already read. */
export interface CityDensityRow {
  city: string | null
  profile_state: string | null
}

/**
 * Live members per normalized city.
 *
 * SAME SNAPSHOT, BY CONSTRUCTION. This takes the partnerships array the audience
 * loop itself iterates — not a second query, not a COUNT. A member therefore
 * cannot be counted into a city's density by one read while being excluded from
 * the audience by another read taken a moment later; there is only one read. The
 * cost is a single pass over rows already in memory.
 *
 * Keyed with the shared normalizeCity so there is no second city-matching
 * implementation, exactly as the rest of this module promises.
 *
 * Cityless members densify nothing — an unknown city cannot be evidence of
 * network presence anywhere.
 */
export function liveMembersByCity(rows: CityDensityRow[]): Map<string, number> {
  const byCity = new Map<string, number>()
  for (const r of rows) {
    if (r.profile_state !== 'live') continue
    const key = normalizeCity(r.city)
    if (!key) continue
    byCity.set(key, (byCity.get(key) ?? 0) + 1)
  }
  return byCity
}

/**
 * Is there a real HAEVN network where this member is? Decides A vs B.
 *
 * TWO WAYS TO QUALIFY, and both are needed.
 *
 *   1. A LIVE MARKET always qualifies, whatever the member's own city count.
 *      San Marcos has 11 live members but sits in the launched Austin–Round Rock
 *      MSA and matches against all 359 of it. Density alone would tell a San
 *      Marcos member "HAEVN is still building its network in San Marcos" — which
 *      is the original bug (a "we haven't launched here" claim inside a launched
 *      market), simply relocated from Austin proper to its suburbs. isCityLive()
 *      was never wrong about live markets; it was only ever wrong as the SOLE
 *      criterion, because under RELEASE_ALL_MARKETS it says nothing about
 *      Portland.
 *
 *   2. ENOUGH LIVE MEMBERS IN YOUR OWN CITY qualifies too. This is what covers
 *      Portland (77) and Tampa (24) — real networks in markets that were never
 *      switched live, which is precisely what the all-markets release created
 *      and what density exists to catch.
 *
 * Neither test alone is sufficient: (1) misses Portland, (2) misses San Marcos.
 * Variant B is therefore reached only by a member who is BOTH outside a live
 * market AND in a thin city — the one population for whom "still building here,
 * spread the word" is unambiguously true.
 *
 * CITYLESS -> TRUE (variant A), deliberately, and this is a change from the old
 * behaviour where a missing city fell through isCityLive() to variant B.
 * Variant B's sentence — "HAEVN is still building its network in your area" —
 * makes a claim about an area we do not know; it could easily be false for a
 * member who simply never filled the field in Austin. Variant A's city-less form
 * makes no geographic claim at all ("we're holding until there's someone worth
 * introducing you to"), and is true for every member in this audience by
 * construction, since having no visible match is what put them in it.
 *
 * Truth is the invariant; the growth ask is not worth a sentence we cannot
 * stand behind. 0 members are affected today — the branch exists because the
 * contract requires it, not because the count does.
 */
export function hasNetworkPresence(
  city: string | null | undefined,
  densityByCity: Map<string, number>,
  threshold: number,
  idx: MarketIndex
): boolean {
  const key = normalizeCity(city)
  if (!key) return true
  if (isCityLive(city, idx)) return true
  return (densityByCity.get(key) ?? 0) >= threshold
}

// ─── audience build ─────────────────────────────────────────────────────────

export interface PingEntry {
  partnershipId: string
  variant: NoMatchVariant
  /** partnerships.city verbatim — what {city} interpolates. Never a market slug. */
  city: string | null
  phone: string | null
  /** non-suppressed member emails; may be empty when the member has a phone */
  memberEmails: string[]
}

export interface BuildPingAudienceResult {
  audience: PingEntry[]
  /** Live partnerships that can see a match — not pinged, by definition. */
  hasMatch: number
  /** Due but every channel is unusable (all emails suppressed, no phone). */
  unreachable: string[]
  /** Live, matchless, but not yet due under the configured interval. */
  notDue: number
  /** Variant split, for the run log. */
  byVariant: Record<NoMatchVariant, number>
  /** The live-member threshold this run used to pick variants, for the readout. */
  densityThreshold: number
}

async function fetchAll(admin: Admin, table: string, cols: string): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + 999)
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export async function buildNoMatchAudience(
  admin: Admin,
  opts: {
    /** partnership ids the MATCH phase already notified in this run — never double-touch */
    excludePartnershipIds?: Set<string>
    now?: Date
    env?: NodeJS.ProcessEnv
    /**
     * Pre-built market index. Production leaves this unset and the shared
     * resolver is loaded here; tests inject one so the whole audience build runs
     * against a double with no network. There is deliberately no second
     * city-matching implementation — this is the SAME MarketIndex shape
     * loadMarketIndex returns and isCityLive consumes.
     */
    marketIdx?: MarketIndex
  } = {}
): Promise<BuildPingAudienceResult> {
  const now = opts.now ?? new Date()
  const env = opts.env ?? process.env
  const nowIso = now.toISOString()
  const everyN = pingEveryNWeeks(env)
  const exclude = opts.excludePartnershipIds ?? new Set<string>()

  const [partnerships, cm, members, profiles, marketIdx, suppressedEmails] = await Promise.all([
    fetchAll(admin, 'partnerships', 'id, city, phone, profile_state, no_match_notified_at'),
    fetchAll(admin, 'computed_matches', 'partnership_a, partnership_b, score, release_at, expires_at, saved'),
    fetchAll(admin, 'partnership_members', 'partnership_id, user_id'),
    fetchAll(admin, 'profiles', 'user_id, email'),
    opts.marketIdx ? Promise.resolve(opts.marketIdx) : loadMarketIndex(true),
    getRenotifySuppressedEmails(admin),
  ])

  const allMarkets = releaseAllMarkets()
  const cityById = new Map<string, string | null>(
    (partnerships as { id: string; city: string | null }[]).map((p) => [p.id, p.city])
  )

  // Variant inputs, both derived from `partnerships` — the same array the loop
  // below iterates. One read, one snapshot, no timing skew between "counted into
  // a city" and "considered for the audience".
  const densityThreshold = noMatchDensityThreshold(env)
  const densityByCity = liveMembersByCity(partnerships as CityDensityRow[])
  const visible = visiblePartnerships(cm as MatchRowLite[], cityById, marketIdx, nowIso, allMarkets)

  const membersByP = new Map<string, string[]>()
  for (const m of members as { partnership_id: string; user_id: string }[]) {
    const a = membersByP.get(m.partnership_id) ?? []
    a.push(m.user_id)
    membersByP.set(m.partnership_id, a)
  }
  const emailByUser = new Map<string, string | null>(
    (profiles as { user_id: string; email: string | null }[]).map((p) => [p.user_id, p.email])
  )

  const audience: PingEntry[] = []
  const unreachable: string[] = []
  const byVariant: Record<NoMatchVariant, number> = { live_market: 0, pre_launch: 0 }
  let hasMatch = 0
  let notDue = 0

  type Row = {
    id: string
    city: string | null
    phone: string | null
    profile_state: string | null
    no_match_notified_at: string | null
  }

  for (const p of partnerships as Row[]) {
    if (p.profile_state !== 'live') continue
    if (exclude.has(p.id)) continue
    if (visible.has(p.id)) { hasMatch++; continue }
    if (!isDueForPing(p.no_match_notified_at, now, everyN)) { notDue++; continue }

    const allEmails = (membersByP.get(p.id) ?? [])
      .map((u) => emailByUser.get(u))
      .filter((e): e is string => !!e && e.includes('@'))
    const memberEmails = allEmails.filter((e) => !suppressedEmails.has(e.toLowerCase()))

    // Unreachable = no usable email AND no phone. Recorded, never marked sent, so
    // adding contact details later brings the member back into the audience.
    if (memberEmails.length === 0 && !p.phone) { unreachable.push(p.id); continue }

    // Variant is network DENSITY where the member is, not market liveness. Under
    // RELEASE_ALL_MARKETS everyone is matched and notified alike, so "is your
    // market live" no longer tracks "does HAEVN work where you are" — and it is
    // the second question both copy variants actually make claims about.
    // variantForMarket is still the boolean -> variant mapper; only the boolean
    // it is handed has changed. See DEFAULT_NO_MATCH_DENSITY_THRESHOLD.
    const variant = variantForMarket(
      hasNetworkPresence(p.city, densityByCity, densityThreshold, marketIdx)
    )
    byVariant[variant]++
    audience.push({
      partnershipId: p.id,
      variant,
      city: p.city?.trim() || null,
      phone: p.phone ?? null,
      memberEmails,
    })
  }

  return { audience, hasMatch, unreachable, notDue, byVariant, densityThreshold }
}
