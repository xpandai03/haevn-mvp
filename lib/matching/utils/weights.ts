// REVISION: Matching Model Update per Rik spec 04-10-2026
/**
 * HAEVN Matching Engine - Weight Constants
 *
 * All category and sub-component weights for compatibility scoring.
 *
 * Category weights (sum to 100):
 *   Intent & Goals:              30
 *   Connection Style / Emotional: 25
 *   Structure Fit:               20
 *   Lifestyle Fit:               15
 *   Sexual Chemistry:            10
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
  structure: 20,
  connection: 25,
  chemistry: 10,
  lifestyle: 15,
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
  status: 20,
  /** Q6c, Q6d, Q28: Couple rules and hard boundaries */
  boundaries: 20,
  /** Q30, Q30a, Q31: Safer-sex and health practices */
  saferSex: 15,
  /** Q26: Relational/sexual roles */
  roles: 10,
  /** Q3a: Fidelity/commitment philosophy */
  fidelity: 10,
} as const

// =============================================================================
// CONNECTION STYLE SUB-COMPONENT WEIGHTS (sum to 100)
// =============================================================================

export const CONNECTION_WEIGHTS = {
  /** Q10, Q10a: Attachment style and emotional availability */
  attachment: 34,
  /** Q11, Q12, Q12a: Love languages, conflict, messaging */
  communication: 26,
  /** Q37, Q37a, Q38, Q38a: Empathy, harmony, jealousy, reactivity */
  emotional: 17,
  /** Q20, Q20b: Privacy and visibility comfort */
  privacy: 9,
  /** Q_EMOTIONAL_PACE: Pace of emotional intimacy (1-5 distance scoring) */
  emotionalPace: 6,
  /** Q_EMOTIONAL_ENGAGEMENT: Emotional engagement bandwidth (1-5 distance scoring) */
  emotionalEngagement: 8,
} as const

// =============================================================================
// SEXUAL CHEMISTRY SUB-COMPONENT WEIGHTS (sum to 100)
// =============================================================================

export const CHEMISTRY_WEIGHTS = {
  /** Q23, Q24, Q25: Erotic styles, experiences, chemistry importance */
  eroticProfile: 30,
  /** Q26, Q33, Q33a: Roles, kinks, kink experience */
  rolesKinks: 30,
  /** Q25a: Frequency preference */
  frequency: 10,
  /** Q28, Q29: Boundaries and discussion items */
  boundaries: 10,
  /** Q27, Q27b: Body type self vs preferences cross-check */
  physicalPreferences: 10,
  /** Q34, Q34a: Exploration openness and variety desire */
  exploration: 10,
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
  /** Q19a, Q19b, Q19c: Distance and mobility - CORE (boosted from 19 to compensate for distance gate demotion) */
  distance: { weight: 22, type: 'core' as const },
  /** Q20: Privacy/discretion - CORE */
  privacy: { weight: 12, type: 'core' as const },
  /** Q36, Q36a: Social energy - CORE */
  socialEnergy: { weight: 12, type: 'core' as const },
  /** Q18: Substance use - CORE */
  substances: { weight: 8, type: 'core' as const },
  /** Q13a: Languages - CORE/CONSTRAINT (handled separately) */
  languages: { weight: 7, type: 'core' as const },
  /** Q_INDEPENDENCE_BALANCE: Independence vs integration (1-5 distance scoring) - CORE */
  independenceBalance: { weight: 5, type: 'core' as const },
  /** Q13: Lifestyle alignment importance - EXTENDED */
  lifestyleImportance: { weight: 4, type: 'extended' as const },
  /** Q14a, Q14b: Cultural/worldview - EXTENDED */
  cultural: { weight: 8, type: 'extended' as const },
  /** Q17: Children preferences - EXTENDED */
  children: { weight: 5, type: 'extended' as const },
  /** Q17a: Dietary needs - EXTENDED */
  dietary: { weight: 4, type: 'extended' as const },
  /** Q17b: Pets - EXTENDED */
  pets: { weight: 4, type: 'extended' as const },
  /** Q1, Q_AGE_MIN, Q_AGE_MAX: Age range scoring (demoted from hard gate) - CORE */
  ageRange: { weight: 9, type: 'core' as const },
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
  platinum: 80,
  gold: 60,
  silver: 40,
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
