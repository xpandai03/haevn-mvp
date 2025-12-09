/**
 * HAEVN Matching Engine - Intent Fit Category
 *
 * Measures whether User and Match want the same type of connection,
 * timing, exclusivity expectations, and relationship style.
 *
 * Weight: 30% of overall score
 *
 * Sub-components:
 * - Goals (30%): Q9, Q9a - Connection goals, must overlap
 * - Style (20%): Q6 - Relationship style, ENM matching
 * - Exclusivity (15%): Q7, Q8, Q25 - Tier logic comparison
 * - Attachment (15%): Q10, Q10a - Adjacency scoring
 * - Timing (10%): Q15, Q16, Q16a - Match windows and capacity
 * - Privacy (5%): Q20, Q20b - Avoid extreme mismatch
 * - HAEVN Use (5%): Q21 - Must overlap on purpose
 */

import type { NormalizedAnswers, CategoryScore, SubScore } from '../types'
import { INTENT_WEIGHTS } from '../utils/weights'
import {
  hasOverlap,
  jaccardSimilarity,
  tierProximityScore,
  isWithinTiers,
  weightedAverage,
  calculateCoverage,
  ATTACHMENT_TIERS,
  AVAILABILITY_TIERS,
  MESSAGING_PACE_TIERS,
  PRIVACY_TIERS,
  VISIBILITY_TIERS,
  EXCLUSIVITY_TIERS,
  TIME_AVAILABILITY_TIERS,
  CHEMISTRY_IMPORTANCE_TIERS,
} from '../utils/scoring'
import {
  bothAnswered,
  getArrayAnswer,
  getStringAnswer,
} from '../utils/normalizeAnswers'

// =============================================================================
// MAIN INTENT SCORER
// =============================================================================

/**
 * Calculate Intent Fit score between two partners.
 *
 * @param userAnswers - Normalized answers from User
 * @param matchAnswers - Normalized answers from Match
 * @returns CategoryScore for Intent Fit
 */
export function scoreIntent(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): CategoryScore {
  const subScores: SubScore[] = [
    scoreGoals(userAnswers, matchAnswers),
    scoreStyle(userAnswers, matchAnswers),
    scoreExclusivity(userAnswers, matchAnswers),
    scoreAttachment(userAnswers, matchAnswers),
    scoreTiming(userAnswers, matchAnswers),
    scorePrivacy(userAnswers, matchAnswers),
    scoreHaevnUse(userAnswers, matchAnswers),
  ]

  const score = weightedAverage(subScores)
  const coverage = calculateCoverage(subScores)

  return {
    category: 'intent',
    score,
    weight: 30,
    subScores,
    coverage,
    included: true, // Intent is always included
  }
}

// =============================================================================
// SUB-COMPONENT SCORERS
// =============================================================================

/**
 * Score Goals sub-component (30%)
 * Q9: Connection goals, Q9a: Sub-goals
 * Must have at least one overlapping intention.
 */
function scoreGoals(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userGoals = getArrayAnswer(userAnswers, 'Q9')
  const matchGoals = getArrayAnswer(matchAnswers, 'Q9')
  const userSubGoals = getArrayAnswer(userAnswers, 'Q9a')
  const matchSubGoals = getArrayAnswer(matchAnswers, 'Q9a')

  // Check if both have answered Q9
  if (userGoals.length === 0 || matchGoals.length === 0) {
    return {
      key: 'goals',
      score: 0,
      weight: INTENT_WEIGHTS.goals,
      matched: false,
      reason: 'One or both partners have not specified connection goals',
    }
  }

  // Must have at least one overlapping goal
  const goalsOverlap = hasOverlap(userGoals, matchGoals)

  if (!goalsOverlap) {
    return {
      key: 'goals',
      score: 20, // Low score for no overlap, but not zero (might still be compatible)
      weight: INTENT_WEIGHTS.goals,
      matched: true,
      reason: 'No overlap in primary connection goals',
    }
  }

  // Calculate Jaccard similarity for main goals
  const goalsScore = jaccardSimilarity(userGoals, matchGoals)

  // Bonus for sub-goals overlap (if both answered)
  let subGoalsBonus = 0
  if (userSubGoals.length > 0 && matchSubGoals.length > 0) {
    const subGoalsScore = jaccardSimilarity(userSubGoals, matchSubGoals)
    subGoalsBonus = subGoalsScore * 0.2 // Up to 20% bonus
  }

  const finalScore = Math.min(100, Math.round(goalsScore + subGoalsBonus))

  return {
    key: 'goals',
    score: finalScore,
    weight: INTENT_WEIGHTS.goals,
    matched: true,
    reason: goalsOverlap
      ? `Shared goals: ${finalScore}% alignment`
      : 'Different primary goals',
  }
}

/**
 * Score Style sub-component (20%)
 * Q6: Relationship style - ENM type preferences
 * Many-to-many flexible matching.
 */
