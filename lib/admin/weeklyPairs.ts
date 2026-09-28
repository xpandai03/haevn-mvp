/**
 * Weekly drill-downs behind the Network Performance "Matches Generated" and
 * "Recommendations Generated" cards — pure, injectable core.
 *
 * ── WHAT A ROW IS ────────────────────────────────────────────────────────────
 * computed_matches stores every pair TWICE, once per direction (A→B and B→A;
 * verified 1,326 of 1,326 rows on 2026-09-28), and the cards count ROWS keyed on
 * partnership_a. So a card reading 30 is 15 pairs, each counted once for each
 * side. The list mirrors that exactly — one row per direction, "member → their
 * match" — because the card must never disagree with its list, and because
 * "notified" is itself per direction (computed_matches.sms_notified_at is
 * stamped for partnership_a). The page states the pair count alongside.
 *
 * ── WHERE THE ROWS COME FROM ─────────────────────────────────────────────────
 *   current week  computed_matches, through the SAME filter the card counts
 *                 (weeklyBandFilter). Parity by construction: a mid-week
 *                 recompute changes both the card and the list at once.
 *   past weeks    match_history, deduplicated. computed_matches is rewritten
 *                 every Monday, so it cannot name last week's pairs; the history
 *                 capture can. A past card reads its frozen network_snapshots
 *                 value, so the two are compared and any gap is SHOWN, never
 *                 hidden (see reconcile()).
 *
 * Why a past-week gap can exist at all: match_history's foreign keys cascade on
 * partnership delete, so account deletion erases a departed member's history
 * rows (by design — deleted members must not be listed). 2026-09-21's capture
 * logged 1,240 rows; 1,232 remain after that week's departures.
 */

import { MATCH_MIN_SCORE, REC_MIN_SCORE, REC_MAX_SCORE } from '@/lib/matching/scoreBands'

export type PairBand = 'match' | 'rec'

export const PAIR_PAGE_SIZE = 100

/**
 * The ONE definition of "generated in this reporting week, in this band". The
 * card (lib/metrics/getMetrics resolveWeekly) and the current-week list both
 * apply it, so they cannot drift apart.
 */
export function weeklyBandFilter(band: PairBand, startIso: string, endIso: string) {
  return (q: any) => {
    const scored = band === 'match'
      ? q.gte('score', MATCH_MIN_SCORE)
      : q.gte('score', REC_MIN_SCORE).lte('score', REC_MAX_SCORE)
    return scored.gte('computed_at', startIso).lte('computed_at', endIso)
  }
}

/** Same predicate, in memory — for match_history rows and for tests. */
export function inWeeklyBand(
  r: { score: number | null; computed_at: string | null },
  band: PairBand,
  startIso: string,
  endIso: string
): boolean {
  if (r.score === null || r.score === undefined || !r.computed_at) return false
  const inBand = band === 'match'
    ? r.score >= MATCH_MIN_SCORE
    : r.score >= REC_MIN_SCORE && r.score <= REC_MAX_SCORE
  return inBand && r.computed_at >= startIso && r.computed_at <= endIso
}

export interface RawPairRow {
  partnership_a: string
  partnership_b: string
  score: number | null
  computed_at: string | null
  /** computed_matches.release_at / match_history.released_at */
  released_at: string | null
  /** current week only — match_history does not capture it */
  sms_notified_at?: string | null
  run_date?: string
}

/**
 * match_history re-captures a row every Monday it still exists, so one computed
 * row can appear under several run_dates. The row's identity is its direction
 * plus the computation that produced it.
 */
export function dedupeHistory(rows: RawPairRow[]): RawPairRow[] {
  const seen = new Map<string, RawPairRow>()
  for (const r of rows) {
    const k = `${r.partnership_a}|${r.partnership_b}|${r.computed_at}`
    if (!seen.has(k)) seen.set(k, r)
  }
  return [...seen.values()]
}

/** Unique unordered pairs among directional rows. */
export function countPairs(rows: { partnership_a: string; partnership_b: string }[]): number {
  return new Set(rows.map((r) => [r.partnership_a, r.partnership_b].sort().join('|'))).size
}

export type Channel = 'sms+email' | 'sms' | 'email' | 'unrecorded'

export interface PairRow {
  key: string
  memberName: string | null
  memberCity: string | null
  matchName: string | null
  matchCity: string | null
  score: number | null
  computedAt: string | null
  releasedAt: string | null
  released: boolean
  /** true / false when known; null when the source cannot say (past weeks, no event) */
  notified: boolean | null
  channel: Channel | null
}

