// REVISION: Matching Model Update per Rik spec 04-10-2026
/**
 * HAEVN Matching Engine - Sexual Chemistry Category
 *
 * Evaluates turn-ons, erotic alignment, boundaries,
 * preferred roles, and sexual energy.
 *
 * Weight: 10% of overall score
 *
 * Sub-components (from CHEMISTRY_WEIGHTS constant):
 * - Erotic Profile Alignment (30%): Q23, Q24, Q25
 * - Roles/Kinks (30%): Q26, Q33, Q33a
 * - Frequency (10%): Q25a
 * - Boundaries (10%): Q28, Q29
 * - Physical Preferences (10%): Q27, Q27b
 * - Exploration (10%): Q34, Q34a
 */

import type { NormalizedAnswers, CategoryScore, SubScore } from '../types'
import { CHEMISTRY_WEIGHTS, CATEGORY_WEIGHTS } from '../utils/weights'
import {
  hasOverlap,
  jaccardSimilarity,
  overlapSoft,
  tierProximityScore,
  proximityScore,
  weightedAverage,
  calculateCoverage,
  applyClassificationWeights,
} from '../utils/scoring'
import {
  getArrayAnswer,
  getStringAnswer,
  asSingle,
} from '../utils/normalizeAnswers'

// =============================================================================
// TIER ORDERINGS FOR CHEMISTRY QUESTIONS
// =============================================================================

/**
 * Chemistry importance tiers (Q25)
 */
const CHEMISTRY_IMPORTANCE_TIERS = [
  'not_important', 'slightly_important',
  'somewhat_important', 'moderately_important',
  'important',
  'very_important',
  'essential', 'extremely_important',
] as const

/**
 * Frequency preference tiers (Q25a)
 */
const FREQUENCY_TIERS = [
  'rarely', 'few_times_year',
  'monthly', 'few_times_month',
  'weekly', 'few_times_week',
  'daily', 'multiple_daily',
] as const

/**
 * Kink experience level tiers (Q33a)
 */
const KINK_EXPERIENCE_TIERS = [
  'none', 'curious',
  'beginner', 'novice',
  'intermediate', 'experienced',
  'advanced', 'expert',
] as const

// =============================================================================
// MAIN CHEMISTRY SCORER
// =============================================================================

/**
 * Calculate Sexual Chemistry score between two partners.
 *
 * @param userAnswers - Normalized answers from User
 * @param matchAnswers - Normalized answers from Match
 * @returns CategoryScore for Sexual Chemistry
 */
export function scoreChemistry(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): CategoryScore {
  const rawSubScores: SubScore[] = [
    scoreEroticProfile(userAnswers, matchAnswers),
    scoreRolesKinks(userAnswers, matchAnswers),
    scoreFrequency(userAnswers, matchAnswers),
    scoreBoundaries(userAnswers, matchAnswers),
    scorePhysicalPreferences(userAnswers, matchAnswers),
    scoreExploration(userAnswers, matchAnswers),
  ]

  const subScores = applyClassificationWeights(rawSubScores, 'chemistry')
  const score = weightedAverage(subScores)
  const coverage = calculateCoverage(subScores)

  return {
    category: 'chemistry',
    score,
    weight: CATEGORY_WEIGHTS.chemistry,
    subScores,
    coverage,
    included: true,
  }
}

// =============================================================================
// SUB-COMPONENT SCORERS
// =============================================================================

/**
 * Score Erotic Profile sub-component (35%)
 * Q23: Erotic styles, Q24: Sexual experiences/interests, Q25: Chemistry importance
 * Many-to-many with importance alignment bonus.
 */
