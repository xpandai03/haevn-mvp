/**
 * HAEVN Matching Engine - Sexual Chemistry Category
 *
 * Evaluates turn-ons, erotic alignment, boundaries,
 * preferred roles, and sexual energy.
 *
 * Weight: 15% of overall score
 *
 * Sub-components:
 * - Erotic Profile Alignment (35%): Q23, Q24, Q25
 * - Roles/Kinks (35%): Q26, Q33, Q33a
 * - Frequency/Chemistry Priorities (20%): Q25a
 * - Boundaries (10%): Q28, Q29
 */

import type { NormalizedAnswers, CategoryScore, SubScore } from '../types'
import { CHEMISTRY_WEIGHTS } from '../utils/weights'
import {
  hasOverlap,
  jaccardSimilarity,
  tierProximityScore,
  weightedAverage,
  calculateCoverage,
} from '../utils/scoring'
import {
  getArrayAnswer,
  getStringAnswer,
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

/**
 * Exploration openness tiers (Q34)
 */
const EXPLORATION_TIERS = [
  'not_open', 'very_hesitant',
  'somewhat_hesitant', 'neutral',
  'somewhat_open', 'open',
  'very_open', 'extremely_open',
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
  const subScores: SubScore[] = [
    scoreEroticProfile(userAnswers, matchAnswers),
    scoreRolesKinks(userAnswers, matchAnswers),
    scoreFrequency(userAnswers, matchAnswers),
    scoreBoundaries(userAnswers, matchAnswers),
  ]

  const score = weightedAverage(subScores)
  const coverage = calculateCoverage(subScores)

  return {
    category: 'chemistry',
    score,
    weight: 15,
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

  // Score erotic styles overlap
  if (userStyles.length > 0 && matchStyles.length > 0) {
    const styleScore = jaccardSimilarity(userStyles, matchStyles)
    // Bonus for any shared style
    const overlapBonus = hasOverlap(userStyles, matchStyles) ? 25 : 0
    totalScore += Math.min(100, styleScore + overlapBonus)
    components++
  }

  // Score experiences/interests overlap
  if (userExperiences.length > 0 && matchExperiences.length > 0) {
    const expScore = jaccardSimilarity(userExperiences, matchExperiences)
    // Bonus for shared experiences
    const overlapBonus = hasOverlap(userExperiences, matchExperiences) ? 20 : 0
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

  // Score kinks overlap
  if (userKinks.length > 0 && matchKinks.length > 0) {
    const kinkScore = jaccardSimilarity(userKinks, matchKinks)
    // Strong bonus for shared kinks
    const overlapBonus = hasOverlap(userKinks, matchKinks) ? 30 : 0
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
