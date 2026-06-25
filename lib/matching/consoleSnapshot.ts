/**
 * Console snapshot — the SINGLE shared render/transform path for the admin
 * Matching Control Center, used by BOTH:
 *   - the live recompute view (client transforms the in-memory result), and
 *   - the on-load default (a bounded snapshot persisted on each successful
 *     recompute and replayed).
 *
 * Anti-drift: there is exactly one `transformToCards` + `computeSummary`; live
 * and stored paths both feed a `RecomputeResult` through them, so the four
 * tiles and the per-user cards can never diverge. Score grouping uses the
 * shared `scoreBands` helpers (Matches >=80, Recommendations 77–79).
 *
 * Bounding: the persisted snapshot keeps the FULL evaluated pool (every detail,
 * so the tiles read 301/13/63/225) and FULL match+recommendation candidate
 * lists (small), but caps the below-band/blocked drill-down lists to
 * BELOW_BLOCKED_CAP per user and stores the TRUE counts separately. The UI
 * notes that the full below-band/blocked lists come from a live Recompute.
 */

import { isMatchScore, isRecommendationScore } from './scoreBands'

export const BELOW_BLOCKED_CAP = 10

export interface PairDiag {
  candidate: string
  candidateId?: string
  score: number
  tier: string
  outcome: string
  reason?: string
  breakdown?: any
}

export interface DetailCounts {
  match: number
  recommendation: number
  belowBand: number
  blocked: number
}

export interface RecomputeDetail {
  partnershipId: string
  displayName?: string | null
  success: boolean
  matchesComputed: number
  candidatesEvaluated?: number
  error?: string
  pairDiagnostics?: PairDiag[]
  upsertError?: string
  _debug?: any
  /** Present on the stored snapshot — exact counts (pairDiagnostics may be capped). */
  counts?: DetailCounts
}

export interface RecomputeResult {
  total: number
  computed: number
  errors: number
  details: RecomputeDetail[]
  /** True when read from a persisted snapshot rather than a live recompute. */
  fromStored?: boolean
  /** UTC ISO timestamp of the run (stored snapshot only). */
  runAt?: string
  /** Trigger source of the run (stored snapshot only). */
  triggeredBy?: string
}

export interface UserCardData {
  partnershipId: string
  name: string
  matchCount: number          // stored, score >= 80
  recommendationCount: number // stored, 77–79 inclusive
  belowBandCount: number      // < 77 near-misses — DIAGNOSTIC only, never a recommendation
  blockedCount: number        // constraint-failed (or sub-50 noise)
  matchCandidates: PairDiag[]      // top stored >= 80, score desc
  recommendationCandidates: PairDiag[] // top stored 77–79, score desc
  detail: RecomputeDetail
}

export interface ConsoleSummary {
  totalUsers: number
  withMatches: number
  withRecommendations: number
  noViable: number
  bestPair: { a: string; b: string; score: number } | null
  errors: number
}

/** Group a detail's diagnostics into the four bands (shared by live + stored). */
function groupDiagnostics(d: RecomputeDetail) {
  const diags = d.pairDiagnostics || []
  const stored = diags.filter((p) => p.outcome === 'stored')
  const matches = stored.filter((p) => isMatchScore(p.score)).sort((a, b) => b.score - a.score)
  const recommendations = stored
    .filter((p) => isRecommendationScore(p.score))
    .sort((a, b) => b.score - a.score)
  const belowBand = diags
    .filter((p) => p.outcome !== 'stored' && p.outcome !== 'constraint-failed' && p.score >= 50)
    .sort((a, b) => b.score - a.score)
  const blocked = diags
    .filter((p) => p.outcome === 'constraint-failed' || (p.outcome !== 'stored' && p.score < 50))
    .sort((a, b) => b.score - a.score)
  return { matches, recommendations, belowBand, blocked }
}

export function transformToCards(result: RecomputeResult): UserCardData[] {
  return result.details.map((d) => {
    const { matches, recommendations, belowBand, blocked } = groupDiagnostics(d)
    // Prefer the stored exact counts (snapshot caps the below-band/blocked
    // arrays, so deriving from length would undercount); fall back to derived
    // lengths on the live path.
    const counts: DetailCounts = d.counts ?? {
      match: matches.length,
      recommendation: recommendations.length,
      belowBand: belowBand.length,
      blocked: blocked.length,
    }
    return {
      partnershipId: d.partnershipId,
      name: d.displayName || d.partnershipId.slice(0, 8),
      matchCount: counts.match,
      recommendationCount: counts.recommendation,
      belowBandCount: counts.belowBand,
      blockedCount: counts.blocked,
      matchCandidates: matches.slice(0, 3),
      recommendationCandidates: recommendations.slice(0, 3),
      detail: d,
    }
  })
}

export function computeSummary(cards: UserCardData[], result: RecomputeResult): ConsoleSummary {
  const totalUsers = cards.length
  const withMatches = cards.filter((c) => c.matchCount > 0).length
  const withRecommendations = cards.filter(
    (c) => c.recommendationCount > 0 && c.matchCount === 0
  ).length
  const noViable = totalUsers - withMatches - withRecommendations

  let bestPair: { a: string; b: string; score: number } | null = null
  for (const card of cards) {
    for (const diag of card.detail.pairDiagnostics || []) {
      if (!bestPair || diag.score > bestPair.score) {
        bestPair = { a: card.name, b: diag.candidate, score: diag.score }
      }
    }
  }
  return { totalUsers, withMatches, withRecommendations, noViable, bestPair, errors: result.errors }
}

/** Strip heavy fields (breakdown) from a diagnostic for compact storage. */
function slim(p: PairDiag): PairDiag {
  return {
    candidate: p.candidate,
    candidateId: p.candidateId,
    score: p.score,
    tier: p.tier,
    outcome: p.outcome,
    reason: p.reason,
  }
}

/**
 * Build the bounded, persistable snapshot from a full live recompute result.
 * Keeps every detail (full pool → accurate tiles) and full match/rec candidate
 * lists; caps below-band/blocked to BELOW_BLOCKED_CAP and records exact counts.
 * Returned as a RecomputeResult so it flows through the same transform on load.
 */
export function buildConsoleSnapshot(
  result: RecomputeResult,
  opts: { runAt: string; triggeredBy: string }
): RecomputeResult {
  return {
    total: result.total,
    computed: result.computed,
    errors: result.errors,
    fromStored: true,
    runAt: opts.runAt,
    triggeredBy: opts.triggeredBy,
    details: result.details.map((d) => {
      const { matches, recommendations, belowBand, blocked } = groupDiagnostics(d)
      return {
        partnershipId: d.partnershipId,
        displayName: d.displayName ?? null,
        success: d.success,
        matchesComputed: d.matchesComputed,
        candidatesEvaluated: d.candidatesEvaluated,
        counts: {
          match: matches.length,
          recommendation: recommendations.length,
          belowBand: belowBand.length,
          blocked: blocked.length,
        },
        // Full matches+recs (small) + capped below-band/blocked; breakdown stripped.
        pairDiagnostics: [
          ...matches.map(slim),
          ...recommendations.map(slim),
          ...belowBand.slice(0, BELOW_BLOCKED_CAP).map(slim),
          ...blocked.slice(0, BELOW_BLOCKED_CAP).map(slim),
        ],
      }
    }),
  }
}