function scoreStyle(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userStyle = getArrayAnswer(userAnswers, 'Q6')
  const matchStyle = getArrayAnswer(matchAnswers, 'Q6')

  if (userStyle.length === 0 || matchStyle.length === 0) {
    return {
      key: 'style',
      score: 0,
      weight: INTENT_WEIGHTS.style,
      matched: false,
      reason: 'One or both partners have not specified relationship style',
    }
  }

  // Calculate Jaccard similarity
  const styleScore = jaccardSimilarity(userStyle, matchStyle)

  // Bonus for having any overlap (flexible ENM matching)
  const hasStyleOverlap = hasOverlap(userStyle, matchStyle)
  const overlapBonus = hasStyleOverlap ? 20 : 0

  const finalScore = Math.min(100, styleScore + overlapBonus)

  return {
    key: 'style',
    score: finalScore,
    weight: INTENT_WEIGHTS.style,
    matched: true,
    reason: hasStyleOverlap
      ? `Compatible relationship styles: ${finalScore}%`
      : 'Different relationship style preferences',
  }
}

/**
 * Score Exclusivity sub-component (15%)
 * Q7, Q8: Exclusivity level, Q25: Chemistry importance
 * Compare using tier logic.
 */
function scoreExclusivity(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userExclusivity = getStringAnswer(userAnswers, 'Q7') || getStringAnswer(userAnswers, 'Q8')
  const matchExclusivity = getStringAnswer(matchAnswers, 'Q7') || getStringAnswer(matchAnswers, 'Q8')

  if (!userExclusivity || !matchExclusivity) {
    return {
      key: 'exclusivity',
      score: 0,
      weight: INTENT_WEIGHTS.exclusivity,
      matched: false,
      reason: 'One or both partners have not specified exclusivity preferences',
    }
  }

  // Use tier proximity scoring
  const exclusivityScore = tierProximityScore(
    userExclusivity,
    matchExclusivity,
    EXCLUSIVITY_TIERS
  )

  // Also factor in chemistry importance (Q25) if both answered
  let chemistryBonus = 0
  const userChemistry = getStringAnswer(userAnswers, 'Q25')
  const matchChemistry = getStringAnswer(matchAnswers, 'Q25')

  if (userChemistry && matchChemistry) {
    const chemistryScore = tierProximityScore(
      userChemistry,
      matchChemistry,
      CHEMISTRY_IMPORTANCE_TIERS
    )
    chemistryBonus = chemistryScore * 0.15 // Up to 15% bonus
  }

  const finalScore = Math.min(100, Math.round(exclusivityScore + chemistryBonus))

  return {
    key: 'exclusivity',
    score: finalScore,
    weight: INTENT_WEIGHTS.exclusivity,
    matched: true,
    reason: finalScore >= 70
      ? 'Well-aligned exclusivity expectations'
      : 'Different exclusivity preferences',
  }
}

/**
 * Score Attachment sub-component (15%)
 * Q10: Attachment style, Q10a: Emotional availability
 * Use adjacency scoring - nearby styles score higher.
 */
function scoreAttachment(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userAttachment = getStringAnswer(userAnswers, 'Q10')
  const matchAttachment = getStringAnswer(matchAnswers, 'Q10')
  const userAvailability = getStringAnswer(userAnswers, 'Q10a')
  const matchAvailability = getStringAnswer(matchAnswers, 'Q10a')

  // Need at least attachment style from both
  if (!userAttachment || !matchAttachment) {
    return {
      key: 'attachment',
      score: 0,
      weight: INTENT_WEIGHTS.attachment,
      matched: false,
      reason: 'One or both partners have not specified attachment style',
    }
  }

  // Score attachment style proximity
  const attachmentScore = tierProximityScore(
    userAttachment,
    matchAttachment,
    ATTACHMENT_TIERS,
    3 // Max 3 tiers difference tolerated
  )

  // Score availability proximity if both answered
  let availabilityScore = 50 // Default neutral
  if (userAvailability && matchAvailability) {
    availabilityScore = tierProximityScore(
      userAvailability,
      matchAvailability,
      AVAILABILITY_TIERS,
      2 // Must be within 2 tiers
    )
  }

  // Combine: 60% attachment, 40% availability
  const finalScore = Math.round(attachmentScore * 0.6 + availabilityScore * 0.4)

  return {
    key: 'attachment',
    score: finalScore,
    weight: INTENT_WEIGHTS.attachment,
    matched: true,
    reason: finalScore >= 70
      ? 'Compatible attachment styles'
      : 'Different attachment patterns',
  }
}

/**
 * Score Timing sub-component (10%)
 * Q15: Time availability, Q16: Preferred days/times, Q16a: Flexibility
 * Match windows and availability levels.
 */
