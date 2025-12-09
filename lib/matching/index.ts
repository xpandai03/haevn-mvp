/**
 * HAEVN Matching Engine
 * Exports all matching, scoring, and compatibility utilities
 *
 * NEW: Internal compatibility engine (v2) for partner-to-partner matching
 * based on full survey spec with 5 categories.
 */

// =============================================================================
// LEGACY EXPORTS (external matching - keep for backwards compatibility)
// =============================================================================

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

// =============================================================================
// NEW: INTERNAL COMPATIBILITY ENGINE (v2)
// =============================================================================

// Main entry points
export {
  calculateCompatibility,
  calculateCompatibilityFromRaw,
} from './calculateCompatibility'

// Type exports
export type {
  RawAnswers,
  NormalizedAnswers,
  SubScore,
  CategoryScore,
  ConstraintResult,
  CompatibilityTier,
  CompatibilityResult,
  PartnerAnswers,
  CompatibilityInput,
} from './types'

// Utility exports
export { normalizeAnswers, hasAnswer, asArray, asSingle } from './utils/normalizeAnswers'
export { checkConstraints } from './utils/constraints'
export {
  jaccardSimilarity,
  hasOverlap,
  countOverlap,
  getOverlap,
  tierProximityScore,
  isWithinTiers,
  weightedAverage,
  calculateCoverage,
  binaryMatch,
} from './utils/scoring'
export {
  CATEGORY_WEIGHTS,
  INTENT_WEIGHTS,
  STRUCTURE_WEIGHTS,
  CONNECTION_WEIGHTS,
  CHEMISTRY_WEIGHTS,
  LIFESTYLE_WEIGHTS,
  LIFESTYLE_COVERAGE_THRESHOLD,
  TIER_THRESHOLDS,
  renormalizeWeights,
  getTierFromScore,
} from './utils/weights'

// Category scorers (for advanced use / testing)
export { scoreIntent } from './categories/intent'
export { scoreStructure } from './categories/structure'
export { scoreConnection } from './categories/connection'
export { scoreChemistry } from './categories/chemistry'
export { scoreLifestyle, calculateLifestyleCoverage } from './categories/lifestyle'

// Question mappings (for reference / debugging)
export {
  INTENT_QUESTIONS,
  STRUCTURE_QUESTIONS,
  CONNECTION_QUESTIONS,
  CHEMISTRY_QUESTIONS,
  LIFESTYLE_QUESTIONS,
  CONSTRAINT_QUESTIONS,
  MULTI_SELECT_QUESTIONS,
  TIER_QUESTIONS,
} from './constants/questionMappings'
