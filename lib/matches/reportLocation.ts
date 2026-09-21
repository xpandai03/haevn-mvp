/**
 * The match report's location line.
 *
 * NOT A DISTANCE. The reference report shows "4 miles away", which needs
 * per-member coordinates: `partnerships.latitude`/`longitude` are NULL on all
 * 757 live partnerships, so a mileage figure would have to be invented. It is
 * also the wrong unit for this product — 87.8% of released pairs are
 * cross-city, so a proximity-led header is wrong for roughly seven matches in
 * eight.
 *
 * What ships instead is an honest city relationship, from data that is 100%
 * populated. See docs/plans/match-report-rebuild.md §6.
 *
 * CROSS-MARKET DISCLOSURE. When the two cities differ this line is also the
 * natural home for the disclosure the all-markets release owes members — they
 * are matched across metros now, and the header is where that should be said
 * rather than discovered. The sentence is a placeholder pending the client's
 * wording; `crossMarket` is surfaced so the UI can render it without
 * re-deriving the comparison.
 */

const norm = (c: string | null | undefined): string => String(c ?? '').trim()
const key = (c: string | null | undefined): string => norm(c).toLowerCase()

export interface ReportLocation {
  /** The line to render, or null to omit it entirely (never a placeholder). */
  label: string | null
  /** True when the two members are in different cities. */
  crossMarket: boolean
}

export function reportLocation(
  viewerCity: string | null | undefined,
  matchCity: string | null | undefined
): ReportLocation {
  const v = norm(viewerCity)
  const m = norm(matchCity)

  // Neither known: no line. A cityless member gets nothing rather than a
  // hedge — the plan's rule is render nothing over a placeholder.
  if (!m && !v) return { label: null, crossMarket: false }

  // Only the match's city is known: state it plainly, claim no relationship.
  if (m && !v) return { label: m, crossMarket: false }

  // Only the viewer's city is known: nothing truthful to say about the match.
  if (!m && v) return { label: null, crossMarket: false }

  if (key(v) === key(m)) return { label: `Both in ${m}`, crossMarket: false }
  return { label: `${v} & ${m}`, crossMarket: true }
}