function scoreTiming(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userAvailability = getStringAnswer(userAnswers, 'Q15')
  const matchAvailability = getStringAnswer(matchAnswers, 'Q15')
  const userSchedule = getArrayAnswer(userAnswers, 'Q16')
  const matchSchedule = getArrayAnswer(matchAnswers, 'Q16')
  const userFlexibility = getStringAnswer(userAnswers, 'Q16a')
  const matchFlexibility = getStringAnswer(matchAnswers, 'Q16a')

  // Check if we have enough data
  const hasAvailability = userAvailability && matchAvailability
  const hasSchedule = userSchedule.length > 0 && matchSchedule.length > 0

  if (!hasAvailability && !hasSchedule) {
    return {
      key: 'timing',
      score: 0,
      weight: INTENT_WEIGHTS.timing,
      matched: false,
      reason: 'Timing preferences not specified',
    }
  }

  let totalScore = 0
  let components = 0

  // Score availability tier
  if (hasAvailability) {
    const availScore = tierProximityScore(
      userAvailability,
      matchAvailability,
      TIME_AVAILABILITY_TIERS
    )
    totalScore += availScore
    components++
  }

  // Score schedule overlap
  if (hasSchedule) {
    const scheduleScore = jaccardSimilarity(userSchedule, matchSchedule)
    totalScore += scheduleScore
    components++
  }

  // Bonus for flexibility alignment
  if (userFlexibility && matchFlexibility) {
    const flexScore = tierProximityScore(
      userFlexibility,
      matchFlexibility,
      TIME_AVAILABILITY_TIERS
    )
    totalScore += flexScore * 0.5 // Half weight for flexibility
    components += 0.5
  }

  const finalScore = components > 0 ? Math.round(totalScore / components) : 0

  return {
    key: 'timing',
    score: finalScore,
    weight: INTENT_WEIGHTS.timing,
    matched: components > 0,
    reason: finalScore >= 60
      ? 'Compatible schedules'
      : 'Different availability patterns',
  }
}

/**
 * Score Privacy sub-component (5%)
 * Q20: Privacy level, Q20b: Visibility comfort
 * Avoid extreme high-low mismatch.
 */
function scorePrivacy(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userPrivacy = getStringAnswer(userAnswers, 'Q20')
  const matchPrivacy = getStringAnswer(matchAnswers, 'Q20')
  const userVisibility = getStringAnswer(userAnswers, 'Q20b')
  const matchVisibility = getStringAnswer(matchAnswers, 'Q20b')

  if (!userPrivacy || !matchPrivacy) {
    return {
      key: 'privacy',
      score: 0,
      weight: INTENT_WEIGHTS.privacy,
      matched: false,
      reason: 'Privacy preferences not specified',
    }
  }

  // Score privacy level proximity
  const privacyScore = tierProximityScore(
    userPrivacy,
    matchPrivacy,
    PRIVACY_TIERS
  )

  // Check for extreme mismatch
  const isExtremeMismatch = !isWithinTiers(userPrivacy, matchPrivacy, PRIVACY_TIERS, 2)

  // Score visibility if both answered
  let visibilityScore = 50 // Default neutral
  if (userVisibility && matchVisibility) {
    visibilityScore = tierProximityScore(
      userVisibility,
      matchVisibility,
      VISIBILITY_TIERS
    )
  }

  // Combine: 70% privacy, 30% visibility
  let finalScore = Math.round(privacyScore * 0.7 + visibilityScore * 0.3)

  // Apply penalty for extreme mismatch
  if (isExtremeMismatch) {
    finalScore = Math.round(finalScore * 0.6) // 40% penalty
  }

  return {
    key: 'privacy',
    score: finalScore,
    weight: INTENT_WEIGHTS.privacy,
    matched: true,
    reason: isExtremeMismatch
      ? 'Very different privacy needs'
      : finalScore >= 60
        ? 'Compatible privacy preferences'
        : 'Different privacy levels',
  }
}

/**
 * Score HAEVN Use sub-component (5%)
 * Q21: Purpose for using HAEVN
 * Must overlap on at least one purpose.
 */
function scoreHaevnUse(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userPurposes = getArrayAnswer(userAnswers, 'Q21')
  const matchPurposes = getArrayAnswer(matchAnswers, 'Q21')

  if (userPurposes.length === 0 || matchPurposes.length === 0) {
    return {
      key: 'haevnUse',
      score: 0,
      weight: INTENT_WEIGHTS.haevnUse,
      matched: false,
      reason: 'HAEVN usage purposes not specified',
    }
  }

  // Must have at least one overlapping purpose
  const purposesOverlap = hasOverlap(userPurposes, matchPurposes)

  if (!purposesOverlap) {
    return {
      key: 'haevnUse',
      score: 30, // Low score but not zero
      weight: INTENT_WEIGHTS.haevnUse,
      matched: true,
      reason: 'Using HAEVN for different purposes',
    }
  }

  // Calculate Jaccard similarity
  const purposeScore = jaccardSimilarity(userPurposes, matchPurposes)

  // Bonus for overlap (at least some shared purpose)
  const finalScore = Math.min(100, purposeScore + 20)

  return {
    key: 'haevnUse',
    score: finalScore,
    weight: INTENT_WEIGHTS.haevnUse,
    matched: true,
    reason: `Shared HAEVN purposes: ${finalScore}% alignment`,
  }
}
