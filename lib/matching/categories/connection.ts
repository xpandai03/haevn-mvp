/**
 * HAEVN Matching Engine - Connection Style Fit Category
 *
 * Evaluates how people communicate, bond emotionally,
 * handle conflict, and relate interpersonally.
 *
 * Weight: 20% of overall score
 *
 * Sub-components:
 * - Attachment/Availability (40%): Q10, Q10a
 * - Communication/Conflict (30%): Q11, Q12, Q12a
 * - Emotional Patterns (20%): Q37, Q37a, Q38, Q38a
 * - Privacy/Visibility (10%): Q20, Q20b
 */

import type { NormalizedAnswers, CategoryScore, SubScore } from '../types'
import { CONNECTION_WEIGHTS } from '../utils/weights'
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
} from '../utils/scoring'
import {
  getArrayAnswer,
  getStringAnswer,
} from '../utils/normalizeAnswers'

// =============================================================================
// TIER ORDERINGS FOR CONNECTION QUESTIONS
// =============================================================================

/**
 * Conflict resolution style tiers
 */
const CONFLICT_TIERS = [
  'avoidant', 'avoid',
  'passive', 'accommodating',
  'compromising', 'moderate',
  'collaborative', 'direct',
  'competitive', 'confrontational',
] as const

/**
 * Emotional reactivity tiers (Q38)
 */
const REACTIVITY_TIERS = [
  'very_low', 'low',
  'moderate', 'medium',
  'high', 'very_high',
] as const

/**
 * Empathy level tiers (Q37)
 */
const EMPATHY_TIERS = [
  'very_low', 'low',
  'moderate', 'medium',
  'high', 'very_high',
] as const

// =============================================================================
// MAIN CONNECTION SCORER
// =============================================================================

/**
 * Calculate Connection Style Fit score between two partners.
 *
 * @param userAnswers - Normalized answers from User
 * @param matchAnswers - Normalized answers from Match
 * @returns CategoryScore for Connection Style Fit
 */
export function scoreConnection(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): CategoryScore {
  const subScores: SubScore[] = [
    scoreAttachment(userAnswers, matchAnswers),
    scoreCommunication(userAnswers, matchAnswers),
    scoreEmotional(userAnswers, matchAnswers),
    scorePrivacy(userAnswers, matchAnswers),
  ]

  const score = weightedAverage(subScores)
  const coverage = calculateCoverage(subScores)

  return {
    category: 'connection',
    score,
    weight: 20,
    subScores,
    coverage,
    included: true,
  }
}

// =============================================================================
// SUB-COMPONENT SCORERS
// =============================================================================

/**
 * Score Attachment sub-component (40%)
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
      weight: CONNECTION_WEIGHTS.attachment,
      matched: false,
      reason: 'Attachment style not specified',
    }
  }

  // Score attachment style proximity (adjacency-based)
  const attachmentScore = tierProximityScore(
    userAttachment,
    matchAttachment,
    ATTACHMENT_TIERS,
    3 // Max 3 tiers difference tolerated
  )

  // Check for secure attachment bonus
  const hasSecure =
    userAttachment.toLowerCase().includes('secure') ||
    matchAttachment.toLowerCase().includes('secure')
  const secureBonus = hasSecure ? 10 : 0

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
  const combinedScore = Math.round(attachmentScore * 0.6 + availabilityScore * 0.4)
  const finalScore = Math.min(100, combinedScore + secureBonus)

  // Check for extreme mismatch (e.g., avoidant + anxious)
  const isExtremeMismatch =
    (userAttachment.toLowerCase().includes('avoidant') &&
      matchAttachment.toLowerCase().includes('anxious')) ||
    (userAttachment.toLowerCase().includes('anxious') &&
      matchAttachment.toLowerCase().includes('avoidant'))

  return {
    key: 'attachment',
    score: isExtremeMismatch ? Math.round(finalScore * 0.7) : finalScore,
    weight: CONNECTION_WEIGHTS.attachment,
    matched: true,
    reason: isExtremeMismatch
      ? 'Challenging attachment pairing (avoidant/anxious)'
      : finalScore >= 70
        ? 'Compatible attachment styles'
        : 'Different attachment patterns',
  }
}

/**
 * Score Communication sub-component (30%)
 * Q11: Love languages, Q12: Conflict resolution, Q12a: Messaging pace
 * Many-to-many for love languages, tier for conflict and messaging.
 */
