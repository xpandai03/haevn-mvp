/**
 * HAEVN Matching Engine - Global Constraints
 *
 * Checks for hard blockers that prevent a match entirely,
 * regardless of category scores.
 *
 * Constraints:
 * 1. Language (Q13a) - If required flag set and no overlap, BLOCK
 * 2. Mutual Interest (Q6b) - Must be mutually inclusive
 * 3. Hard Boundaries (Q28) - User desires can't conflict with Match nos
 */

import type { NormalizedAnswers, ConstraintResult } from '../types'
import { asArray } from './normalizeAnswers'

// =============================================================================
// CONSTRAINT VALUE MAPPINGS
// =============================================================================

/**
 * Q6b values that indicate openness to solos
 */
const OPEN_TO_SOLO = [
  'solo',
  'solos',
  'individuals',
  'single',
  'singles',
  'solo_individuals',
  'open_to_solo',
  'open_to_individuals',
] as const

/**
 * Q6b values that indicate openness to couples
 */
const OPEN_TO_COUPLE = [
  'couple',
  'couples',
  'pairs',
  'partnered',
  'open_to_couples',
  'open_to_pairs',
] as const

/**
 * Activities/interests that can conflict with boundaries.
 * Maps desire questions to boundary categories.
 */
const DESIRE_TO_BOUNDARY_MAP: Record<string, string[]> = {
  // Kinks (Q33) that might conflict with boundaries (Q28)
  bdsm: ['bdsm', 'kink', 'power_exchange'],
  bondage: ['bondage', 'restraints', 'bdsm'],
  dom_sub: ['dom_sub', 'power_exchange', 'bdsm'],
  group: ['group', 'threesome', 'moresome', 'group_sex'],
  public: ['public', 'exhibitionism', 'voyeurism'],
  anal: ['anal', 'anal_play'],
  // Add more mappings as needed based on actual survey values
}

// =============================================================================
// MAIN CONSTRAINT CHECKER
// =============================================================================

/**
 * Check all global constraints between two partners.
 *
 * @param userAnswers - Normalized answers from User
 * @param matchAnswers - Normalized answers from Match
 * @param userIsCouple - Whether User is part of a couple
 * @param matchIsCouple - Whether Match is part of a couple
 * @returns ConstraintResult indicating if match should proceed
 */
export function checkConstraints(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers,
  userIsCouple: boolean = false,
  matchIsCouple: boolean = false
): ConstraintResult {
  // 1. Check language constraint (most critical)
  const languageResult = checkLanguageConstraint(userAnswers, matchAnswers)
  if (!languageResult.passed) {
    return languageResult
  }

  // 2. Check mutual interest constraint (solo/couple compatibility)
  const mutualResult = checkMutualInterestConstraint(
    userAnswers,
    matchAnswers,
    userIsCouple,
    matchIsCouple
  )
  if (!mutualResult.passed) {
    return mutualResult
  }

  // 3. Check hard boundaries constraint
  const boundariesResult = checkBoundariesConstraint(userAnswers, matchAnswers)
  if (!boundariesResult.passed) {
    return boundariesResult
  }

  // Also check reverse - User's boundaries vs Match's desires
  const reverseBoundariesResult = checkBoundariesConstraint(matchAnswers, userAnswers)
  if (!reverseBoundariesResult.passed) {
    return {
      ...reverseBoundariesResult,
      reason: reverseBoundariesResult.reason?.replace('Match', 'User') || 'Boundary conflict',
    }
  }

  return { passed: true }
}

// =============================================================================
// LANGUAGE CONSTRAINT
// =============================================================================

/**
 * Check language compatibility constraint.
 *
 * If either party marks language as required (Q13a_required = true)
 * and there's no overlap in languages spoken, match is blocked.
 */
export function checkLanguageConstraint(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): ConstraintResult {
  const userLanguages = asArray(userAnswers.Q13a)
  const matchLanguages = asArray(matchAnswers.Q13a)

  // If neither has answered, no constraint to check
  if (userLanguages.length === 0 || matchLanguages.length === 0) {
    return { passed: true }
  }

  // If either requires language match
  const languageRequired = userAnswers.Q13a_required || matchAnswers.Q13a_required

  if (languageRequired) {
    // Check for overlap (case-insensitive)
    const overlap = userLanguages.filter(lang =>
      matchLanguages.some(ml => ml.toLowerCase().trim() === lang.toLowerCase().trim())
    )

    if (overlap.length === 0) {
      return {
        passed: false,
        blockedBy: 'language',
        reason: `No common language. User speaks: ${userLanguages.join(', ')}. Match speaks: ${matchLanguages.join(', ')}.`,
      }
    }
  }

  return { passed: true }
}

// =============================================================================
// MUTUAL INTEREST CONSTRAINT
// =============================================================================

/**
 * Check mutual interest constraint.
 *
 * Q6b: Who they want to meet (solo/couple)
 * Must be mutually inclusive - if User is a couple, Match must be open to couples.
 */
