// REVISION: Matching Model Update per Rik spec 04-10-2026
/**
 * HAEVN Matching Engine - Shared Scoring Utilities
 *
 * Common scoring functions used across multiple categories:
 * - Set overlap (Jaccard similarity)
 * - Overlap-soft (intersection/min with 0.65 floor)
 * - Tier/adjacency comparison
 * - Tolerance-band distance scoring
 * - Classification-weighted averaging
 * - Concept suppression
 */

import type { SubScore, RowClassification } from '../types'
import { CLASSIFICATION_MULTIPLIERS, CONCEPT_SUPPRESSION_FACTOR } from '../types'
import { getRowMetadata } from '../constants/classificationMap'

// =============================================================================
// SET OVERLAP / JACCARD SIMILARITY
// =============================================================================

/**
 * Calculate Jaccard similarity between two sets.
 * J(A, B) = |A ∩ B| / |A ∪ B|
 *
 * @param setA - First set of values
 * @param setB - Second set of values
 * @returns Score from 0-100
 */
export function jaccardSimilarity(setA: string[], setB: string[]): number {
  if (setA.length === 0 && setB.length === 0) return 100 // Both empty = match
  if (setA.length === 0 || setB.length === 0) return 0 // One empty = no match

  const normalizedA = setA.map(s => s.toLowerCase().trim())
  const normalizedB = setB.map(s => s.toLowerCase().trim())

  const intersection = normalizedA.filter(a => normalizedB.includes(a))
  const unionSet = new Set([...normalizedA, ...normalizedB])
  const union = Array.from(unionSet)

  return Math.round((intersection.length / union.length) * 100)
}

/**
 * Check if two sets have any overlap.
 *
 * @returns true if at least one common element
 */
export function hasOverlap(setA: string[], setB: string[]): boolean {
  const normalizedA = setA.map(s => s.toLowerCase().trim())
  const normalizedB = setB.map(s => s.toLowerCase().trim())

  return normalizedA.some(a => normalizedB.includes(a))
}

/**
 * Count the number of overlapping elements.
 */
export function countOverlap(setA: string[], setB: string[]): number {
  const normalizedA = setA.map(s => s.toLowerCase().trim())
  const normalizedB = setB.map(s => s.toLowerCase().trim())

  return normalizedA.filter(a => normalizedB.includes(a)).length
}

/**
 * Get the overlapping elements between two sets.
 */
export function getOverlap(setA: string[], setB: string[]): string[] {
  const normalizedB = setB.map(s => s.toLowerCase().trim())

  return setA.filter(a => normalizedB.includes(a.toLowerCase().trim()))
}

// =============================================================================
// TIER / ADJACENCY SCORING
// =============================================================================

/**
 * Score based on position in an ordered tier list.
 * Adjacent tiers score higher than distant ones.
 *
 * @param valueA - First value
 * @param valueB - Second value
 * @param tierOrder - Ordered list of valid tier values
 * @param maxDifference - Maximum allowed tier difference (default: length-1)
 * @returns Score from 0-100
 */
export function tierProximityScore(
  valueA: string | undefined,
  valueB: string | undefined,
  tierOrder: readonly string[],
  maxDifference?: number
): number {
  if (!valueA || !valueB) return 0

  const normalizedA = valueA.toLowerCase().trim()
  const normalizedB = valueB.toLowerCase().trim()

  const indexA = tierOrder.findIndex(t => t.toLowerCase() === normalizedA)
  const indexB = tierOrder.findIndex(t => t.toLowerCase() === normalizedB)

  if (indexA === -1 || indexB === -1) return 50 // Unknown tier = neutral

  const distance = Math.abs(indexA - indexB)
  const maxDist = maxDifference ?? tierOrder.length - 1

  if (maxDist === 0) return distance === 0 ? 100 : 0

  // Convert distance to score: 0 distance = 100, max distance = 0
  return Math.round(Math.max(0, (1 - distance / maxDist)) * 100)
}

/**
 * Check if two values are within N tiers of each other.
 */
export function isWithinTiers(
  valueA: string | undefined,
  valueB: string | undefined,
  tierOrder: readonly string[],
  maxDistance: number
): boolean {
  if (!valueA || !valueB) return true // Can't check, assume ok

  const normalizedA = valueA.toLowerCase().trim()
  const normalizedB = valueB.toLowerCase().trim()

  const indexA = tierOrder.findIndex(t => t.toLowerCase() === normalizedA)
  const indexB = tierOrder.findIndex(t => t.toLowerCase() === normalizedB)

  if (indexA === -1 || indexB === -1) return true // Unknown, assume ok

  return Math.abs(indexA - indexB) <= maxDistance
}

