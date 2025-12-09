/**
 * HAEVN Matching Engine - Structure Fit Category
 *
 * Evaluates compatibility of relationship makeup, sexuality,
 * boundaries, and who each party is open to connecting with.
 *
 * Weight: 25% of overall score
 *
 * Sub-components:
 * - Orientation/Kinsey (25%): Q3, Q3b, Q3c
 * - Status/Structure (25%): Q4, Q6b
 * - Rules/Boundaries (25%): Q6c, Q6d, Q28
 * - Safer-Sex/Health (15%): Q30, Q30a, Q31
 * - Roles (10%): Q26
 */

import type { NormalizedAnswers, CategoryScore, SubScore } from '../types'
import { STRUCTURE_WEIGHTS } from '../utils/weights'
import {
  hasOverlap,
  jaccardSimilarity,
  tierProximityScore,
  weightedAverage,
  calculateCoverage,
  binaryMatch,
} from '../utils/scoring'
import {
  getArrayAnswer,
  getStringAnswer,
} from '../utils/normalizeAnswers'

// =============================================================================
// TIER ORDERINGS FOR STRUCTURE QUESTIONS
// =============================================================================

/**
 * Kinsey scale tiers for orientation proximity scoring
 * 0 = exclusively heterosexual, 6 = exclusively homosexual
 */
const KINSEY_TIERS = [
  '0', 'exclusively_heterosexual',
  '1', 'predominantly_heterosexual',
  '2', 'mostly_heterosexual',
  '3', 'bisexual', 'equally_attracted',
  '4', 'mostly_homosexual',
  '5', 'predominantly_homosexual',
  '6', 'exclusively_homosexual',
] as const

/**
 * Sexual/relational role tiers
 */
const ROLE_TIERS = [
  'dominant', 'mostly_dominant',
  'switch', 'versatile', 'flexible',
  'mostly_submissive', 'submissive',
] as const

/**
 * Safer-sex practice tiers
 */
const SAFER_SEX_TIERS = [
  'always', 'very_strict',
  'usually', 'mostly',
  'sometimes', 'flexible',
  'rarely', 'seldom',
  'never', 'not_applicable',
] as const

// =============================================================================
// MAIN STRUCTURE SCORER
// =============================================================================

/**
 * Calculate Structure Fit score between two partners.
 *
 * @param userAnswers - Normalized answers from User
 * @param matchAnswers - Normalized answers from Match
 * @param userIsCouple - Whether User is part of a couple
 * @param matchIsCouple - Whether Match is part of a couple
 * @returns CategoryScore for Structure Fit
 */
export function scoreStructure(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers,
  userIsCouple: boolean = false,
  matchIsCouple: boolean = false
): CategoryScore {
  const subScores: SubScore[] = [
    scoreOrientation(userAnswers, matchAnswers),
    scoreStatus(userAnswers, matchAnswers, userIsCouple, matchIsCouple),
    scoreBoundaries(userAnswers, matchAnswers),
    scoreSaferSex(userAnswers, matchAnswers),
    scoreRoles(userAnswers, matchAnswers),
  ]

  const score = weightedAverage(subScores)
  const coverage = calculateCoverage(subScores)

  return {
    category: 'structure',
    score,
    weight: 25,
    subScores,
    coverage,
    included: true,
  }
}

// =============================================================================
// SUB-COMPONENT SCORERS
// =============================================================================

/**
 * Score Orientation sub-component (25%)
 * Q3: Sexual orientation labels, Q3b: Kinsey scale, Q3c: Gender attraction
 * Many-to-many with Kinsey proximity bonus.
 */
