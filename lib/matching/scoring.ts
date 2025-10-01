/**
 * HAEVN Matching Scoring Engine
 * Based on HAEVN_MatchingSpec_v1.0_Final
 *
 * Implements the 6-step scoring workflow:
 * 1. Process inputs (user profiles)
 * 2. Apply scoring functions
 * 3. Weight results by section
 * 4. Sum across sections
 * 5. Apply tier logic
 * 6. Handle hard filters
 */

// ============================================================================
// TYPES
// ============================================================================

export interface UserProfile {
  id: string

  // Identity & Demographics
  identity: 'single' | 'couple' | 'throuple' | string // Their actual identity
  gender_identity?: string
  age?: number
  location?: {
    city?: string
    state?: string
    msa?: string // Metropolitan Statistical Area
    zip_code?: string
  }

  // Seeking & Structure
  seeking_targets?: string[] // Who they're looking for (men, women, couples, etc.)
  structure?: string // 'ENM' | 'Monogamous' | 'Open' | 'Poly' | etc.

  // Intent & Compatibility
  intent?: string[] // ['dating', 'play', 'friendship', 'long-term']
  discretion_level?: 'Low' | 'Medium' | 'High'

  // Verification & Profile
  is_verified?: boolean
  has_background_check?: boolean
  profile_completeness?: number // 0-1

  // Survey responses (for extended matching)
  survey_responses?: Record<string, any>
}

export interface MatchScore {
  score: number // 0-100
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze' | 'Excluded'
  breakdown: ScoreBreakdown
  excluded: boolean
  exclusion_reason?: string
}