function scoreEroticProfile(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userStyles = getArrayAnswer(userAnswers, 'Q23')
  const matchStyles = getArrayAnswer(matchAnswers, 'Q23')
  const userExperiences = getArrayAnswer(userAnswers, 'Q24')
  const matchExperiences = getArrayAnswer(matchAnswers, 'Q24')
  const userImportance = getStringAnswer(userAnswers, 'Q25')
  const matchImportance = getStringAnswer(matchAnswers, 'Q25')

  // Check if we have any data
  const hasProfileData =
    userStyles.length > 0 || matchStyles.length > 0 ||
    userExperiences.length > 0 || matchExperiences.length > 0 ||
    userImportance || matchImportance

  if (!hasProfileData) {
    return {
      key: 'eroticProfile',
      score: 0,
      weight: CHEMISTRY_WEIGHTS.eroticProfile,
      matched: false,
      reason: 'Erotic profile not specified',
    }
  }

  let totalScore = 0
  let components = 0

  // overlap_soft: intersection/min with 0.65 floor
  if (userStyles.length > 0 && matchStyles.length > 0) {
    const styleScore = overlapSoft(userStyles, matchStyles)
    // Capped bonus (max 3% total score impact per Rik spec 15.5)
    const overlapBonus = hasOverlap(userStyles, matchStyles) ? 10 : 0
    totalScore += Math.min(100, styleScore + overlapBonus)
    components++
  }

  if (userExperiences.length > 0 && matchExperiences.length > 0) {
    const expScore = overlapSoft(userExperiences, matchExperiences)
    const overlapBonus = hasOverlap(userExperiences, matchExperiences) ? 10 : 0
    totalScore += Math.min(100, expScore + overlapBonus)
    components++
  }

  // Score chemistry importance alignment
  if (userImportance && matchImportance) {
    const importanceScore = tierProximityScore(
      userImportance,
      matchImportance,
      CHEMISTRY_IMPORTANCE_TIERS,
      4 // Tolerate 4 tier difference
    )
    totalScore += importanceScore
    components++
  }

  const finalScore = components > 0 ? Math.round(totalScore / components) : 0

  return {
    key: 'eroticProfile',
    score: finalScore,
    weight: CHEMISTRY_WEIGHTS.eroticProfile,
    matched: components > 0,
    reason: finalScore >= 70
      ? 'Strong erotic alignment'
      : finalScore >= 50
        ? 'Compatible erotic preferences'
        : 'Different erotic styles',
  }
}

/**
 * Score Roles/Kinks sub-component (35%)
 * Q26: Sexual roles, Q33: Kinks/fetishes, Q33a: Kink experience level
 * Complementary role matching + kink overlap.
 */
function scoreRolesKinks(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userRoles = getArrayAnswer(userAnswers, 'Q26')
  const matchRoles = getArrayAnswer(matchAnswers, 'Q26')
  const userKinks = getArrayAnswer(userAnswers, 'Q33')
  const matchKinks = getArrayAnswer(matchAnswers, 'Q33')
  const userKinkExp = getStringAnswer(userAnswers, 'Q33a')
  const matchKinkExp = getStringAnswer(matchAnswers, 'Q33a')

  // Check if we have any data
  const hasRolesKinksData =
    userRoles.length > 0 || matchRoles.length > 0 ||
    userKinks.length > 0 || matchKinks.length > 0 ||
    userKinkExp || matchKinkExp

  if (!hasRolesKinksData) {
    return {
      key: 'rolesKinks',
      score: 0,
      weight: CHEMISTRY_WEIGHTS.rolesKinks,
      matched: false,
      reason: 'Roles and kinks not specified',
    }
  }

  let totalScore = 0
  let components = 0

  // Score roles (complementary matching)
  if (userRoles.length > 0 && matchRoles.length > 0) {
    const roleScore = scoreComplementaryRoles(userRoles, matchRoles)
    totalScore += roleScore
    components++
  }

  // overlap_soft for kinks (capped bonus per Rik spec 15.5)
  if (userKinks.length > 0 && matchKinks.length > 0) {
    const kinkScore = overlapSoft(userKinks, matchKinks)
    const overlapBonus = hasOverlap(userKinks, matchKinks) ? 10 : 0
    totalScore += Math.min(100, kinkScore + overlapBonus)
    components++
  }

  // Score kink experience level alignment
  if (userKinkExp && matchKinkExp) {
    const expScore = tierProximityScore(
      userKinkExp,
      matchKinkExp,
      KINK_EXPERIENCE_TIERS,
      3 // Similar experience levels preferred
    )
    totalScore += expScore
    components++
  }

  const finalScore = components > 0 ? Math.round(totalScore / components) : 0

  return {
    key: 'rolesKinks',
    score: finalScore,
    weight: CHEMISTRY_WEIGHTS.rolesKinks,
    matched: components > 0,
    reason: finalScore >= 70
      ? 'Great role and kink compatibility'
      : finalScore >= 50
        ? 'Compatible roles and interests'
        : 'Different role/kink preferences',
  }
}

/**
 * Score complementary sexual roles.
 * Dom + Sub = high, Switch + Anyone = high, Same role = lower
 */
