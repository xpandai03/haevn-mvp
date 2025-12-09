/**
 * HAEVN Matching Engine - Weight Constants
 *
 * All category and sub-component weights for compatibility scoring.
 */

// =============================================================================
// CATEGORY WEIGHTS (sum to 100)
// =============================================================================

/**
 * Raw category weights before any normalization.
 * These are the default weights when all categories are included.
 */
export const CATEGORY_WEIGHTS = {
  intent: 30,
  structure: 25,
  connection: 20,
  chemistry: 15,
  lifestyle: 10,
} as const

/**
 * Category weight type
 */
export type CategoryName = keyof typeof CATEGORY_WEIGHTS

// =============================================================================
// INTENT FIT SUB-COMPONENT WEIGHTS (sum to 100)
// =============================================================================

export const INTENT_WEIGHTS = {
  /** Q9, Q9a: Connection goals - must overlap */
  goals: 30,
  /** Q6: Relationship style - ENM matching */
  style: 20,
  /** Q7, Q8, Q25: Exclusivity tier logic */
  exclusivity: 15,
  /** Q10, Q10a: Attachment/availability adjacency */
  attachment: 15,
  /** Q15, Q16, Q16a: Time windows and capacity */
  timing: 10,
  /** Q20, Q20b: Privacy needs */
  privacy: 5,
  /** Q21: HAEVN use purposes */
  haevnUse: 5,
} as const

// =============================================================================
// STRUCTURE FIT SUB-COMPONENT WEIGHTS (sum to 100)
// =============================================================================

export const STRUCTURE_WEIGHTS = {
  /** Q3, Q3b, Q3c: Orientation and Kinsey-scale proximity */
  orientation: 25,
  /** Q4, Q6b: Relationship status and who they want to meet */
  status: 25,
  /** Q6c, Q6d, Q28: Couple rules and hard boundaries */
  boundaries: 25,
  /** Q30, Q30a, Q31: Safer-sex and health practices */
  saferSex: 15,
  /** Q26: Relational/sexual roles */
  roles: 10,
} as const

// =============================================================================
// CONNECTION STYLE SUB-COMPONENT WEIGHTS (sum to 100)
// =============================================================================

export const CONNECTION_WEIGHTS = {
  /** Q10, Q10a: Attachment style and emotional availability */
  attachment: 40,
  /** Q11, Q12, Q12a: Love languages, conflict, messaging */
  communication: 30,
  /** Q37, Q37a, Q38, Q38a: Empathy, harmony, jealousy, reactivity */
  emotional: 20,
  /** Q20, Q20b: Privacy and visibility comfort */
  privacy: 10,
} as const

// =============================================================================
// SEXUAL CHEMISTRY SUB-COMPONENT WEIGHTS (sum to 100)
// =============================================================================

export const CHEMISTRY_WEIGHTS = {
  /** Q23, Q24, Q25: Erotic styles, experiences, chemistry importance */
  eroticProfile: 35,
  /** Q26, Q33, Q33a: Roles, kinks, kink experience */
  rolesKinks: 35,
  /** Q25a: Frequency preference */
  frequency: 20,
  /** Q28, Q29: Boundaries and discussion items */
  boundaries: 10,
} as const

// =============================================================================
// LIFESTYLE COMPATIBILITY SUB-COMPONENT WEIGHTS
// =============================================================================

/**
 * Lifestyle weights with question type markers.
 * CORE questions are asked of everyone.
 * EXTENDED questions are shown mainly for romantic/long-term intent.
 */
export const LIFESTYLE_WEIGHTS = {
  /** Q19a, Q19b, Q19c: Distance and mobility - CORE */
  distance: { weight: 20, type: 'core' as const },
  /** Q20: Privacy/discretion - CORE */
  privacy: { weight: 15, type: 'core' as const },
  /** Q36, Q36a: Social energy - CORE */
  socialEnergy: { weight: 15, type: 'core' as const },
  /** Q18: Substance use - CORE */
  substances: { weight: 10, type: 'core' as const },
  /** Q13a: Languages - CORE/CONSTRAINT (handled separately) */
  languages: { weight: 10, type: 'core' as const },
  /** Q13: Lifestyle alignment importance - EXTENDED */
  lifestyleImportance: { weight: 5, type: 'extended' as const },
  /** Q14a, Q14b: Cultural/worldview - EXTENDED */
  cultural: { weight: 10, type: 'extended' as const },
  /** Q17: Children preferences - EXTENDED */
  children: { weight: 5, type: 'extended' as const },
  /** Q17a: Dietary needs - EXTENDED */
  dietary: { weight: 5, type: 'extended' as const },
  /** Q17b: Pets - EXTENDED */
  pets: { weight: 5, type: 'extended' as const },
} as const

/**
 * Total possible weight for Lifestyle category
 */
export const LIFESTYLE_TOTAL_WEIGHT = Object.values(LIFESTYLE_WEIGHTS).reduce(
  (sum, item) => sum + item.weight,
  0
)

// =============================================================================
// LIFESTYLE COVERAGE THRESHOLD
// =============================================================================

/**
 * Minimum coverage required to include Lifestyle in scoring.
 * If coverage is below this, Lifestyle is excluded and weights renormalized.
 */
export const LIFESTYLE_COVERAGE_THRESHOLD = 0.4 // 40%

// =============================================================================
// TIER THRESHOLDS
// =============================================================================

/**
 * Score thresholds for compatibility tiers.
 */
export const TIER_THRESHOLDS = {
  platinum: 85,
  gold: 70,
  silver: 55,
  bronze: 0, // anything below silver
} as const

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Renormalize category weights when one or more categories are excluded.
 *
 * @param excludedCategories - Array of category names to exclude
 * @returns New weights that sum to 100
 */
export function renormalizeWeights(
  excludedCategories: CategoryName[] = []
): Record<CategoryName, number> {
  const includedCategories = (Object.keys(CATEGORY_WEIGHTS) as CategoryName[]).filter(
    (cat) => !excludedCategories.includes(cat)
  )

  const totalIncludedWeight = includedCategories.reduce(
    (sum, cat) => sum + CATEGORY_WEIGHTS[cat],
    0
  )

  const normalized: Partial<Record<CategoryName, number>> = {}

  for (const cat of Object.keys(CATEGORY_WEIGHTS) as CategoryName[]) {
    if (excludedCategories.includes(cat)) {
      normalized[cat] = 0
    } else {
      normalized[cat] = (CATEGORY_WEIGHTS[cat] / totalIncludedWeight) * 100
    }
  }

  return normalized as Record<CategoryName, number>
}

/**
 * Get compatibility tier from overall score.
 */
export function getTierFromScore(score: number): 'Platinum' | 'Gold' | 'Silver' | 'Bronze' {
  if (score >= TIER_THRESHOLDS.platinum) return 'Platinum'
  if (score >= TIER_THRESHOLDS.gold) return 'Gold'
  if (score >= TIER_THRESHOLDS.silver) return 'Silver'
  return 'Bronze'
}