export interface ScoreBreakdown {
  seeking_identity: number
  structure: number
  intent: number
  discretion: number
  location: number
  verification: number
  raw_sections: {
    [key: string]: {
      score: number
      weight: number
      contribution: number
    }
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Section weights (must sum to 1.0)
const SECTION_WEIGHTS = {
  seeking_identity: 0.25, // 25% - Primary compatibility filter
  structure: 0.20,        // 20% - Relationship structure match
  intent: 0.20,           // 20% - What people are looking for
  location: 0.20,         // 20% - Geographic proximity
  discretion: 0.10,       // 10% - Privacy level alignment
  verification: 0.05,     // 5% - Trust & safety bonus
} as const

// Tier thresholds
const TIER_THRESHOLDS = {
  platinum: 80, // >= 80
  gold: 70,     // >= 70
  silver: 60,   // >= 60
  bronze: 40,   // >= 40
  // < 40 = Excluded
} as const

// Structure compatibility matrix
const STRUCTURE_COMPAT_MATRIX: Record<string, Record<string, number>> = {
  'ENM': { 'ENM': 1.0, 'Open': 0.8, 'Poly': 0.9, 'Monogamous': 0.2 },
  'Open': { 'ENM': 0.8, 'Open': 1.0, 'Poly': 0.7, 'Monogamous': 0.3 },
  'Poly': { 'ENM': 0.9, 'Open': 0.7, 'Poly': 1.0, 'Monogamous': 0.2 },
  'Monogamous': { 'ENM': 0.2, 'Open': 0.3, 'Poly': 0.2, 'Monogamous': 1.0 },
}

// Identity normalization: map plural forms to singular for matching
function normalizeIdentity(identity: string | null | undefined): string {
  if (!identity) return 'unknown'
  const normalized = identity.toLowerCase().trim()
  // Map plurals to singles
  if (normalized === 'couples') return 'couple'
  if (normalized === 'men') return 'man'
  if (normalized === 'women') return 'woman'
  if (normalized === 'throuples') return 'throuple'
  if (normalized === 'singles') return 'single'
  return normalized
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Binary match: returns 1 if match, 0 if not
 * Supports identity normalization (e.g., "couples" matches "couple")
 */
function binaryMatch(value1: any, value2: any, normalize: boolean = false): number {
  if (Array.isArray(value1)) {
    if (normalize) {
      const normalizedValue2 = normalizeIdentity(value2)
      return value1.some(v => normalizeIdentity(v) === normalizedValue2) ? 1 : 0
    }
    return value1.includes(value2) ? 1 : 0
  }
  if (normalize) {
    return normalizeIdentity(value1) === normalizeIdentity(value2) ? 1 : 0
  }
  return value1 === value2 ? 1 : 0
}

/**
 * Jaccard similarity: |intersection| / |union|
 * Used for multi-select fields like intent, interests
 */
function jaccardSimilarity(arr1: string[], arr2: string[]): number {
  if (!arr1?.length || !arr2?.length) return 0

  const set1 = new Set(arr1)
  const set2 = new Set(arr2)

  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])

  return intersection.size / union.size
}

/**
 * Matrix lookup: uses compatibility matrix for structured data
 */
function matrixLookup(
  value1: string,
  value2: string,
  matrix: Record<string, Record<string, number>>
): number {
  if (!value1 || !value2) return 0
  return matrix[value1]?.[value2] ?? 0
}

/**
 * Distance penalty: applies decreasing score based on difference
 * Used for discretion levels, age ranges, etc.
 */
function distancePenalty(
  level1: string,
  level2: string,
  levels: string[]
): number {
  if (!level1 || !level2) return 0

  const idx1 = levels.indexOf(level1)
  const idx2 = levels.indexOf(level2)

  if (idx1 === -1 || idx2 === -1) return 0

  const distance = Math.abs(idx1 - idx2)

  // Same level = 1.0, 1 step = 0.7, 2+ steps = 0.3
  if (distance === 0) return 1.0
  if (distance === 1) return 0.7
  return 0.3
}

/**
 * Location scoring: checks if users are in same MSA/city
 */
function locationScore(loc1: UserProfile['location'], loc2: UserProfile['location']): number {
  if (!loc1 || !loc2) return 0.5 // Neutral if location missing

  // MSA match = full score
  if (loc1.msa && loc2.msa && loc1.msa === loc2.msa) return 1.0

  // City match = high score
  if (loc1.city && loc2.city && loc1.city.toLowerCase() === loc2.city.toLowerCase()) return 0.9

  // State match = medium score
  if (loc1.state && loc2.state && loc1.state === loc2.state) return 0.6

  // Different locations = low score
  return 0.3
}

/**
 * Verification bonus: adds points for verified profiles
 */
function verificationBonus(user1: UserProfile, user2: UserProfile): number {
  let score = 0

  // Both verified = 1.0
  if (user1.is_verified && user2.is_verified) score += 0.5
  // One verified = 0.5
  else if (user1.is_verified || user2.is_verified) score += 0.25

  // Background checks
  if (user1.has_background_check && user2.has_background_check) score += 0.5
  else if (user1.has_background_check || user2.has_background_check) score += 0.25

  return Math.min(score, 1.0)
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate match score between two users
 *
 * @param userA - The viewing user
 * @param userB - The potential match
 * @returns MatchScore with score, tier, and breakdown
 */
export function calculateMatch(userA: UserProfile, userB: UserProfile): MatchScore {
  const breakdown: ScoreBreakdown = {
    seeking_identity: 0,
    structure: 0,
    intent: 0,
    discretion: 0,
    location: 0,
    verification: 0,
    raw_sections: {}
  }

  // HARD FILTER: Check if userA's seeking includes userB's identity
  // Use normalized matching (e.g., "couples" matches "couple")
  const seekingMatch = binaryMatch(userA.seeking_targets, userB.identity, true)
  if (seekingMatch === 0) {
    return {
      score: 0,
      tier: 'Excluded',
      breakdown,
      excluded: true,
      exclusion_reason: 'Identity not in seeking preferences'
    }
  }

  // ====================================================================
  // SECTION 1: Seeking ↔ Identity (25%)
  // ====================================================================
  const seekingScore = seekingMatch
  breakdown.seeking_identity = seekingScore * SECTION_WEIGHTS.seeking_identity * 100
  breakdown.raw_sections.seeking_identity = {
    score: seekingScore,
    weight: SECTION_WEIGHTS.seeking_identity,
    contribution: breakdown.seeking_identity
  }

  // ====================================================================
  // SECTION 2: Structure (20%)
  // ====================================================================
  const structureScore = matrixLookup(
    userA.structure || '',
    userB.structure || '',
    STRUCTURE_COMPAT_MATRIX
  )
  breakdown.structure = structureScore * SECTION_WEIGHTS.structure * 100
  breakdown.raw_sections.structure = {
    score: structureScore,
    weight: SECTION_WEIGHTS.structure,
    contribution: breakdown.structure
  }

  // ====================================================================
  // SECTION 3: Intent (20%)
  // ====================================================================
  const intentScore = jaccardSimilarity(
    userA.intent || [],
    userB.intent || []
  )
  breakdown.intent = intentScore * SECTION_WEIGHTS.intent * 100
  breakdown.raw_sections.intent = {
    score: intentScore,
    weight: SECTION_WEIGHTS.intent,
    contribution: breakdown.intent
  }

  // ====================================================================
  // SECTION 4: Location (20%)
  // ====================================================================
  const locScore = locationScore(userA.location, userB.location)
  breakdown.location = locScore * SECTION_WEIGHTS.location * 100
  breakdown.raw_sections.location = {
    score: locScore,
    weight: SECTION_WEIGHTS.location,
    contribution: breakdown.location
  }

  // ====================================================================
  // SECTION 5: Discretion (10%)
  // ====================================================================
  const discretionScore = distancePenalty(
    userA.discretion_level || '',
    userB.discretion_level || '',
    ['Low', 'Medium', 'High']
  )
  breakdown.discretion = discretionScore * SECTION_WEIGHTS.discretion * 100
  breakdown.raw_sections.discretion = {
    score: discretionScore,
    weight: SECTION_WEIGHTS.discretion,
    contribution: breakdown.discretion
  }

  // ====================================================================
  // SECTION 6: Verification (5%)
  // ====================================================================
  const verificationScore = verificationBonus(userA, userB)
  breakdown.verification = verificationScore * SECTION_WEIGHTS.verification * 100
  breakdown.raw_sections.verification = {
    score: verificationScore,
    weight: SECTION_WEIGHTS.verification,
    contribution: breakdown.verification
  }

  // ====================================================================
  // CALCULATE FINAL SCORE
  // ====================================================================
  const totalScore =
    breakdown.seeking_identity +
    breakdown.structure +
    breakdown.intent +
    breakdown.location +
    breakdown.discretion +
    breakdown.verification

  // ====================================================================
  // APPLY TIER LOGIC
  // ====================================================================
  let tier: MatchScore['tier']
  if (totalScore >= TIER_THRESHOLDS.platinum) tier = 'Platinum'
  else if (totalScore >= TIER_THRESHOLDS.gold) tier = 'Gold'
  else if (totalScore >= TIER_THRESHOLDS.silver) tier = 'Silver'
  else if (totalScore >= TIER_THRESHOLDS.bronze) tier = 'Bronze'
  else tier = 'Excluded'

  return {
    score: Math.round(totalScore),
    tier,
    breakdown,
    excluded: tier === 'Excluded'
  }
}

/**
 * Calculate matches for a user against a list of potential matches
 * Returns only matches above the minimum threshold (Bronze+)
 */
export function calculateMatches(
  user: UserProfile,
  potentialMatches: UserProfile[],
  minTier: MatchScore['tier'] = 'Bronze'
): Array<{ match: UserProfile; score: MatchScore }> {
  const tierOrder = ['Excluded', 'Bronze', 'Silver', 'Gold', 'Platinum']
  const minTierIndex = tierOrder.indexOf(minTier)

  return potentialMatches
    .map(match => ({
      match,
      score: calculateMatch(user, match)
    }))
    .filter(({ score }) => {
      // Filter out excluded matches and below min tier
      return !score.excluded && tierOrder.indexOf(score.tier) >= minTierIndex
    })
    .sort((a, b) => b.score.score - a.score.score) // Sort by score descending
}
