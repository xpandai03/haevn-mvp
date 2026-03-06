/**
 * HAEVN Matching Engine - Global Constraints
 *
 * Checks for hard blockers that prevent a match entirely,
 * regardless of category scores.
 *
 * Constraints (executed in order):
 * 1. Core Intent (Q9) - Must share at least one connection goal
 * 2. Language (Q13a) - If required flag set and no overlap, BLOCK
 * 3. Mutual Interest (Q6b) - Must be mutually inclusive
 * 4. Couple Permissions (Q6d) - Couple connection rules must be compatible
 * 5. Age Range - Mutual age preferences (partial: awaiting preference fields)
 * 6. Distance Cap - Geographic proximity (partial: awaiting distance infra)
 * 7. Safer-Sex (Q30, Q30a) - Extreme tier mismatch or item conflicts, BLOCK
 * 8. Health (Q31) - Testing/disclosure conflicts, BLOCK
 * 9. Hard Boundaries (Q28) - User desires can't conflict with Match nos
 */

import type { NormalizedAnswers, ConstraintResult } from '../types'
import { asArray, asSingle } from './normalizeAnswers'

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
// SAFER-SEX TIER ORDERING (for Q30 gate)
// =============================================================================

const SAFER_SEX_GATE_TIERS = [
  'always', 'very_strict',
  'usually', 'mostly',
  'sometimes', 'flexible',
  'rarely', 'seldom',
  'never', 'not_applicable',
] as const

const SAFER_SEX_CONFLICT_PAIRS: [string, string][] = [
  ['fluid_bonding', 'no_fluid_bonding'],
  ['barriers_always', 'no_barriers'],
  ['barriers_required', 'no_barriers'],
  ['condoms_required', 'no_condoms'],
  ['condoms_always', 'no_condoms'],
]

const MAX_SAFER_SEX_TIER_DISTANCE = 6

// =============================================================================
// HEALTH CONFLICT PAIRS (for Q31 gate)
// =============================================================================

const HEALTH_CONFLICT_PAIRS: [string, string][] = [
  ['requires_testing', 'no_testing'],
  ['requires_testing', 'refuses_testing'],
  ['regular_testing', 'no_testing'],
  ['regular_testing', 'refuses_testing'],
  ['sti_disclosure_required', 'no_disclosure'],
  ['disclosure_required', 'no_disclosure'],
]

// =============================================================================
// COUPLE PERMISSION VALUES (for Q6d gate)
// =============================================================================

const COUPLE_ONLY_VALUES = [
  'couple_only', 'couples_only', 'together_only', 'joint_only',
] as const

// =============================================================================
// MAIN CONSTRAINT CHECKER
// =============================================================================

/**
 * Check all global constraints between two partners.
 *
 * Gate ordering: most fundamental checks first, then progressively specific.
 * If any gate fails, scoring does NOT proceed.
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
  // 1. CORE_INTENT gate — must share at least one connection goal
  const coreIntentResult = checkCoreIntentConstraint(userAnswers, matchAnswers)
  if (!coreIntentResult.passed) return coreIntentResult

  // 2. Language compatibility
  const languageResult = checkLanguageConstraint(userAnswers, matchAnswers)
  if (!languageResult.passed) return languageResult

  // 3. Mutual interest (solo/couple compatibility)
  const mutualResult = checkMutualInterestConstraint(
    userAnswers, matchAnswers, userIsCouple, matchIsCouple
  )
  if (!mutualResult.passed) return mutualResult

  // 4. Couple permissions (Q6d)
  const coupleResult = checkCouplePermissionsConstraint(
    userAnswers, matchAnswers, userIsCouple, matchIsCouple
  )
  if (!coupleResult.passed) return coupleResult

  // 5. Age range (partial — preference fields not yet in survey schema)
  const ageResult = checkAgeRangeConstraint(userAnswers, matchAnswers)
  if (!ageResult.passed) return ageResult

  // 6. Distance cap (partial — requires geolocation infrastructure)
  const distanceResult = checkDistanceConstraint(userAnswers, matchAnswers)
  if (!distanceResult.passed) return distanceResult

  // 7. Safer-sex compatibility (Q30, Q30a)
  const saferSexResult = checkSaferSexConstraint(userAnswers, matchAnswers)
  if (!saferSexResult.passed) return saferSexResult

  // 8. Health compatibility (Q31)
  const healthResult = checkHealthConstraint(userAnswers, matchAnswers)
  if (!healthResult.passed) return healthResult

  // 9. Hard boundaries (Q28) — both directions
  const boundariesResult = checkBoundariesConstraint(userAnswers, matchAnswers)
  if (!boundariesResult.passed) return boundariesResult

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
// CORE INTENT CONSTRAINT
// =============================================================================

/**
 * Check core intent constraint.
 *
 * Q9: Connection goals — both parties must share at least one overlapping
 * connection goal. Without shared intent the match is fundamentally
 * incompatible (e.g., LONG_TERM vs FWB).
 */