function scoreOrientation(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userOrientation = getArrayAnswer(userAnswers, 'Q3')
  const matchOrientation = getArrayAnswer(matchAnswers, 'Q3')
  const userKinsey = getStringAnswer(userAnswers, 'Q3b')
  const matchKinsey = getStringAnswer(matchAnswers, 'Q3b')
  const userGenderAttraction = getArrayAnswer(userAnswers, 'Q3c')
  const matchGenderAttraction = getArrayAnswer(matchAnswers, 'Q3c')

  // Need at least one orientation indicator from both
  const hasOrientationData =
    (userOrientation.length > 0 || userKinsey || userGenderAttraction.length > 0) &&
    (matchOrientation.length > 0 || matchKinsey || matchGenderAttraction.length > 0)

  if (!hasOrientationData) {
    return {
      key: 'orientation',
      score: 0,
      weight: STRUCTURE_WEIGHTS.orientation,
      matched: false,
      reason: 'Orientation preferences not specified',
    }
  }

  let totalScore = 0
  let components = 0

  // Score orientation label overlap (if both have)
  if (userOrientation.length > 0 && matchOrientation.length > 0) {
    const orientationScore = jaccardSimilarity(userOrientation, matchOrientation)
    // Bonus for any overlap
    const overlapBonus = hasOverlap(userOrientation, matchOrientation) ? 15 : 0
    totalScore += Math.min(100, orientationScore + overlapBonus)
    components++
  }

  // Score Kinsey proximity (if both have)
  if (userKinsey && matchKinsey) {
    const kinseyScore = tierProximityScore(userKinsey, matchKinsey, KINSEY_TIERS, 6)
    totalScore += kinseyScore
    components++
  }

  // Score gender attraction overlap (if both have)
  if (userGenderAttraction.length > 0 && matchGenderAttraction.length > 0) {
    const genderScore = jaccardSimilarity(userGenderAttraction, matchGenderAttraction)
    // High bonus for any overlap - this is critical for compatibility
    const overlapBonus = hasOverlap(userGenderAttraction, matchGenderAttraction) ? 25 : 0
    totalScore += Math.min(100, genderScore + overlapBonus)
    components++
  }

  const finalScore = components > 0 ? Math.round(totalScore / components) : 0

  return {
    key: 'orientation',
    score: finalScore,
    weight: STRUCTURE_WEIGHTS.orientation,
    matched: components > 0,
    reason: finalScore >= 70
      ? 'Compatible orientation preferences'
      : finalScore >= 40
        ? 'Some orientation alignment'
        : 'Different orientation preferences',
  }
}

/**
 * Score Status sub-component (25%)
 * Q4: Relationship status, Q6b: Who they want to meet (solo/couple)
 * Binary matching on status, overlap check for meeting preferences.
 */
function scoreStatus(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers,
  userIsCouple: boolean,
  matchIsCouple: boolean
): SubScore {
  const userStatus = getStringAnswer(userAnswers, 'Q4')
  const matchStatus = getStringAnswer(matchAnswers, 'Q4')
  const userWantsToMeet = getArrayAnswer(userAnswers, 'Q6b')
  const matchWantsToMeet = getArrayAnswer(matchAnswers, 'Q6b')

  // Check if we have any data
  const hasStatusData = userStatus || matchStatus || userWantsToMeet.length > 0 || matchWantsToMeet.length > 0

  if (!hasStatusData) {
    return {
      key: 'status',
      score: 0,
      weight: STRUCTURE_WEIGHTS.status,
      matched: false,
      reason: 'Relationship status not specified',
    }
  }

  let totalScore = 0
  let components = 0

  // Score status similarity (if both have)
  if (userStatus && matchStatus) {
    // Neutral approach - different statuses aren't incompatible
    const statusScore = binaryMatch(userStatus, matchStatus)
    // Base 50 for different statuses (not penalizing), 100 for same
    totalScore += statusScore > 0 ? 100 : 60
    components++
  }

  // Score meeting preference match
  if (userWantsToMeet.length > 0 && matchWantsToMeet.length > 0) {
    // Check if User's type matches what Match wants
    const userType = userIsCouple ? 'couple' : 'solo'
    const matchType = matchIsCouple ? 'couple' : 'solo'

    // Normalize to lowercase for checking
    const matchWantsNormalized = matchWantsToMeet.map(w => w.toLowerCase())
    const userWantsNormalized = userWantsToMeet.map(w => w.toLowerCase())

    // Check if Match is open to User's type
    const matchOpenToUser = matchWantsNormalized.some(w =>
      w.includes(userType) || w.includes('both') || w.includes('either') || w.includes('all')
    )

    // Check if User is open to Match's type
    const userOpenToMatch = userWantsNormalized.some(w =>
      w.includes(matchType) || w.includes('both') || w.includes('either') || w.includes('all')
    )

    if (matchOpenToUser && userOpenToMatch) {
      totalScore += 100
    } else if (matchOpenToUser || userOpenToMatch) {
      totalScore += 50
    } else {
      totalScore += 20
    }
    components++
  }

  const finalScore = components > 0 ? Math.round(totalScore / components) : 0

  return {
    key: 'status',
    score: finalScore,
    weight: STRUCTURE_WEIGHTS.status,
    matched: components > 0,
    reason: finalScore >= 80
      ? 'Compatible relationship structure'
      : finalScore >= 50
        ? 'Workable structure match'
        : 'Different structure preferences',
  }
}

