/**
 * Score bands — the SINGLE SOURCE OF TRUTH for the Matches vs Recommendations
 * split. Both the member-facing readers (getComputedMatchCards /
 * getRecommendationCards) and the admin console import from here so the two can
 * never drift again.
 *
 * Pure module — no server/client deps, safe to import from either context.
 *
 *   Matches:         score >= 80
 *   Recommendations: 77 <= score <= 79  (inclusive both ends)
 *   Below band:      score < 77          (diagnostic only — NEVER a recommendation)
 */

export const MATCH_MIN_SCORE = 80
export const REC_MIN_SCORE = 77
export const REC_MAX_SCORE = 79

/** A "match" — releasable on the Matches surface. */
export function isMatchScore(score: number): boolean {
  return score >= MATCH_MIN_SCORE
}

/** A "recommendation" — the 77–79 near-miss band (inclusive). */
export function isRecommendationScore(score: number): boolean {
  return score >= REC_MIN_SCORE && score <= REC_MAX_SCORE
}

/**
 * Inclusive [min, max] score band for a card query. Matches default to
 * [80, ∞); Recommendations pass { minScore: 77, maxScore: 79 }. Used by
 * getComputedMatchCards to enforce the >=80 guard.
 */
export function scoreBounds(opts: { minScore?: number; maxScore?: number } = {}): {
  min: number
  max: number
} {
  return {
    min: opts.minScore ?? MATCH_MIN_SCORE,
    max: opts.maxScore ?? Number.POSITIVE_INFINITY,
  }
}
