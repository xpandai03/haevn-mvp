/**
 * HAEVN Matching Engine - Lifestyle Compatibility Category
 *
 * Evaluates energy levels, scheduling, cultural identity, habits,
 * logistics, and general life rhythm.
 *
 * Weight: 10% of overall score (when included)
 *
 * IMPORTANT: Not all users answer every lifestyle question.
 * Scoring works with partial data. If coverage < 40%, this
 * category is excluded and weights are renormalized.
 *
 * Sub-components (CORE - asked of everyone):
 * - Distance & Mobility (20%): Q19a, Q19b, Q19c
 * - Privacy/Discretion (15%): Q20
 * - Social Energy (15%): Q36, Q36a
 * - Substances (10%): Q18
 * - Languages (10%): Q13a
 *
 * Sub-components (EXTENDED - romantic/long-term intent):
 * - Lifestyle Importance (5%): Q13
 * - Cultural/Worldview (10%): Q14a, Q14b
 * - Children (5%): Q17
 * - Dietary (5%): Q17a
 * - Pets (5%): Q17b
 */

import type { NormalizedAnswers, CategoryScore, SubScore } from '../types'
import { LIFESTYLE_WEIGHTS, LIFESTYLE_COVERAGE_THRESHOLD } from '../utils/weights'
import {
  hasOverlap,
  jaccardSimilarity,
  tierProximityScore,
  weightedAverage,
  calculateCoverage,
  binaryMatch,
  PRIVACY_TIERS,
} from '../utils/scoring'
import {
  getArrayAnswer,
  getStringAnswer,
} from '../utils/normalizeAnswers'

// =============================================================================
// TIER ORDERINGS FOR LIFESTYLE QUESTIONS
// =============================================================================

/**
 * Distance preference tiers (Q19a)
 */
const DISTANCE_TIERS = [
  'same_neighborhood', 'same_city',
  'within_30_miles', 'within_50_miles',
  'within_100_miles', 'same_state',
  'same_region', 'anywhere',
  'willing_to_relocate',
] as const

/**
 * Travel willingness tiers (Q19c)
 */
const TRAVEL_TIERS = [
  'never', 'rarely',
  'sometimes', 'occasionally',
  'often', 'frequently',
  'always', 'very_willing',
] as const

/**
 * Social energy tiers (Q36)
 */
const SOCIAL_ENERGY_TIERS = [
  'very_introverted', 'introverted', 'introvert',
  'ambivert', 'balanced',
  'extroverted', 'extrovert', 'very_extroverted',
] as const

/**
 * Substance use tiers (Q18)
 */
const SUBSTANCE_TIERS = [
  'never', 'sober',
  'rarely', 'occasionally',
  'social_drinker', 'moderate',
  'cannabis_friendly', 'frequent',
  'regular', 'party',
] as const

/**
 * Lifestyle importance tiers (Q13)
 */
const LIFESTYLE_IMPORTANCE_TIERS = [
  'not_important', 'slightly_important',
  'somewhat_important', 'moderately_important',
  'important', 'very_important',
  'essential',
] as const

/**
 * Children preference tiers (Q17)
 */
const CHILDREN_TIERS = [
  'no_children_ever', 'no_children',
  'open', 'undecided', 'maybe',
  'want_children', 'have_children',
  'have_and_want_more',
] as const

// =============================================================================
// MAIN LIFESTYLE SCORER
// =============================================================================

/**
 * Calculate Lifestyle Compatibility score between two partners.
 *
 * @param userAnswers - Normalized answers from User
 * @param matchAnswers - Normalized answers from Match
 * @returns CategoryScore for Lifestyle Compatibility with coverage info
 */
export function scoreLifestyle(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): CategoryScore {
  const subScores: SubScore[] = [
    // CORE sub-components
    scoreDistance(userAnswers, matchAnswers),
    scorePrivacy(userAnswers, matchAnswers),
    scoreSocialEnergy(userAnswers, matchAnswers),
    scoreSubstances(userAnswers, matchAnswers),
    scoreLanguages(userAnswers, matchAnswers),
    // EXTENDED sub-components
    scoreLifestyleImportance(userAnswers, matchAnswers),
    scoreCultural(userAnswers, matchAnswers),
    scoreChildren(userAnswers, matchAnswers),
    scoreDietary(userAnswers, matchAnswers),
    scorePets(userAnswers, matchAnswers),
  ]

  const score = weightedAverage(subScores)
  const coverage = calculateCoverage(subScores)

  // Determine if category should be included based on coverage threshold
  const included = coverage >= LIFESTYLE_COVERAGE_THRESHOLD

  return {
    category: 'lifestyle',
    score,
    weight: 10,
    subScores,
    coverage,
    included,
  }
}