/**
 * Score Boundaries sub-component (25%)
 * Q6c: Couple rules, Q6d: Permission/hierarchy, Q28: Hard boundaries
 * Check for conflicts, reward alignment.
 */
function scoreBoundaries(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userRules = getArrayAnswer(userAnswers, 'Q6c')
  const matchRules = getArrayAnswer(matchAnswers, 'Q6c')
  const userPermission = getStringAnswer(userAnswers, 'Q6d')
  const matchPermission = getStringAnswer(matchAnswers, 'Q6d')
  const userBoundaries = getArrayAnswer(userAnswers, 'Q28')
  const matchBoundaries = getArrayAnswer(matchAnswers, 'Q28')

  // Check if we have any data
  const hasBoundaryData =
    userRules.length > 0 || matchRules.length > 0 ||
    userPermission || matchPermission ||
    userBoundaries.length > 0 || matchBoundaries.length > 0

  if (!hasBoundaryData) {
    return {
      key: 'boundaries',
      score: 0,
      weight: STRUCTURE_WEIGHTS.boundaries,
      matched: false,
      reason: 'Boundary preferences not specified',
    }
  }

  let totalScore = 0
  let components = 0

  // Score couple rules alignment (if both have)
  if (userRules.length > 0 && matchRules.length > 0) {
    const rulesScore = jaccardSimilarity(userRules, matchRules)
    // Bonus for overlap - aligned rules are good
    const overlapBonus = hasOverlap(userRules, matchRules) ? 20 : 0
    totalScore += Math.min(100, rulesScore + overlapBonus)
    components++
  }

  // Score permission/hierarchy alignment (if both have)
  if (userPermission && matchPermission) {
    const permissionScore = binaryMatch(userPermission, matchPermission)
    // Not penalizing different permission structures too harshly
    totalScore += permissionScore > 0 ? 100 : 50
    components++
  }

  // Score boundary overlap (shared boundaries = good)
  if (userBoundaries.length > 0 && matchBoundaries.length > 0) {
    const boundaryOverlap = jaccardSimilarity(userBoundaries, matchBoundaries)
    // Having overlapping boundaries is actually positive
    totalScore += boundaryOverlap
    components++
  } else if (userBoundaries.length > 0 || matchBoundaries.length > 0) {
    // Only one has boundaries - neutral score
    totalScore += 50
    components++
  }

  const finalScore = components > 0 ? Math.round(totalScore / components) : 0

  return {
    key: 'boundaries',
    score: finalScore,
    weight: STRUCTURE_WEIGHTS.boundaries,
    matched: components > 0,
    reason: finalScore >= 70
      ? 'Well-aligned boundaries'
      : finalScore >= 40
        ? 'Compatible boundaries with some differences'
        : 'Different boundary approaches',
  }
}

/**
 * Score Safer-Sex sub-component (15%)
 * Q30: Safer-sex practices, Q30a: Testing frequency, Q31: Health disclosures
 * Tier comparison for practices, preference for similar approaches.
 */