// =============================================================================
// RANGE / NUMERIC SCORING
// =============================================================================

/**
 * Check if a numeric value falls within a range.
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * Score based on how close a value is to a target.
 * Returns 100 if exact match, 0 if at max distance.
 */
export function proximityScore(
  value: number,
  target: number,
  maxDistance: number
): number {
  const distance = Math.abs(value - target)
  if (distance >= maxDistance) return 0
  return Math.round((1 - distance / maxDistance) * 100)
}

// =============================================================================
// DISTANCE-BASED SCORING (for 1-5 scale questions)
// =============================================================================

/**
 * Standard distance scoring matrix for 1-5 scale questions.
 * diff 0 → 100, diff 1 → 85, diff 2 → 65, diff 3 → 40, diff 4 → 20
 */
const STANDARD_DISTANCE_SCORES: Record<number, number> = {
  0: 100,
  1: 85,
  2: 65,
  3: 40,
  4: 20,
}

/**
 * Engagement-specific distance scoring matrix.
 * Steeper penalty for divergence — this dimension is highly predictive.
 * diff 0 → 100, diff 1 → 85, diff 2 → 60, diff 3 → 35, diff 4 → 15
 */
const ENGAGEMENT_DISTANCE_SCORES: Record<number, number> = {
  0: 100,
  1: 85,
  2: 60,
  3: 35,
  4: 15,
}

/**
 * Compute a distance-based compatibility score for two 1-5 scale answers.
 *
 * @param valueA - First user's answer (1-5 as string or number)
 * @param valueB - Second user's answer (1-5 as string or number)
 * @param type - Which scoring matrix to use
 * @returns Score 0-100, or null if either value is invalid
 */
export function distanceScore(
  valueA: string | undefined,
  valueB: string | undefined,
  type: 'standard' | 'engagement' = 'standard'
): number | null {
  if (!valueA || !valueB) return null

  const a = parseFloat(valueA)
  const b = parseFloat(valueB)

  if (isNaN(a) || isNaN(b) || a < 1 || a > 5 || b < 1 || b > 5) return null

  const diff = Math.abs(Math.round(a) - Math.round(b))
  const matrix = type === 'engagement' ? ENGAGEMENT_DISTANCE_SCORES : STANDARD_DISTANCE_SCORES

  return matrix[diff] ?? 0
}

// =============================================================================
// WEIGHTED AVERAGING
// =============================================================================

/**
 * Calculate weighted average of sub-scores.
 *
 * @param subScores - Array of sub-scores with weights
 * @returns Weighted average score (0-100)
 */
export function weightedAverage(subScores: SubScore[]): number {
  const matchedScores = subScores.filter(s => s.matched)

  if (matchedScores.length === 0) return 0

  const totalWeight = matchedScores.reduce((sum, s) => sum + s.weight, 0)
  const weightedSum = matchedScores.reduce((sum, s) => sum + s.score * s.weight, 0)

  if (totalWeight === 0) return 0

  return Math.round(weightedSum / totalWeight)
}

/**
 * Calculate coverage (what fraction of sub-components were scorable).
 */
export function calculateCoverage(subScores: SubScore[]): number {
  if (subScores.length === 0) return 0

  const matchedWeight = subScores
    .filter(s => s.matched)
    .reduce((sum, s) => sum + s.weight, 0)

  const totalWeight = subScores.reduce((sum, s) => sum + s.weight, 0)

  if (totalWeight === 0) return 0

  return matchedWeight / totalWeight
}

// =============================================================================
// BINARY SCORING
// =============================================================================

/**
 * Binary match: 100 if values match, 0 if they don't.
 */
export function binaryMatch(
  valueA: string | undefined,
  valueB: string | undefined
): number {
  if (!valueA || !valueB) return 0

  return valueA.toLowerCase().trim() === valueB.toLowerCase().trim() ? 100 : 0
}

/**
 * Boolean match: 100 if both true/false, 0 if mismatch.
 */
export function booleanMatch(
  valueA: boolean | undefined,
  valueB: boolean | undefined
): number {
  if (valueA === undefined || valueB === undefined) return 50
  return valueA === valueB ? 100 : 0
}

// =============================================================================
// PENALTY SCORING
// =============================================================================

/**
 * Apply a penalty for extreme mismatches.
 * Returns a multiplier (0-1) to apply to the base score.
 */
