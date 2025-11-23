/**
 * HAEVN Matching Engine
 * Exports all matching, scoring, and compatibility utilities
 */

// Core scoring engine
export {
  calculateMatch,
  calculateMatches,
  type UserProfile,
  type MatchScore,
  type ScoreBreakdown
} from './scoring'

// Compatibility enhancements
export {
  extractTopFactor,
  getCompatibilityPercentage,
  getAllFactors,
  getMatchExplanation,
  getTierColor,
  getTierBadgeColor
} from './compatibility'

// Factor labels and metadata
export {
  FACTOR_LABELS,
  FACTOR_DESCRIPTIONS,
  FACTOR_ICONS,
  FACTOR_EXPLANATIONS,
  FACTOR_EMOJIS,
  getRandomFactorLabel,
  type FactorKey
} from './factors'