function scoreCommunication(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userLoveLanguages = getArrayAnswer(userAnswers, 'Q11')
  const matchLoveLanguages = getArrayAnswer(matchAnswers, 'Q11')
  const userConflict = getStringAnswer(userAnswers, 'Q12')
  const matchConflict = getStringAnswer(matchAnswers, 'Q12')
  const userMessaging = getStringAnswer(userAnswers, 'Q12a')
  const matchMessaging = getStringAnswer(matchAnswers, 'Q12a')

  // Check if we have any data
  const hasCommunicationData =
    userLoveLanguages.length > 0 || matchLoveLanguages.length > 0 ||
    userConflict || matchConflict ||
    userMessaging || matchMessaging

  if (!hasCommunicationData) {
    return {
      key: 'communication',
      score: 0,
      weight: CONNECTION_WEIGHTS.communication,
      matched: false,
      reason: 'Communication preferences not specified',
    }
  }

  let totalScore = 0
  let components = 0

  // Score love languages overlap
  if (userLoveLanguages.length > 0 && matchLoveLanguages.length > 0) {
    const loveScore = jaccardSimilarity(userLoveLanguages, matchLoveLanguages)
    // Bonus for any shared love language
    const overlapBonus = hasOverlap(userLoveLanguages, matchLoveLanguages) ? 25 : 0
    totalScore += Math.min(100, loveScore + overlapBonus)
    components++
  }

  // Score conflict resolution style proximity
  if (userConflict && matchConflict) {
    const conflictScore = tierProximityScore(
      userConflict,
      matchConflict,
      CONFLICT_TIERS,
      4 // Tolerate 4 tier difference
    )
    // Collaborative styles get a bonus when matched
    const collaborative =
      userConflict.toLowerCase().includes('collaborat') ||
      matchConflict.toLowerCase().includes('collaborat')
    const bonus = collaborative && conflictScore >= 50 ? 15 : 0
    totalScore += Math.min(100, conflictScore + bonus)
    components++
  }

  // Score messaging pace alignment
  if (userMessaging && matchMessaging) {
    const messagingScore = tierProximityScore(
      userMessaging,
      matchMessaging,
      MESSAGING_PACE_TIERS,
      2 // Must be within 2 tiers
    )
    totalScore += messagingScore
    components++
  }

  const finalScore = components > 0 ? Math.round(totalScore / components) : 0

  return {
    key: 'communication',
    score: finalScore,
    weight: CONNECTION_WEIGHTS.communication,
    matched: components > 0,
    reason: finalScore >= 70
      ? 'Strong communication alignment'
      : finalScore >= 50
        ? 'Compatible communication styles'
        : 'Different communication preferences',
  }
}

/**
 * Score Emotional sub-component (20%)
 * Q37, Q37a: Empathy and harmony, Q38, Q38a: Jealousy and reactivity
 * Tier comparison for emotional patterns.
 */
function scoreEmotional(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userEmpathy = getStringAnswer(userAnswers, 'Q37')
  const matchEmpathy = getStringAnswer(matchAnswers, 'Q37')
  const userHarmony = getStringAnswer(userAnswers, 'Q37a')
  const matchHarmony = getStringAnswer(matchAnswers, 'Q37a')
  const userJealousy = getStringAnswer(userAnswers, 'Q38')
  const matchJealousy = getStringAnswer(matchAnswers, 'Q38')
  const userReactivity = getStringAnswer(userAnswers, 'Q38a')
  const matchReactivity = getStringAnswer(matchAnswers, 'Q38a')

  // Check if we have any data
  const hasEmotionalData =
    userEmpathy || matchEmpathy ||
    userHarmony || matchHarmony ||
    userJealousy || matchJealousy ||
    userReactivity || matchReactivity

  if (!hasEmotionalData) {
    return {
      key: 'emotional',
      score: 0,
      weight: CONNECTION_WEIGHTS.emotional,
      matched: false,
      reason: 'Emotional patterns not specified',
    }
  }

  let totalScore = 0
  let components = 0

  // Score empathy alignment
  if (userEmpathy && matchEmpathy) {
    const empathyScore = tierProximityScore(
      userEmpathy,
      matchEmpathy,
      EMPATHY_TIERS,
      3
    )
    // High empathy bonus when both are high
    const bothHighEmpathy =
      (userEmpathy.toLowerCase().includes('high') ||
        userEmpathy.toLowerCase().includes('very_high')) &&
      (matchEmpathy.toLowerCase().includes('high') ||
        matchEmpathy.toLowerCase().includes('very_high'))
    totalScore += bothHighEmpathy ? Math.min(100, empathyScore + 15) : empathyScore
    components++
  }

  // Score harmony preference alignment
  if (userHarmony && matchHarmony) {
    const harmonyScore = tierProximityScore(
      userHarmony,
      matchHarmony,
      EMPATHY_TIERS, // Using same tier for harmony
      2
    )
    totalScore += harmonyScore
    components++
  }

  // Score jealousy level alignment
  if (userJealousy && matchJealousy) {
    const jealousyScore = tierProximityScore(
      userJealousy,
      matchJealousy,
      REACTIVITY_TIERS,
      2
    )
    // Both low jealousy is a bonus
    const bothLowJealousy =
      (userJealousy.toLowerCase().includes('low') ||
        userJealousy.toLowerCase().includes('very_low')) &&
      (matchJealousy.toLowerCase().includes('low') ||
        matchJealousy.toLowerCase().includes('very_low'))
    totalScore += bothLowJealousy ? Math.min(100, jealousyScore + 10) : jealousyScore
    components++
  }

  // Score reactivity alignment
  if (userReactivity && matchReactivity) {
    const reactivityScore = tierProximityScore(
      userReactivity,
      matchReactivity,
      REACTIVITY_TIERS,
      2
    )
    totalScore += reactivityScore
    components++
  }

  const finalScore = components > 0 ? Math.round(totalScore / components) : 0

  return {
    key: 'emotional',
    score: finalScore,
    weight: CONNECTION_WEIGHTS.emotional,
    matched: components > 0,
    reason: finalScore >= 70
      ? 'Well-matched emotional styles'
      : finalScore >= 50
        ? 'Compatible emotional patterns'
        : 'Different emotional approaches',
  }
}

/**
 * Score Privacy sub-component (10%)
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
      weight: CONNECTION_WEIGHTS.privacy,
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

  // Check for extreme mismatch (very_private + very_open)
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
    weight: CONNECTION_WEIGHTS.privacy,
    matched: true,
    reason: isExtremeMismatch
      ? 'Very different privacy needs'
      : finalScore >= 60
        ? 'Compatible privacy preferences'
        : 'Different privacy levels',
  }
}