/**
 * Calculate what percentage of Lifestyle questions both parties answered.
 *
 * @param userAnswers - Normalized answers from User
 * @param matchAnswers - Normalized answers from Match
 * @returns Coverage as a decimal (0-1)
 */
export function calculateLifestyleCoverage(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): number {
  const result = scoreLifestyle(userAnswers, matchAnswers)
  return result.coverage
}

// =============================================================================
// CORE SUB-COMPONENT SCORERS
// =============================================================================

/**
 * Score Distance sub-component (20%)
 * Q19a: Distance preference, Q19b: Mobility, Q19c: Willingness to travel
 * Tier comparison for distance compatibility.
 */
function scoreDistance(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userDistance = getStringAnswer(userAnswers, 'Q19a')
  const matchDistance = getStringAnswer(matchAnswers, 'Q19a')
  const userMobility = getStringAnswer(userAnswers, 'Q19b')
  const matchMobility = getStringAnswer(matchAnswers, 'Q19b')
  const userTravel = getStringAnswer(userAnswers, 'Q19c')
  const matchTravel = getStringAnswer(matchAnswers, 'Q19c')

  // Check if we have any data
  const hasDistanceData =
    (userDistance && matchDistance) ||
    (userMobility && matchMobility) ||
    (userTravel && matchTravel)

  if (!hasDistanceData) {
    return {
      key: 'distance',
      score: 0,
      weight: LIFESTYLE_WEIGHTS.distance.weight,
      matched: false,
      reason: 'Distance preferences not specified',
    }
  }

  let totalScore = 0
  let components = 0

  // Score distance preference alignment
  if (userDistance && matchDistance) {
    const distanceScore = tierProximityScore(
      userDistance,
      matchDistance,
      DISTANCE_TIERS,
      4 // Tolerate 4 tier difference
    )
    totalScore += distanceScore
    components++
  }

  // Score mobility alignment
  if (userMobility && matchMobility) {
    const mobilityScore = binaryMatch(userMobility, matchMobility)
    // Different mobility is okay, same is bonus
    totalScore += mobilityScore > 0 ? 100 : 60
    components++
  }

  // Score travel willingness alignment
  if (userTravel && matchTravel) {
    const travelScore = tierProximityScore(
      userTravel,
      matchTravel,
      TRAVEL_TIERS,
      3
    )
    totalScore += travelScore
    components++
  }

  const finalScore = components > 0 ? Math.round(totalScore / components) : 0

  return {
    key: 'distance',
    score: finalScore,
    weight: LIFESTYLE_WEIGHTS.distance.weight,
    matched: components > 0,
    reason: finalScore >= 70
      ? 'Compatible distance preferences'
      : finalScore >= 50
        ? 'Workable distance situation'
        : 'Different distance expectations',
  }
}

/**
 * Score Privacy sub-component (15%)
 * Q20: Privacy/discretion level
 * Tier comparison - avoid extreme mismatches.
 */
function scorePrivacy(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userPrivacy = getStringAnswer(userAnswers, 'Q20')
  const matchPrivacy = getStringAnswer(matchAnswers, 'Q20')

  if (!userPrivacy || !matchPrivacy) {
    return {
      key: 'privacy',
      score: 0,
      weight: LIFESTYLE_WEIGHTS.privacy.weight,
      matched: false,
      reason: 'Privacy preferences not specified',
    }
  }

  const privacyScore = tierProximityScore(
    userPrivacy,
    matchPrivacy,
    PRIVACY_TIERS
  )

  return {
    key: 'privacy',
    score: privacyScore,
    weight: LIFESTYLE_WEIGHTS.privacy.weight,
    matched: true,
    reason: privacyScore >= 70
      ? 'Compatible privacy levels'
      : privacyScore >= 50
        ? 'Workable privacy alignment'
        : 'Different privacy needs',
  }
}

/**
 * Score Social Energy sub-component (15%)
 * Q36: Introversion/extroversion, Q36a: Social preferences
 * Tier comparison for social energy.
 */
function scoreSocialEnergy(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userEnergy = getStringAnswer(userAnswers, 'Q36')
  const matchEnergy = getStringAnswer(matchAnswers, 'Q36')
  const userSocialPref = getStringAnswer(userAnswers, 'Q36a')
  const matchSocialPref = getStringAnswer(matchAnswers, 'Q36a')

  // Check if we have any data
  const hasEnergyData = (userEnergy && matchEnergy) || (userSocialPref && matchSocialPref)

  if (!hasEnergyData) {
    return {
      key: 'socialEnergy',
      score: 0,
      weight: LIFESTYLE_WEIGHTS.socialEnergy.weight,
      matched: false,
      reason: 'Social energy not specified',
    }
  }

  let totalScore = 0
  let components = 0

  // Score introversion/extroversion alignment
  if (userEnergy && matchEnergy) {
    const energyScore = tierProximityScore(
      userEnergy,
      matchEnergy,
      SOCIAL_ENERGY_TIERS,
      3 // Similar energy levels preferred
    )
    totalScore += energyScore
    components++
  }

  // Score social preference alignment
  if (userSocialPref && matchSocialPref) {
    const prefScore = binaryMatch(userSocialPref, matchSocialPref)
    // Similar preferences good, different is okay
    totalScore += prefScore > 0 ? 100 : 60
    components++
  }

  const finalScore = components > 0 ? Math.round(totalScore / components) : 0

  return {
    key: 'socialEnergy',
    score: finalScore,
    weight: LIFESTYLE_WEIGHTS.socialEnergy.weight,
    matched: components > 0,
    reason: finalScore >= 70
      ? 'Well-matched social energy'
      : finalScore >= 50
        ? 'Compatible social styles'
        : 'Different social energy levels',
  }
}