function scoreComplementaryRoles(userRoles: string[], matchRoles: string[]): number {
  const userRolesNorm = userRoles.map(r => r.toLowerCase().trim())
  const matchRolesNorm = matchRoles.map(r => r.toLowerCase().trim())

  // Helper functions
  const isSwitch = (roles: string[]) =>
    roles.some(r => r.includes('switch') || r.includes('versatile') || r.includes('flexible'))
  const isDom = (roles: string[]) =>
    roles.some(r => r.includes('dom') || r.includes('top') || r.includes('dominant'))
  const isSub = (roles: string[]) =>
    roles.some(r => r.includes('sub') || r.includes('bottom') || r.includes('submissive'))

  const userSwitch = isSwitch(userRolesNorm)
  const matchSwitch = isSwitch(matchRolesNorm)
  const userDom = isDom(userRolesNorm)
  const matchDom = isDom(matchRolesNorm)
  const userSub = isSub(userRolesNorm)
  const matchSub = isSub(matchRolesNorm)

  // Switches are compatible with everyone
  if (userSwitch || matchSwitch) {
    return 90
  }

  // Complementary: Dom + Sub = great match
  if ((userDom && matchSub) || (userSub && matchDom)) {
    return 100
  }

  // Same role: Dom + Dom or Sub + Sub = lower compatibility
  if ((userDom && matchDom) || (userSub && matchSub)) {
    return 40
  }

  // Default for unclear roles
  return 60
}

/**
 * Score Frequency sub-component (20%)
 * Q25a: Preferred sexual frequency
 * Tier comparison for frequency alignment.
 */
function scoreFrequency(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userFrequency = getStringAnswer(userAnswers, 'Q25a')
  const matchFrequency = getStringAnswer(matchAnswers, 'Q25a')

  if (!userFrequency || !matchFrequency) {
    return {
      key: 'frequency',
      score: 0,
      weight: CHEMISTRY_WEIGHTS.frequency,
      matched: false,
      reason: 'Frequency preferences not specified',
    }
  }

  // Score frequency alignment using tier proximity
  const frequencyScore = tierProximityScore(
    userFrequency,
    matchFrequency,
    FREQUENCY_TIERS,
    3 // Tolerate 3 tier difference
  )

  return {
    key: 'frequency',
    score: frequencyScore,
    weight: CHEMISTRY_WEIGHTS.frequency,
    matched: true,
    reason: frequencyScore >= 70
      ? 'Well-aligned frequency preferences'
      : frequencyScore >= 50
        ? 'Compatible frequency expectations'
        : 'Different frequency needs',
  }
}

/**
 * Score Boundaries sub-component (10%)
 * Q28: Hard boundaries, Q29: Activities needing discussion
 * Check for conflicts, reward shared understanding of limits.
 */
function scoreBoundaries(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userBoundaries = getArrayAnswer(userAnswers, 'Q28')
  const matchBoundaries = getArrayAnswer(matchAnswers, 'Q28')
  const userDiscussion = getArrayAnswer(userAnswers, 'Q29')
  const matchDiscussion = getArrayAnswer(matchAnswers, 'Q29')

  // Check if we have any data
  const hasBoundaryData =
    userBoundaries.length > 0 || matchBoundaries.length > 0 ||
    userDiscussion.length > 0 || matchDiscussion.length > 0

  if (!hasBoundaryData) {
    return {
      key: 'boundaries',
      score: 0,
      weight: CHEMISTRY_WEIGHTS.boundaries,
      matched: false,
      reason: 'Boundaries not specified',
    }
  }

  let totalScore = 0
  let components = 0

  // Score boundary overlap (shared boundaries = mutual understanding)
  if (userBoundaries.length > 0 && matchBoundaries.length > 0) {
    const boundaryScore = jaccardSimilarity(userBoundaries, matchBoundaries)
    // Having some shared boundaries is positive (mutual understanding)
    const overlapBonus = hasOverlap(userBoundaries, matchBoundaries) ? 15 : 0
    totalScore += Math.min(100, boundaryScore + overlapBonus)
    components++
  } else if (userBoundaries.length > 0 || matchBoundaries.length > 0) {
    // Only one has boundaries - neutral score
    totalScore += 50
    components++
  }

  // Score discussion items overlap (things both want to talk about)
  if (userDiscussion.length > 0 && matchDiscussion.length > 0) {
    const discussionScore = jaccardSimilarity(userDiscussion, matchDiscussion)
    // Shared discussion items = good communication potential
    const overlapBonus = hasOverlap(userDiscussion, matchDiscussion) ? 20 : 0
    totalScore += Math.min(100, discussionScore + overlapBonus)
    components++
  }

  const finalScore = components > 0 ? Math.round(totalScore / components) : 0

  return {
    key: 'boundaries',
    score: finalScore,
    weight: CHEMISTRY_WEIGHTS.boundaries,
    matched: components > 0,
    reason: finalScore >= 60
      ? 'Good boundary alignment'
      : finalScore >= 40
        ? 'Some boundary understanding'
        : 'Different boundary approaches',
  }
}