export function extremeMismatchPenalty(
  valueA: string | undefined,
  valueB: string | undefined,
  extremePairs: [string, string][]
): number {
  if (!valueA || !valueB) return 1 // No penalty if missing

  const normalizedA = valueA.toLowerCase().trim()
  const normalizedB = valueB.toLowerCase().trim()

  for (const [ext1, ext2] of extremePairs) {
    const isExtreme =
      (normalizedA === ext1.toLowerCase() && normalizedB === ext2.toLowerCase()) ||
      (normalizedA === ext2.toLowerCase() && normalizedB === ext1.toLowerCase())

    if (isExtreme) {
      return 0.5 // 50% penalty for extreme mismatch
    }
  }

  return 1 // No penalty
}

// =============================================================================
// TIER ORDERINGS FOR SPECIFIC QUESTIONS
// =============================================================================

/**
 * Attachment style tiers (Q10) - for adjacency scoring
 * From most avoidant to most anxious
 */
export const ATTACHMENT_TIERS = [
  'avoidant',
  'dismissive-avoidant',
  'fearful-avoidant',
  'secure',
  'anxious-preoccupied',
  'anxious',
] as const

/**
 * Emotional availability tiers (Q10a)
 * From least to most available
 */
export const AVAILABILITY_TIERS = [
  'very_limited',
  'limited',
  'moderate',
  'available',
  'very_available',
] as const

/**
 * Messaging pace tiers (Q12a)
 * From slowest to fastest
 */
export const MESSAGING_PACE_TIERS = [
  'very_slow',
  'slow',
  'moderate',
  'quick',
  'very_quick',
] as const

/**
 * Privacy/discretion level tiers (Q20)
 * From most private to most open
 */
export const PRIVACY_TIERS = [
  'very_private',
  'private',
  'moderate',
  'open',
  'very_open',
] as const

/**
 * Visibility comfort tiers (Q20b)
 * From most hidden to most visible
 */
export const VISIBILITY_TIERS = [
  'completely_hidden',
  'hidden',
  'selective',
  'visible',
  'completely_visible',
] as const

/**
 * Exclusivity tiers (Q7, Q8)
 * From most exclusive to most open
 */
export const EXCLUSIVITY_TIERS = [
  'monogamous',
  'mostly_exclusive',
  'flexible',
  'open',
  'fully_open',
] as const

/**
 * Time availability tiers (Q15)
 * From least to most available
 */
export const TIME_AVAILABILITY_TIERS = [
  'very_limited',
  'limited',
  'moderate',
  'flexible',
  'very_flexible',
] as const

/**
 * Chemistry importance tiers (Q25)
 * From least to most important
 */
export const CHEMISTRY_IMPORTANCE_TIERS = [
  'not_important',
  'somewhat_important',
  'important',
  'very_important',
  'essential',
] as const

// =============================================================================
// OVERLAP-SOFT SCORING (Rik spec section 15.2)
// =============================================================================

/**
 * Soft overlap scoring: intersection / min(|A|, |B|) with a 0.65 floor.
 * More generous than Jaccard for partial overlap — if ANY item overlaps,
 * the minimum score is 65 (instead of potentially low Jaccard ratios).
 *
 * @returns Score from 0-100
 */
export function overlapSoft(setA: string[], setB: string[]): number {
  if (setA.length === 0 && setB.length === 0) return 100
  if (setA.length === 0 || setB.length === 0) return 0

  const normalizedA = setA.map(s => s.toLowerCase().trim())
  const normalizedB = setB.map(s => s.toLowerCase().trim())

  const intersection = normalizedA.filter(a => normalizedB.includes(a))
  const minSize = Math.min(normalizedA.length, normalizedB.length)

  if (intersection.length === 0) return 0

  const rawScore = intersection.length / minSize
  return Math.round(Math.max(0.65, rawScore) * 100)
}

// =============================================================================
// TOLERANCE-BAND DISTANCE SCORING (Rik spec)
// =============================================================================

/**
 * Tolerance-band distance scoring for 1-5 scale questions.
 * Softer penalties than the standard matrix: near-misses are forgiven.
 *
 * delta 0 → 100, delta 1 → 90, delta 2 → 75, delta 3 → 50, delta 4+ → 25
 *
 * @param valueA - First user's answer (1-5 as string)
 * @param valueB - Second user's answer (1-5 as string)
 * @returns Score 0-100, or null if either value is invalid
 */