function scoreSaferSex(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userPractices = getStringAnswer(userAnswers, 'Q30')
  const matchPractices = getStringAnswer(matchAnswers, 'Q30')
  const userTesting = getStringAnswer(userAnswers, 'Q30a')
  const matchTesting = getStringAnswer(matchAnswers, 'Q30a')
  const userDisclosures = getArrayAnswer(userAnswers, 'Q31')
  const matchDisclosures = getArrayAnswer(matchAnswers, 'Q31')

  // Check if we have any data
  const hasSaferSexData =
    userPractices || matchPractices ||
    userTesting || matchTesting ||
    userDisclosures.length > 0 || matchDisclosures.length > 0

  if (!hasSaferSexData) {
    return {
      key: 'saferSex',
      score: 0,
      weight: STRUCTURE_WEIGHTS.saferSex,
      matched: false,
      reason: 'Safer-sex preferences not specified',
    }
  }

  let totalScore = 0
  let components = 0

  // Score safer-sex practice alignment (tier proximity)
  if (userPractices && matchPractices) {
    const practiceScore = tierProximityScore(
      userPractices,
      matchPractices,
      SAFER_SEX_TIERS,
      4 // Max 4 tier difference tolerated
    )
    totalScore += practiceScore
    components++
  }

  // Score testing frequency alignment
  if (userTesting && matchTesting) {
    const testingScore = binaryMatch(userTesting, matchTesting)
    // Similar testing schedules are good, different is okay
    totalScore += testingScore > 0 ? 100 : 60
    components++
  }

  // Score health disclosure overlap
  if (userDisclosures.length > 0 && matchDisclosures.length > 0) {
    // Having similar disclosure comfort levels is good
    const disclosureScore = jaccardSimilarity(userDisclosures, matchDisclosures)
    totalScore += disclosureScore
    components++
  }

  const finalScore = components > 0 ? Math.round(totalScore / components) : 0

  return {
    key: 'saferSex',
    score: finalScore,
    weight: STRUCTURE_WEIGHTS.saferSex,
    matched: components > 0,
    reason: finalScore >= 70
      ? 'Compatible safer-sex approaches'
      : finalScore >= 40
        ? 'Workable safer-sex alignment'
        : 'Different safer-sex practices',
  }
}

/**
 * Score Roles sub-component (10%)
 * Q26: Sexual/relational roles (dom/sub/switch/etc.)
 * Complementary matching - doms match with subs, switches with anyone.
 */
function scoreRoles(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers
): SubScore {
  const userRoles = getArrayAnswer(userAnswers, 'Q26')
  const matchRoles = getArrayAnswer(matchAnswers, 'Q26')

  if (userRoles.length === 0 || matchRoles.length === 0) {
    return {
      key: 'roles',
      score: 0,
      weight: STRUCTURE_WEIGHTS.roles,
      matched: false,
      reason: 'Role preferences not specified',
    }
  }

  // Normalize roles to lowercase
  const userRolesNorm = userRoles.map(r => r.toLowerCase().trim())
  const matchRolesNorm = matchRoles.map(r => r.toLowerCase().trim())

  // Define complementary role pairs
  const isSwitch = (roles: string[]) =>
    roles.some(r => r.includes('switch') || r.includes('versatile') || r.includes('flexible'))
  const isDom = (roles: string[]) =>
    roles.some(r => r.includes('dom') || r.includes('top'))
  const isSub = (roles: string[]) =>
    roles.some(r => r.includes('sub') || r.includes('bottom'))

  const userSwitch = isSwitch(userRolesNorm)
  const matchSwitch = isSwitch(matchRolesNorm)
  const userDom = isDom(userRolesNorm)
  const matchDom = isDom(matchRolesNorm)
  const userSub = isSub(userRolesNorm)
  const matchSub = isSub(matchRolesNorm)

  let score = 50 // Base neutral score

  // Switches are compatible with everyone
  if (userSwitch || matchSwitch) {
    score = 90
  }
  // Complementary: Dom + Sub = great match
  else if ((userDom && matchSub) || (userSub && matchDom)) {
    score = 100
  }
  // Same role: Dom + Dom or Sub + Sub
  else if ((userDom && matchDom) || (userSub && matchSub)) {
    score = 40 // Lower compatibility
  }

  // Bonus for explicit role overlap (both selected same labels)
  if (hasOverlap(userRolesNorm, matchRolesNorm)) {
    score = Math.min(100, score + 10)
  }

  return {
    key: 'roles',
    score,
    weight: STRUCTURE_WEIGHTS.roles,
    matched: true,
    reason: score >= 80
      ? 'Complementary role preferences'
      : score >= 50
        ? 'Compatible roles'
        : 'Same role preferences (may need discussion)',
  }
}