export interface PartnershipLite {
  name: string | null
  city: string | null
}

/** A notification_sent event reduced to what a row needs. */
export interface NotifyEvent {
  partnershipId: string
  smsSent: boolean
  emailSent: boolean
}

export function channelOf(e: { smsSent: boolean; emailSent: boolean }): Channel {
  if (e.smsSent && e.emailSent) return 'sms+email'
  if (e.smsSent) return 'sms'
  if (e.emailSent) return 'email'
  return 'unrecorded'
}

/**
 * Per partnership, the channels that actually delivered, merged across the
 * week's match events (a retry on a later day can add a channel).
 */
export function channelsByPartnership(events: NotifyEvent[]): Map<string, { smsSent: boolean; emailSent: boolean }> {
  const out = new Map<string, { smsSent: boolean; emailSent: boolean }>()
  for (const e of events) {
    const cur = out.get(e.partnershipId) ?? { smsSent: false, emailSent: false }
    out.set(e.partnershipId, { smsSent: cur.smsSent || e.smsSent, emailSent: cur.emailSent || e.emailSent })
  }
  return out
}

export function toPairRows(
  raw: RawPairRow[],
  people: Map<string, PartnershipLite>,
  events: Map<string, { smsSent: boolean; emailSent: boolean }>,
  opts: { band: PairBand; isCurrent: boolean; now: Date }
): PairRow[] {
  const nowIso = opts.now.toISOString()
  return raw.map((r) => {
    const a = people.get(r.partnership_a)
    const b = people.get(r.partnership_b)
    const ev = events.get(r.partnership_a)
    const delivered = ev && (ev.smsSent || ev.emailSent)

    // Only matches are notified; recommendations surface in-app, never pinged.
    let notified: boolean | null = null
    let channel: Channel | null = null
    if (opts.band === 'match') {
      if (opts.isCurrent) notified = !!r.sms_notified_at || !!delivered
      else notified = delivered ? true : null
      if (notified) channel = ev ? channelOf(ev) : 'unrecorded'
    }

    return {
      key: `${r.partnership_a}|${r.partnership_b}|${r.computed_at}`,
      memberName: a?.name ?? null,
      memberCity: a?.city ?? null,
      matchName: b?.name ?? null,
      matchCity: b?.city ?? null,
      score: r.score,
      computedAt: r.computed_at,
      releasedAt: r.released_at,
      released: !!r.released_at && r.released_at <= nowIso,
      notified,
      channel,
    }
  })
}

/**
 * Newest first by DAY, then strongest score, then name. By day, not timestamp:
 * a recompute stamps each row a few milliseconds apart, so ordering on the raw
 * timestamp let arbitrary write order beat the score (77, 77, 78, 77 on the
 * first live render).
 */
export function sortPairRows(rows: PairRow[]): PairRow[] {
  const day = (r: PairRow) => (r.computedAt ?? '').slice(0, 10)
  return [...rows].sort((x, y) =>
    day(y).localeCompare(day(x)) ||
    (y.score ?? -1) - (x.score ?? -1) ||
    (x.memberName ?? '').localeCompare(y.memberName ?? '') ||
    x.key.localeCompare(y.key)
  )
}

export function paginate<T>(rows: T[], page: number, pageSize = PAIR_PAGE_SIZE): { rows: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages)
  return { rows: rows.slice((p - 1) * pageSize, p * pageSize), page: p, pages }
}

/**
 * Card-vs-list agreement. The card and its list must never SILENTLY disagree.
 *   exact       card === listed
 *   no_card     past week with no stored snapshot — the card shows "—"
 *   removed     listed < card: rows erased since the week closed (account
 *               deletion cascades through match_history)
 *   mismatch    anything else — surfaced as-is, never papered over
 */
export type Reconcile =
  | { kind: 'exact'; card: number; listed: number }
  | { kind: 'no_card'; card: null; listed: number }
  | { kind: 'removed'; card: number; listed: number; gap: number }
  | { kind: 'mismatch'; card: number; listed: number }

export function reconcile(card: number | null, listed: number): Reconcile {
  if (card === null) return { kind: 'no_card', card: null, listed }
  if (card === listed) return { kind: 'exact', card, listed }
  if (listed < card) return { kind: 'removed', card, listed, gap: card - listed }
  return { kind: 'mismatch', card, listed }
}

export function parseBand(v: string | null | undefined): PairBand | null {
  return v === 'match' || v === 'rec' ? v : null
}