export function tolerantDistance(
  valueA: string | undefined,
  valueB: string | undefined,
): number | null {
  if (!valueA || !valueB) return null

  const a = parseFloat(valueA)
  const b = parseFloat(valueB)

  if (isNaN(a) || isNaN(b) || a < 1 || a > 5 || b < 1 || b > 5) return null

  const delta = Math.abs(Math.round(a) - Math.round(b))

  if (delta <= 0) return 100
  if (delta === 1) return 90
  if (delta === 2) return 75
  if (delta === 3) return 50
  return 25
}

// =============================================================================
// CLASSIFICATION-WEIGHTED AVERAGING
// =============================================================================

/**
 * Apply classification multipliers to sub-scores within a section.
 * Adjusts weights based on row classification (major=1.0, moderate=0.6, light=0.2),
 * then renormalizes so the section still sums to 100.
 *
 * @param subScores - Raw sub-scores from a category scorer
 * @param section - Section name (e.g., 'intent', 'structure')
 * @returns Sub-scores with adjusted weights and effectiveWeight set
 */
export function applyClassificationWeights(
  subScores: SubScore[],
  section: string
): SubScore[] {
  const adjusted = subScores.map(s => {
    const meta = getRowMetadata(section, s.key)
    if (!meta || meta.classification === 'hard_gate') return { ...s, effectiveWeight: s.weight }

    const multiplier = CLASSIFICATION_MULTIPLIERS[meta.classification]
    return { ...s, effectiveWeight: s.weight * multiplier }
  })

  const totalAdjusted = adjusted
    .filter(s => s.matched)
    .reduce((sum, s) => sum + (s.effectiveWeight ?? s.weight), 0)

  if (totalAdjusted === 0) return adjusted

  return adjusted.map(s => {
    if (!s.matched) return s
    const ew = s.effectiveWeight ?? s.weight
    const normalized = (ew / totalAdjusted) * 100
    return { ...s, weight: Math.round(normalized * 100) / 100, effectiveWeight: ew }
  })
}

/**
 * Apply cross-section concept suppression to all sub-scores from all categories.
 * Non-primary instances of a concept get their effective weight × CONCEPT_SUPPRESSION_FACTOR.
 *
 * Operates on flattened sub-scores tagged with their section. Returns modified
 * CategoryScore arrays with adjusted weights. Called after all categories are scored
 * but before final score computation.
 */
export function applyConceptSuppression(
  categories: Array<{ category: string; subScores: SubScore[] }>
): Array<{ category: string; subScores: SubScore[] }> {
  const seenConcepts = new Set<string>()

  const allRows: Array<{
    category: string
    index: number
    meta: ReturnType<typeof getRowMetadata>
    subScore: SubScore
  }> = []

  for (const cat of categories) {
    cat.subScores.forEach((s, i) => {
      const meta = getRowMetadata(cat.category, s.key)
      allRows.push({ category: cat.category, index: i, meta, subScore: s })
    })
  }

  allRows.sort((a, b) => {
    const classOrder: Record<string, number> = { major: 0, moderate: 1, light: 2, hard_gate: 3 }
    const aOrder = classOrder[a.meta?.classification ?? 'light'] ?? 2
    const bOrder = classOrder[b.meta?.classification ?? 'light'] ?? 2
    if (aOrder !== bOrder) return aOrder - bOrder
    const aPrimary = a.meta?.is_primary_concept ? 0 : 1
    const bPrimary = b.meta?.is_primary_concept ? 0 : 1
    return aPrimary - bPrimary
  })

  const result = categories.map(cat => ({
    category: cat.category,
    subScores: [...cat.subScores],
  }))

  for (const row of allRows) {
    if (!row.meta || !row.subScore.matched) continue

    const conceptKey = row.meta.concept_key
    const catResult = result.find(c => c.category === row.category)
    if (!catResult) continue

    const subScore = catResult.subScores[row.index]

    if (seenConcepts.has(conceptKey) && !row.meta.is_primary_concept) {
      subScore.weight = Math.round(subScore.weight * CONCEPT_SUPPRESSION_FACTOR * 100) / 100
      subScore.effectiveWeight = subScore.weight
    }

    seenConcepts.add(conceptKey)
  }

  for (const cat of result) {
    const matchedTotal = cat.subScores
      .filter(s => s.matched)
      .reduce((sum, s) => sum + s.weight, 0)

    if (matchedTotal > 0 && matchedTotal !== 100) {
      const scale = 100 / matchedTotal
      for (const s of cat.subScores) {
        if (s.matched) {
          s.weight = Math.round(s.weight * scale * 100) / 100
        }
      }
    }
  }

  return result
}
