/**
 * Meetup category rubric v1 (pure, deterministic — production owns this).
 *
 * See docs/plans/meetup-spots-feed.md §3. Conservative by design:
 *  - coffee / restaurant: always qualify (universal, low-commitment) — high.
 *  - activity: always qualifies; high when BOTH sides are socially energetic
 *    (q36 >= 4), else normal.
 *  - alcohol venues (cocktail_bar / wine_bar / brewery): ONE shared gate —
 *    both sides alcohol-positive and neither sober. If either side is sober the
 *    whole group is EXCLUDED (respect sobriety). If a side's signal is unknown
 *    (and neither is sober) the group is included at low_confidence. The three
 *    are emitted as DISTINCT categories — the shared gate is our logic, not the
 *    client's schema.
 *  - hotel: never emitted in v1.
 *
 * The rubric NEVER invents a score and NEVER manufactures a category. q16a
 * (first-meet preference) is intentionally unused here — reserved for v2.
 */

import type { AlcoholSignal } from './normalize'
import type { QualifiedCategory, Confidence } from './types'

export interface MemberRubricSignals {
  alcohol: AlcoholSignal
  socialEnergy: number | null
}

const HIGH_SOCIAL = 4 // q36 clusters 2–4; >=4 is the upper ~38% → "high" for activity.

const ALCOHOL_VENUES = ['cocktail_bar', 'wine_bar', 'brewery'] as const

export function qualifyCategories(a: MemberRubricSignals, b: MemberRubricSignals): QualifiedCategory[] {
  const out: QualifiedCategory[] = []

  // Baseline — always qualify.
  out.push({ category: 'coffee', confidence: 'high' })
  out.push({ category: 'restaurant', confidence: 'high' })

  // Activity — always qualifies; confidence lifts when both are socially energetic.
  const bothEnergetic =
    a.socialEnergy != null && b.socialEnergy != null && a.socialEnergy >= HIGH_SOCIAL && b.socialEnergy >= HIGH_SOCIAL
  out.push({ category: 'activity', confidence: bothEnergetic ? 'high' : 'normal' })

  // Alcohol group — one gate, three emitted categories.
  const alcoholConfidence = alcoholGate(a.alcohol, b.alcohol)
  if (alcoholConfidence) {
    for (const category of ALCOHOL_VENUES) out.push({ category, confidence: alcoholConfidence })
  }

  return out
}

/**
 * Returns the confidence for the alcohol group, or null when the group is
 * EXCLUDED. Sober on either side excludes; both positive → normal; otherwise
 * (a side unknown, neither sober) → low_confidence.
 */
function alcoholGate(a: AlcoholSignal, b: AlcoholSignal): Confidence | null {
  if (a === 'sober' || b === 'sober') return null // respect sobriety — exclude alcohol venues
  if (a === 'positive' && b === 'positive') return 'normal'
  return 'low_confidence' // at least one unknown, neither sober
}