export function checkCoreIntentConstraint(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): ConstraintResult {
  const userIntents = asArray(userAnswers.Q9)
  const matchIntents = asArray(matchAnswers.Q9)

  if (userIntents.length === 0 || matchIntents.length === 0) {
    return { passed: true }
  }

  const userNorm = userIntents.map(i => i.toLowerCase().trim())
  const matchNorm = matchIntents.map(i => i.toLowerCase().trim())
  const hasOverlap = userNorm.some(u => matchNorm.includes(u))

  if (!hasOverlap) {
    return {
      passed: false,
      blockedBy: 'core_intent',
      reason: `No shared connection intent. User: ${userIntents.join(', ')}. Match: ${matchIntents.join(', ')}.`,
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
// COUPLE PERMISSIONS CONSTRAINT
// =============================================================================

/**
 * Check couple permissions constraint.
 *
 * Q6d: Couple permissions — if a couple has restrictive permissions
 * (e.g., "couple_only") and the other party doesn't match, block.
 */
export function checkCouplePermissionsConstraint(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers,
  userIsCouple: boolean,
  matchIsCouple: boolean
): ConstraintResult {
  if (!userIsCouple && !matchIsCouple) {
    return { passed: true }
  }

  if (userIsCouple) {
    const result = checkOneSideCouplePerms(userAnswers, matchIsCouple, 'User')
    if (!result.passed) return result
  }

  if (matchIsCouple) {
    const result = checkOneSideCouplePerms(matchAnswers, userIsCouple, 'Match')
    if (!result.passed) return result
  }

  return { passed: true }
}

function checkOneSideCouplePerms(
  coupleAnswers: NormalizedAnswers,
  otherIsCouple: boolean,
  label: string
): ConstraintResult {
  const permissions = asSingle(coupleAnswers.Q6d as string | string[] | undefined)
  if (!permissions) return { passed: true }

  const permNorm = permissions.toLowerCase().trim()

  if (COUPLE_ONLY_VALUES.some(t => permNorm.includes(t)) && !otherIsCouple) {
    return {
      passed: false,
      blockedBy: 'couple_permissions',
      reason: `${label}'s couple permissions require couple-to-couple connections only`,
    }
  }

  return { passed: true }
}

// =============================================================================
// AGE RANGE CONSTRAINT
// =============================================================================

/**
 * Check age range constraint.
 *
 * TODO: Age preference fields (age_min, age_max) do not yet exist in
 * the survey schema. This gate is structurally ready and will activate
 * once preference fields are added. Currently passes through.
 */
export function checkAgeRangeConstraint(
  _userAnswers: NormalizedAnswers,
  _matchAnswers: NormalizedAnswers
): ConstraintResult {
  // Age values are available via Q1, but min/max preference fields
  // are not yet part of the survey. When they are added, implement:
  //
  //   const userAge = parseFloat(asSingle(userAnswers.Q1 as any) || '')
  //   const matchAge = parseFloat(asSingle(matchAnswers.Q1 as any) || '')
  //   const userMin = parseFloat(asSingle(userAnswers.Q1_age_min as any) || '')
  //   const userMax = parseFloat(asSingle(userAnswers.Q1_age_max as any) || '')
  //   const matchMin = parseFloat(asSingle(matchAnswers.Q1_age_min as any) || '')
  //   const matchMax = parseFloat(asSingle(matchAnswers.Q1_age_max as any) || '')
  //   if (matchAge < userMin || matchAge > userMax) return blocked
  //   if (userAge < matchMin || userAge > matchMax) return blocked

  return { passed: true }
}

// =============================================================================
// DISTANCE CONSTRAINT
// =============================================================================

/**
 * Check distance constraint.
 *
 * TODO: Distance computation requires geolocation coordinates or geocoding
 * of city/zip from the partnerships table. Survey answers include Q19a
 * (max distance preference) but not actual computed distance between users.
 * This gate will activate once distance infrastructure is connected.
 */
export function checkDistanceConstraint(
  _userAnswers: NormalizedAnswers,
  _matchAnswers: NormalizedAnswers
): ConstraintResult {
  // When distance infrastructure is available, implement:
  //
  //   const userMaxDist = parseDistancePreference(userAnswers.Q19a)
  //   const matchMaxDist = parseDistancePreference(matchAnswers.Q19a)
  //   const actualDistance = computeDistance(userLocation, matchLocation)
  //   if (actualDistance > userMaxDist || actualDistance > matchMaxDist) {
  //     return { passed: false, blockedBy: 'distance', reason: '...' }
  //   }

  return { passed: true }
}

// =============================================================================
// SAFER-SEX CONSTRAINT
// =============================================================================

/**
 * Check safer-sex compatibility constraint.
 *
 * Q30: Safer-sex tier — extreme mismatch (≥6 tiers apart) blocks match.
 * Q30a: Specific practices — direct conflicts (e.g. fluid_bonding vs
 * no_fluid_bonding) block match.
 */
export function checkSaferSexConstraint(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): ConstraintResult {
  const userTier = asSingle(userAnswers.Q30 as string | string[] | undefined)
  const matchTier = asSingle(matchAnswers.Q30 as string | string[] | undefined)

  if (userTier && matchTier) {
    const userIdx = SAFER_SEX_GATE_TIERS.findIndex(
      t => t === userTier.toLowerCase().trim()
    )
    const matchIdx = SAFER_SEX_GATE_TIERS.findIndex(
      t => t === matchTier.toLowerCase().trim()
    )

    if (userIdx !== -1 && matchIdx !== -1) {
      if (Math.abs(userIdx - matchIdx) >= MAX_SAFER_SEX_TIER_DISTANCE) {
        return {
          passed: false,
          blockedBy: 'safer_sex',
          reason: `Extreme safer-sex mismatch: User "${userTier}" vs Match "${matchTier}"`,
        }
      }
    }
  }

  const userSpecifics = asArray(userAnswers.Q30a)
  const matchSpecifics = asArray(matchAnswers.Q30a)

  if (userSpecifics.length > 0 && matchSpecifics.length > 0) {
    const userNorm = userSpecifics.map(s => s.toLowerCase().trim())
    const matchNorm = matchSpecifics.map(s => s.toLowerCase().trim())

    for (const [termA, termB] of SAFER_SEX_CONFLICT_PAIRS) {
      if (
        (userNorm.some(u => u.includes(termA)) && matchNorm.some(m => m.includes(termB))) ||
        (userNorm.some(u => u.includes(termB)) && matchNorm.some(m => m.includes(termA)))
      ) {
        return {
          passed: false,
          blockedBy: 'safer_sex',
          reason: `Safer-sex practice conflict: "${termA}" vs "${termB}"`,
        }
      }
    }
  }

  return { passed: true }
}

// =============================================================================
// HEALTH COMPATIBILITY CONSTRAINT
// =============================================================================

/**
 * Check health compatibility constraint.
 *
 * Q31: Sexual health practices — if testing/disclosure requirements
 * directly conflict (e.g. requires_testing vs no_testing), block match.
 */
export function checkHealthConstraint(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): ConstraintResult {
  const userHealth = asArray(userAnswers.Q31 as string | string[] | undefined)
  const matchHealth = asArray(matchAnswers.Q31 as string | string[] | undefined)

  if (userHealth.length === 0 || matchHealth.length === 0) {
    return { passed: true }
  }

  const userNorm = userHealth.map(h => h.toLowerCase().trim())
  const matchNorm = matchHealth.map(h => h.toLowerCase().trim())

  for (const [termA, termB] of HEALTH_CONFLICT_PAIRS) {
    if (
      (userNorm.some(u => u.includes(termA)) && matchNorm.some(m => m.includes(termB))) ||
      (userNorm.some(u => u.includes(termB)) && matchNorm.some(m => m.includes(termA)))
    ) {
      return {
        passed: false,
        blockedBy: 'health',
        reason: `Health practice conflict: "${termA}" vs "${termB}"`,
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
  constraintType:
    | 'core_intent'
    | 'language'
    | 'mutual_interest'
    | 'couple_permissions'
    | 'age_range'
    | 'distance'
    | 'safer_sex'
    | 'health'
    | 'boundaries',
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers,
  userIsCouple: boolean = false,
  matchIsCouple: boolean = false
): ConstraintResult {
  switch (constraintType) {
    case 'core_intent':
      return checkCoreIntentConstraint(userAnswers, matchAnswers)
    case 'language':
      return checkLanguageConstraint(userAnswers, matchAnswers)
    case 'mutual_interest':
      return checkMutualInterestConstraint(userAnswers, matchAnswers, userIsCouple, matchIsCouple)
    case 'couple_permissions':
      return checkCouplePermissionsConstraint(userAnswers, matchAnswers, userIsCouple, matchIsCouple)
    case 'age_range':
      return checkAgeRangeConstraint(userAnswers, matchAnswers)
    case 'distance':
      return checkDistanceConstraint(userAnswers, matchAnswers)
    case 'safer_sex':
      return checkSaferSexConstraint(userAnswers, matchAnswers)
    case 'health':
      return checkHealthConstraint(userAnswers, matchAnswers)
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
    core_intent: checkCoreIntentConstraint(userAnswers, matchAnswers),
    language: checkLanguageConstraint(userAnswers, matchAnswers),
    mutual_interest: checkMutualInterestConstraint(userAnswers, matchAnswers, userIsCouple, matchIsCouple),
    couple_permissions: checkCouplePermissionsConstraint(userAnswers, matchAnswers, userIsCouple, matchIsCouple),
    age_range: checkAgeRangeConstraint(userAnswers, matchAnswers),
    distance: checkDistanceConstraint(userAnswers, matchAnswers),
    safer_sex: checkSaferSexConstraint(userAnswers, matchAnswers),
    health: checkHealthConstraint(userAnswers, matchAnswers),
    boundaries: checkBoundariesConstraint(userAnswers, matchAnswers),
    boundaries_reverse: checkBoundariesConstraint(matchAnswers, userAnswers),
  }
}