/**
 * Score Substances sub-component (10%)
 * Q18: Substance use/relationship
 * Tier comparison for substance use alignment.
 */
function scoreSubstances(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userSubstance = getStringAnswer(userAnswers, 'Q18')
  const matchSubstance = getStringAnswer(matchAnswers, 'Q18')

  if (!userSubstance || !matchSubstance) {
    return {
      key: 'substances',
      score: 0,
      weight: LIFESTYLE_WEIGHTS.substances.weight,
      matched: false,
      reason: 'Substance preferences not specified',
    }
  }

  const substanceScore = tierProximityScore(
    userSubstance,
    matchSubstance,
    SUBSTANCE_TIERS,
    3 // Tolerate 3 tier difference
  )

  return {
    key: 'substances',
    score: substanceScore,
    weight: LIFESTYLE_WEIGHTS.substances.weight,
    matched: true,
    reason: substanceScore >= 70
      ? 'Compatible substance attitudes'
      : substanceScore >= 50
        ? 'Workable substance alignment'
        : 'Different substance preferences',
  }
}

/**
 * Score Languages sub-component (10%)
 * Q13a: Languages spoken
 * Many-to-many overlap - bonus for shared languages.
 */
function scoreLanguages(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userLanguages = getArrayAnswer(userAnswers, 'Q13a')
  const matchLanguages = getArrayAnswer(matchAnswers, 'Q13a')

  if (userLanguages.length === 0 || matchLanguages.length === 0) {
    return {
      key: 'languages',
      score: 0,
      weight: LIFESTYLE_WEIGHTS.languages.weight,
      matched: false,
      reason: 'Languages not specified',
    }
  }

  // Calculate overlap
  const languageScore = jaccardSimilarity(userLanguages, matchLanguages)
  const hasSharedLanguage = hasOverlap(userLanguages, matchLanguages)

  // Strong bonus for any shared language
  const finalScore = hasSharedLanguage
    ? Math.min(100, languageScore + 40)
    : languageScore

  return {
    key: 'languages',
    score: finalScore,
    weight: LIFESTYLE_WEIGHTS.languages.weight,
    matched: true,
    reason: hasSharedLanguage
      ? 'Shared language(s) available'
      : 'No common languages',
  }
}

// =============================================================================
// EXTENDED SUB-COMPONENT SCORERS
// =============================================================================

/**
 * Score Lifestyle Importance sub-component (5%)
 * Q13: How important is lifestyle alignment
 * Tier comparison.
 */
function scoreLifestyleImportance(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userImportance = getStringAnswer(userAnswers, 'Q13')
  const matchImportance = getStringAnswer(matchAnswers, 'Q13')

  if (!userImportance || !matchImportance) {
    return {
      key: 'lifestyleImportance',
      score: 0,
      weight: LIFESTYLE_WEIGHTS.lifestyleImportance.weight,
      matched: false,
      reason: 'Lifestyle importance not specified',
    }
  }

  const importanceScore = tierProximityScore(
    userImportance,
    matchImportance,
    LIFESTYLE_IMPORTANCE_TIERS,
    3
  )

  return {
    key: 'lifestyleImportance',
    score: importanceScore,
    weight: LIFESTYLE_WEIGHTS.lifestyleImportance.weight,
    matched: true,
    reason: importanceScore >= 70
      ? 'Similar lifestyle priorities'
      : 'Different lifestyle priorities',
  }
}

/**
 * Score Cultural sub-component (10%)
 * Q14a: Cultural alignment, Q14b: Worldview/values
 * Many-to-many and tier comparison.
 */
