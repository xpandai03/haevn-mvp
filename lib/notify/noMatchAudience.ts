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
import { loadMarketIndex, isCityLive, releaseAllMarkets, type MarketIndex } from '@/lib/markets/releaseGate'
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

    // Variant is the member's OWN market status — not the release flag. Opening
    // release does not make HAEVN live in Portland, and variant B is the sentence
    // that is true there.
    const variant = variantForMarket(isCityLive(p.city, marketIdx))
    byVariant[variant]++
    audience.push({
      partnershipId: p.id,
      variant,
      city: p.city?.trim() || null,
      phone: p.phone ?? null,
      memberEmails,
    })
  }

  return { audience, hasMatch, unreachable, notDue, byVariant }
}
