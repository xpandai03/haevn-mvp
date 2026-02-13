/**
 * HAEVN Matching Engine - Shared Scoring Utilities
 *
 * Common scoring functions used across multiple categories:
 * - Set overlap (Jaccard similarity)
 * - Tier/adjacency comparison
 * - Range checking
 * - Weighted averaging
 */

import type { SubScore } from '../types'

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
