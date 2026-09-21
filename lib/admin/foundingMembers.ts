/**
 * /admin/founding-members — pure logic for the Founding Members view.
 *
 * No DB, no JSX: the API route does the reads and calls these, so the funnel
 * arithmetic is unit-testable without a database.
 *
 * ── WHAT COUNTS AS A FOUNDING MEMBER ────────────────────────────────────────
 * `plus_source = 'founding_member_promo'` and nothing else. The four
 * `plus_source = 'comp'` rows are legacy pre-promo accounts (tagged
 * 2026-09-21; they predate attribution entirely) and are returned in their own
 * group so they can be SEEN without being COUNTED. Every summary figure on this
 * page is founding-only — folding comps in would overstate the promo's results
 * to the client, which is the one number this page exists to get right.
 *
 * ── "OPENED A BREAKDOWN" IS DELIBERATELY ABSENT ─────────────────────────────
 * There is no honest signal for it. The obvious candidate — a
 * `match_interpretations` row for the member as viewer — stopped meaning "they
 * looked" the moment INTERPRETATION_WARM_ENABLED went on: the warm cron
 * pre-generates rows for members who have never opened anything (12 of the
 * first 30 rows were warm-generated). Shipping it would show engagement that
 * did not happen. It needs a real page-view event; noted as a follow-up rather
 * than approximated.
 */

/** A member's relationship to the promo. Only `founding` counts in the funnel. */
export type PlusSourceGroup = 'founding' | 'comp' | 'paid' | 'other'

export function plusSourceGroup(plusSource: string | null | undefined): PlusSourceGroup {
  switch (plusSource) {
    case 'founding_member_promo':
      return 'founding'
    case 'comp':
      return 'comp'
    case 'paid':
      return 'paid'
    default:
      return 'other'
  }
}

export interface FoundingRow {
  partnershipId: string
  /** "Alex C." — the same first-name + last-initial convention the other admin pages use. */
  name: string | null
  city: string | null
  group: PlusSourceGroup
  /** Market slug at activation, or the raw city when the city resolved to no market. */
  promoMarket: string | null
  /** Which surface the member clicked through from. */
  ctaSource: string | null
  activatedAt: string | null
  expiresAt: string | null
  /** Whole days from `now` until expiry. Negative once expired; null when no term. */
  daysToExpiry: number | null
  expired: boolean
  // ── engagement, each from an existing table (see the API route for sources) ──
  /** Signed in AFTER activating — the question is whether the promo moved them. */
  signedInSinceActivation: boolean
  lastSignInAt: string | null
  nudgesSent: number
  connectionsAccepted: number
  messagesSent: number
}

const DAY_MS = 86_400_000

/** Whole days between now and `expiresAt`. Null when the member has no term. */
export function daysToExpiry(expiresAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!expiresAt) return null
  const t = Date.parse(expiresAt)
  if (Number.isNaN(t)) return null
  return Math.ceil((t - now.getTime()) / DAY_MS)
}

/**
 * Did they sign in AFTER activating?
 *
 * Deliberately not "have they ever signed in". A member who signed in a month
 * before the promo and never came back has not been moved by it, and counting
 * them would flatter the funnel.
 */
export function signedInSince(
  lastSignInAt: string | null | undefined,
  activatedAt: string | null | undefined
): boolean {
  if (!lastSignInAt || !activatedAt) return false
  const s = Date.parse(lastSignInAt)
  const a = Date.parse(activatedAt)
  if (Number.isNaN(s) || Number.isNaN(a)) return false
  return s > a
}

export interface FoundingSummary {
  /** Founding activations only. Comps are excluded by construction. */
  total: number
  activatedThisWeek: number
  signedInSinceCount: number
  connectedCount: number
  messagedCount: number
  /** Percentages of `total`, rounded. 0 when there are no activations. */
  pctSignedInSince: number
  pctConnected: number
  pctMessaged: number
  /** Earliest upcoming expiry across founding rows; null when none have a term. */
  nextExpiryAt: string | null
  expiredCount: number
  /** Comps are shown on the page but never counted above. */
  compCount: number
}

export const pct = (n: number, d: number): number => (d > 0 ? Math.round((n / d) * 100) : 0)

/**
 * Funnel figures over the rows.
 *
 * `founding` only — a `comp` row can never move a percentage here. That is the
 * whole reason the group exists on the row.
 */
export function summarizeFounding(rows: FoundingRow[], now: Date = new Date()): FoundingSummary {
  const founding = rows.filter((r) => r.group === 'founding')
  const weekAgo = now.getTime() - 7 * DAY_MS

  const activatedThisWeek = founding.filter(
    (r) => r.activatedAt && Date.parse(r.activatedAt) >= weekAgo
  ).length
  const signedInSinceCount = founding.filter((r) => r.signedInSinceActivation).length
  const connectedCount = founding.filter((r) => r.connectionsAccepted > 0).length
  const messagedCount = founding.filter((r) => r.messagesSent > 0).length

  const upcoming = founding
    .map((r) => r.expiresAt)
    .filter((e): e is string => !!e && Date.parse(e) >= now.getTime())
    .sort()

  return {
    total: founding.length,
    activatedThisWeek,
    signedInSinceCount,
    connectedCount,
    messagedCount,
    pctSignedInSince: pct(signedInSinceCount, founding.length),
    pctConnected: pct(connectedCount, founding.length),
    pctMessaged: pct(messagedCount, founding.length),
    nextExpiryAt: upcoming[0] ?? null,
    expiredCount: founding.filter((r) => r.expired).length,
    compCount: rows.filter((r) => r.group === 'comp').length,
  }
}

/** Newest activation first; rows with no activation timestamp sort last. */
export function sortByActivationDesc(rows: FoundingRow[]): FoundingRow[] {
  return [...rows].sort((a, b) => {
    if (!a.activatedAt && !b.activatedAt) return 0
    if (!a.activatedAt) return 1
    if (!b.activatedAt) return -1
    return b.activatedAt.localeCompare(a.activatedAt)
  })
}
