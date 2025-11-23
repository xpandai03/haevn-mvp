/**
 * HAEVN Compatibility Enhancement
 * Extends the scoring system with human-readable compatibility metrics
 */

import { ScoreBreakdown, MatchScore } from './scoring'

/**
 * Extract the top contributing factor from a match score breakdown
 * Returns a human-readable label explaining why the match scored well
 *
 * @param breakdown - The score breakdown from calculateMatch
 * @returns Human-readable factor label
 */
export function extractTopFactor(breakdown: ScoreBreakdown): string {
  const factors = [
    {
      key: 'seeking_identity',
      value: breakdown.seeking_identity,
      label: 'Mutual attraction & identity alignment'
    },
    {
      key: 'structure',
      value: breakdown.structure,
      label: 'Compatible relationship structures'
    },
    {
      key: 'intent',
      value: breakdown.intent,
      label: 'Shared intentions & goals'
    },
    {
      key: 'location',
      value: breakdown.location,
      label: 'Geographic proximity'
    },
    {
      key: 'discretion',
      value: breakdown.discretion,
      label: 'Aligned privacy preferences'
    },
    {
      key: 'verification',
      value: breakdown.verification,
      label: 'Trust & verification'
    }
  ]

  // Find the factor with the highest contribution
  const topFactor = factors.reduce((max, factor) =>
    factor.value > max.value ? factor : max
  , factors[0])

  return topFactor.label
}

/**
 * Get compatibility percentage (0-100)
 * This is already calculated by the scoring engine, just normalized
 *
 * @param matchScore - The match score object
 * @returns Percentage as integer (0-100)
 */
export function getCompatibilityPercentage(matchScore: MatchScore): number {
  return Math.round(Math.min(100, Math.max(0, matchScore.score)))
}

/**
 * Get all factor contributions sorted by importance
 * Useful for displaying detailed compatibility breakdown
 *
 * @param breakdown - The score breakdown
 * @returns Array of factors sorted by contribution (highest first)
 */
export function getAllFactors(breakdown: ScoreBreakdown) {
  return [
    {
      key: 'seeking_identity',
      label: 'Mutual Attraction',
      value: breakdown.seeking_identity,
      description: 'How well your identities and preferences align'
    },
    {
      key: 'structure',
      label: 'Relationship Style',
      value: breakdown.structure,
      description: 'Compatibility of relationship structures (ENM, Monogamous, etc.)'
    },
    {
      key: 'intent',
      label: 'Shared Goals',
      value: breakdown.intent,
      description: 'What you\'re both looking for (dating, play, friendship)'
    },
    {
      key: 'location',
      label: 'Location',
      value: breakdown.location,
      description: 'How close you are geographically'
    },
    {
      key: 'discretion',
      label: 'Privacy Level',
      value: breakdown.discretion,
      description: 'How aligned your discretion preferences are'
    },
    {
      key: 'verification',
      label: 'Trust & Safety',
      value: breakdown.verification,
      description: 'Verification and background check status'
    }
  ].sort((a, b) => b.value - a.value)
}

/**
 * Get a short explanation of why this is a good match
 * Returns 2-3 sentences summarizing the top factors
 *
 * @param breakdown - The score breakdown
 * @param score - The total match score
 * @returns Explanation text
 */
export function getMatchExplanation(breakdown: ScoreBreakdown, score: number): string {
  const topFactors = getAllFactors(breakdown).slice(0, 3)

  const factorNames = topFactors
    .filter(f => f.value > 10) // Only mention factors contributing >10 points
    .map(f => f.label.toLowerCase())

  if (score >= 80) {
    return `This is an excellent match! You have strong alignment in ${factorNames.slice(0, 2).join(' and ')}.`
  } else if (score >= 70) {
    return `This is a great match! You share compatibility in ${factorNames.slice(0, 2).join(' and ')}.`
  } else if (score >= 60) {
    return `This is a good match. You align well on ${factorNames[0]}${factorNames[1] ? ' and ' + factorNames[1] : ''}.`
  } else if (score >= 40) {
    return `This match has potential. You have some compatibility in ${factorNames[0]}.`
  }

  return "This match may require more exploration to understand compatibility."
}

/**
 * Get tier color class for UI styling
 * Returns Tailwind color class based on match tier
 *
 * @param tier - Match tier
 * @returns Tailwind color class
 */
export function getTierColor(tier: MatchScore['tier']): string {
  switch (tier) {
    case 'Platinum':
      return 'text-purple-600'
    case 'Gold':
      return 'text-yellow-600'
    case 'Silver':
      return 'text-gray-500'
    case 'Bronze':
      return 'text-orange-600'
    case 'Excluded':
      return 'text-gray-400'
    default:
      return 'text-gray-500'
  }
}

/**
 * Get tier background color class for badges
 *
 * @param tier - Match tier
 * @returns Tailwind background color class
 */
export function getTierBadgeColor(tier: MatchScore['tier']): string {
  switch (tier) {
    case 'Platinum':
      return 'bg-purple-100 text-purple-800'
    case 'Gold':
      return 'bg-yellow-100 text-yellow-800'
    case 'Silver':
      return 'bg-gray-100 text-gray-800'
    case 'Bronze':
      return 'bg-orange-100 text-orange-800'
    case 'Excluded':
      return 'bg-gray-50 text-gray-600'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