export function checkMutualInterestConstraint(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers,
  userIsCouple: boolean,
  matchIsCouple: boolean
): ConstraintResult {
  const userWantsToMeet = asArray(userAnswers.Q6b).map(v => v.toLowerCase().trim())
  const matchWantsToMeet = asArray(matchAnswers.Q6b).map(v => v.toLowerCase().trim())

  // If either hasn't answered, can't enforce constraint - allow match
  if (userWantsToMeet.length === 0 || matchWantsToMeet.length === 0) {
    return { passed: true }
  }

  // Check if Match is open to User's type
  if (userIsCouple) {
    // User is a couple - Match must be open to couples
    const matchOpenToCouples = matchWantsToMeet.some(v =>
      OPEN_TO_COUPLE.some(c => v.includes(c.toLowerCase()))
    )

    if (!matchOpenToCouples) {
      return {
        passed: false,
        blockedBy: 'mutual_interest',
        reason: 'Match is not open to meeting couples',
      }
    }
  } else {
    // User is solo - Match must be open to solos
    const matchOpenToSolos = matchWantsToMeet.some(v =>
      OPEN_TO_SOLO.some(s => v.includes(s.toLowerCase()))
    )

    if (!matchOpenToSolos) {
      return {
        passed: false,
        blockedBy: 'mutual_interest',
        reason: 'Match is not open to meeting individuals',
      }
    }
  }

  // Check reverse: User must be open to Match's type
  if (matchIsCouple) {
    // Match is a couple - User must be open to couples
    const userOpenToCouples = userWantsToMeet.some(v =>
      OPEN_TO_COUPLE.some(c => v.includes(c.toLowerCase()))
    )

    if (!userOpenToCouples) {
      return {
        passed: false,
        blockedBy: 'mutual_interest',
        reason: 'User is not open to meeting couples',
      }
    }
  } else {
    // Match is solo - User must be open to solos
    const userOpenToSolos = userWantsToMeet.some(v =>
      OPEN_TO_SOLO.some(s => v.includes(s.toLowerCase()))
    )

    if (!userOpenToSolos) {
      return {
        passed: false,
        blockedBy: 'mutual_interest',
        reason: 'User is not open to meeting individuals',
      }
    }
  }

  return { passed: true }
}

// =============================================================================
// HARD BOUNDARIES CONSTRAINT
// =============================================================================

/**
 * Check hard boundaries constraint.
 *
 * Q28: Hard boundaries (absolute nos)
 * If User's desires (from Q33 kinks, Q23 erotic styles, etc.)
 * conflict with Match's hard boundaries, block the match.
 */
export function checkBoundariesConstraint(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): ConstraintResult {
  const matchBoundaries = asArray(matchAnswers.Q28).map(b => b.toLowerCase().trim())

  // If Match has no hard boundaries listed, no constraint
  if (matchBoundaries.length === 0) {
    return { passed: true }
  }

  // Collect User's desires from relevant questions
  const userDesires: string[] = [
    ...asArray(userAnswers.Q33),  // Kinks
    ...asArray(userAnswers.Q23),  // Erotic styles
    ...asArray(userAnswers.Q24),  // Experiences/interests
    ...asArray(userAnswers.Q29),  // Activities needing discussion
  ].map(d => d.toLowerCase().trim())

  // Check if any User desire conflicts with Match boundary
  for (const desire of userDesires) {
    // Direct match check
    if (matchBoundaries.includes(desire)) {
      return {
        passed: false,
        blockedBy: 'boundaries',
        reason: `User's interest "${desire}" conflicts with Match's hard boundary`,
      }
    }

    // Check mapped categories
    const mappedBoundaries = DESIRE_TO_BOUNDARY_MAP[desire] || []
    for (const mapped of mappedBoundaries) {
      if (matchBoundaries.some(b => b.includes(mapped) || mapped.includes(b))) {
        return {
          passed: false,
          blockedBy: 'boundaries',
          reason: `User's interest in "${desire}" conflicts with Match's boundary on "${mapped}"`,
        }
      }
    }
  }

  return { passed: true }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a specific constraint passes.
 * Useful for debugging or selective constraint checking.
 */
export function checkSingleConstraint(
  constraintType: 'language' | 'mutual_interest' | 'boundaries',
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers,
  userIsCouple: boolean = false,
  matchIsCouple: boolean = false
): ConstraintResult {
  switch (constraintType) {
    case 'language':
      return checkLanguageConstraint(userAnswers, matchAnswers)
    case 'mutual_interest':
      return checkMutualInterestConstraint(userAnswers, matchAnswers, userIsCouple, matchIsCouple)
    case 'boundaries':
      return checkBoundariesConstraint(userAnswers, matchAnswers)
    default:
      return { passed: true }
  }
}

/**
 * Get a summary of all constraint check results.
 * Useful for debugging.
 */
export function getConstraintSummary(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers,
  userIsCouple: boolean = false,
  matchIsCouple: boolean = false
): Record<string, ConstraintResult> {
  return {
    language: checkLanguageConstraint(userAnswers, matchAnswers),
    mutual_interest: checkMutualInterestConstraint(userAnswers, matchAnswers, userIsCouple, matchIsCouple),
    boundaries: checkBoundariesConstraint(userAnswers, matchAnswers),
    boundaries_reverse: checkBoundariesConstraint(matchAnswers, userAnswers),
  }
}