/**
 * Score Physical Preferences sub-component (10%)
 * Q27: Self body type, Q27b: Preferred body types in partner
 * Cross-check: A's self-type against B's preferences, and vice versa.
 */
function scorePhysicalPreferences(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  // Q27 is multi-select but represents self body type — take first as primary
  const userSelfType = asSingle(userAnswers.Q27 as string | string[] | undefined)
  const matchSelfType = asSingle(matchAnswers.Q27 as string | string[] | undefined)
  const userPreferences = getArrayAnswer(userAnswers, 'Q27b')
  const matchPreferences = getArrayAnswer(matchAnswers, 'Q27b')

  // Need at least one direction of self-type + preferences to score
  const hasData =
    (userSelfType && matchPreferences.length > 0) ||
    (matchSelfType && userPreferences.length > 0)

  if (!hasData) {
    return {
      key: 'physicalPreferences',
      score: 0,
      weight: CHEMISTRY_WEIGHTS.physicalPreferences,
      matched: false,
      reason: 'Physical preferences not specified',
    }
  }

  // Check if A's self-type is in B's preferences (case-insensitive)
  const userInMatchPrefs = userSelfType && matchPreferences.length > 0
    ? matchPreferences.some(p => p.toLowerCase().trim() === userSelfType.toLowerCase().trim())
    : false

  // Check if B's self-type is in A's preferences
  const matchInUserPrefs = matchSelfType && userPreferences.length > 0
    ? userPreferences.some(p => p.toLowerCase().trim() === matchSelfType.toLowerCase().trim())
    : false

  let score: number
  if (userInMatchPrefs && matchInUserPrefs) {
    score = 100
  } else if (userInMatchPrefs || matchInUserPrefs) {
    score = 60
  } else {
    score = 20
  }

  return {
    key: 'physicalPreferences',
    score,
    weight: CHEMISTRY_WEIGHTS.physicalPreferences,
    matched: true,
    reason: score >= 80
      ? 'Mutual physical preference match'
      : score >= 50
        ? 'Partial physical preference match'
        : 'Different physical preferences',
  }
}

/**
 * Score Exploration sub-component (10%)
 * Q34: Exploration openness (slider 1-10), Q34a: Variety desire (slider 1-10)
 * Uses numeric proximity scoring instead of categorical tiers.
 */
function scoreExploration(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userExploration = getStringAnswer(userAnswers, 'Q34')
  const matchExploration = getStringAnswer(matchAnswers, 'Q34')
  const userVariety = getStringAnswer(userAnswers, 'Q34a')
  const matchVariety = getStringAnswer(matchAnswers, 'Q34a')

  let totalScore = 0
  let components = 0

  // Score Q34 exploration openness (numeric 1-10)
  if (userExploration && matchExploration) {
    const userVal = parseFloat(userExploration)
    const matchVal = parseFloat(matchExploration)
    if (!isNaN(userVal) && !isNaN(matchVal)) {
      totalScore += proximityScore(userVal, matchVal, 5)
      components++
    }
  }

  // Score Q34a variety desire (numeric 1-10)
  if (userVariety && matchVariety) {
    const userVal = parseFloat(userVariety)
    const matchVal = parseFloat(matchVariety)
    if (!isNaN(userVal) && !isNaN(matchVal)) {
      totalScore += proximityScore(userVal, matchVal, 5)
      components++
    }
  }

  if (components === 0) {
    return {
      key: 'exploration',
      score: 0,
      weight: CHEMISTRY_WEIGHTS.exploration,
      matched: false,
      reason: 'Exploration preferences not specified',
    }
  }

  const finalScore = Math.round(totalScore / components)

  return {
    key: 'exploration',
    score: finalScore,
    weight: CHEMISTRY_WEIGHTS.exploration,
    matched: true,
    reason: finalScore >= 70
      ? 'Well-aligned exploration desires'
      : finalScore >= 40
        ? 'Compatible exploration levels'
        : 'Different exploration preferences',
  }
}