function scoreCultural(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userCultural = getStringAnswer(userAnswers, 'Q14a')
  const matchCultural = getStringAnswer(matchAnswers, 'Q14a')
  const userWorldview = getStringAnswer(userAnswers, 'Q14b')
  const matchWorldview = getStringAnswer(matchAnswers, 'Q14b')

  // Check if we have any data
  const hasCulturalData =
    (userCultural && matchCultural) || (userWorldview && matchWorldview)

  if (!hasCulturalData) {
    return {
      key: 'cultural',
      score: 0,
      weight: LIFESTYLE_WEIGHTS.cultural.weight,
      matched: false,
      reason: 'Cultural preferences not specified',
    }
  }

  let totalScore = 0
  let components = 0

  // Score cultural alignment
  if (userCultural && matchCultural) {
    const culturalScore = binaryMatch(userCultural, matchCultural)
    // Similar cultural values = bonus, different = neutral
    totalScore += culturalScore > 0 ? 100 : 50
    components++
  }

  // Score worldview alignment
  if (userWorldview && matchWorldview) {
    const worldviewScore = binaryMatch(userWorldview, matchWorldview)
    totalScore += worldviewScore > 0 ? 100 : 50
    components++
  }

  const finalScore = components > 0 ? Math.round(totalScore / components) : 0

  return {
    key: 'cultural',
    score: finalScore,
    weight: LIFESTYLE_WEIGHTS.cultural.weight,
    matched: components > 0,
    reason: finalScore >= 70
      ? 'Well-aligned cultural values'
      : 'Different cultural backgrounds',
  }
}

/**
 * Score Children sub-component (5%)
 * Q17: Children preference
 * Tier comparison - critical for long-term matches.
 */
function scoreChildren(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userChildren = getStringAnswer(userAnswers, 'Q17')
  const matchChildren = getStringAnswer(matchAnswers, 'Q17')

  if (!userChildren || !matchChildren) {
    return {
      key: 'children',
      score: 0,
      weight: LIFESTYLE_WEIGHTS.children.weight,
      matched: false,
      reason: 'Children preferences not specified',
    }
  }

  const childrenScore = tierProximityScore(
    userChildren,
    matchChildren,
    CHILDREN_TIERS,
    2 // Must be within 2 tiers - this is critical
  )

  // Check for extreme mismatch (no_children_ever vs want_children)
  const userNorm = userChildren.toLowerCase()
  const matchNorm = matchChildren.toLowerCase()
  const isExtremeMismatch =
    (userNorm.includes('no_children') && matchNorm.includes('want')) ||
    (matchNorm.includes('no_children') && userNorm.includes('want'))

  const finalScore = isExtremeMismatch ? Math.round(childrenScore * 0.5) : childrenScore

  return {
    key: 'children',
    score: finalScore,
    weight: LIFESTYLE_WEIGHTS.children.weight,
    matched: true,
    reason: isExtremeMismatch
      ? 'Incompatible children preferences'
      : finalScore >= 70
        ? 'Compatible children preferences'
        : 'Different children expectations',
  }
}

/**
 * Score Dietary sub-component (5%)
 * Q17a: Dietary needs/restrictions
 * Many-to-many overlap.
 */
function scoreDietary(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userDietary = getArrayAnswer(userAnswers, 'Q17a')
  const matchDietary = getArrayAnswer(matchAnswers, 'Q17a')

  if (userDietary.length === 0 || matchDietary.length === 0) {
    return {
      key: 'dietary',
      score: 0,
      weight: LIFESTYLE_WEIGHTS.dietary.weight,
      matched: false,
      reason: 'Dietary preferences not specified',
    }
  }

  const dietaryScore = jaccardSimilarity(userDietary, matchDietary)
  const hasSharedDiet = hasOverlap(userDietary, matchDietary)

  // Bonus for shared dietary preferences
  const finalScore = hasSharedDiet
    ? Math.min(100, dietaryScore + 20)
    : Math.max(40, dietaryScore) // Minimum 40 for different diets (not dealbreaker)

  return {
    key: 'dietary',
    score: finalScore,
    weight: LIFESTYLE_WEIGHTS.dietary.weight,
    matched: true,
    reason: hasSharedDiet
      ? 'Shared dietary preferences'
      : 'Different dietary needs',
  }
}

/**
 * Score Pets sub-component (5%)
 * Q17b: Pet situation
 * Binary/tier comparison.
 */
function scorePets(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userPets = getStringAnswer(userAnswers, 'Q17b')
  const matchPets = getStringAnswer(matchAnswers, 'Q17b')

  if (!userPets || !matchPets) {
    return {
      key: 'pets',
      score: 0,
      weight: LIFESTYLE_WEIGHTS.pets.weight,
      matched: false,
      reason: 'Pet preferences not specified',
    }
  }

  const petScore = binaryMatch(userPets, matchPets)

  // Similar pet situations = bonus, different = neutral (not a dealbreaker)
  const finalScore = petScore > 0 ? 100 : 60

  return {
    key: 'pets',
    score: finalScore,
    weight: LIFESTYLE_WEIGHTS.pets.weight,
    matched: true,
    reason: petScore > 0
      ? 'Compatible pet situations'
      : 'Different pet situations',
  }
}
