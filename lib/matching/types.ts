/**
 * HAEVN Matching Engine - Type Definitions
 *
 * All types for the internal compatibility matching system.
 */

// =============================================================================
// RAW & NORMALIZED ANSWERS
// =============================================================================

/**
 * Raw answers from survey_responses.answers_json
 * Flexible type since survey data can have various formats
 */
export type RawAnswers = Record<string, string | string[] | number | boolean | null | undefined>

/**
 * Normalized answers with consistent structure for matching calculations.
 * All multi-select questions are normalized to string arrays.
 */
export interface NormalizedAnswers {
  // -------------------------------------------------------------------------
  // INTENT FIT QUESTIONS
  // -------------------------------------------------------------------------

  /** Q9: Connection goals (multi-select) */
  Q9?: string[]
  /** Q9a: Sub-goals / specific intentions (multi-select) */
  Q9a?: string[]
  /** Q6: Relationship style - ENM type (multi-select) */
  Q6?: string[]
  /** Q6b: Who they want to meet - solo/couple preference (multi-select) */
  Q6b?: string[]
  /** Q6c: Couple rules (multi-select, only if couple) */
  Q6c?: string[]
  /** Q6d: Couple dynamics (single, only if couple) */
  Q6d?: string
  /** Q7: Exclusivity level (single) */
  Q7?: string
  /** Q8: Exclusivity tier (single) */
  Q8?: string
  /** Q10: Attachment style (single) */
  Q10?: string
  /** Q10a: Emotional availability level (single) */
  Q10a?: string
  /** Q15: Time availability (single) */
  Q15?: string
  /** Q16: Preferred days/times (multi-select) */
  Q16?: string[]
  /** Q16a: Schedule flexibility (single) */
  Q16a?: string
  /** Q12a: Messaging pace preference (single) */
  Q12a?: string
  /** Q20: Privacy/discretion level (single) */
  Q20?: string
  /** Q20b: Comfort with visibility (single) */
  Q20b?: string
  /** Q21: HAEVN use purposes (multi-select) */
  Q21?: string[]

  // -------------------------------------------------------------------------
  // STRUCTURE FIT QUESTIONS
  // -------------------------------------------------------------------------

  /** Q3: Sexual orientation labels (multi-select) */
  Q3?: string[]
  /** Q3a: Fidelity/commitment philosophy (single) */
  Q3a?: string
  /** Q3b: Kinsey scale position (single/number) */
  Q3b?: string
  /** Q3c: Preferred Kinsey range in partners (multi-select) */
  Q3c?: string[]
  /** Q4: Relationship status (single) */
  Q4?: string
  /** Q30: Safer-sex preference tier (single) */
  Q30?: string
  /** Q30a: Safer-sex specifics (multi-select) */
  Q30a?: string[]
  /** Q31: Sexual health practices (multi-select) */
  Q31?: string[]
  /** Q26: Relational/sexual roles (multi-select) */
  Q26?: string[]
  /** Q28: Hard boundaries - absolute nos (multi-select) */
  Q28?: string[]

  // -------------------------------------------------------------------------
  // CONNECTION STYLE QUESTIONS
  // -------------------------------------------------------------------------

  /** Q11: Love languages (multi-select, ranked) */
  Q11?: string[]
  /** Q12: Conflict handling style (single) */
  Q12?: string
  /** Q37: Empathy level (single) */
  Q37?: string
  /** Q37a: Harmony preference (single) */
  Q37a?: string
  /** Q38: Jealousy level (single) */
  Q38?: string
  /** Q38a: Reactivity level (single) */
  Q38a?: string

  // -------------------------------------------------------------------------
  // SEXUAL CHEMISTRY QUESTIONS
  // -------------------------------------------------------------------------

  /** Q23: Erotic styles (multi-select) */
  Q23?: string[]
  /** Q24: Sexual experiences/interests (multi-select) */
  Q24?: string[]
  /** Q25: Importance of sexual chemistry (single) */
  Q25?: string
  /** Q25a: Preferred frequency (single) */
  Q25a?: string
  /** Q27: Physical/body preferences (multi-select) */
  Q27?: string[]
  /** Q33: Kinks/fetishes (multi-select) */
  Q33?: string[]
  /** Q33a: Kink experience level (single) */
  Q33a?: string
  /** Q34: Exploration openness (single) */
  Q34?: string
  /** Q34a: Adventure level (single) */
  Q34a?: string
  /** Q29: Activities needing discussion (multi-select) */
  Q29?: string[]

  // -------------------------------------------------------------------------
  // LIFESTYLE COMPATIBILITY QUESTIONS
  // -------------------------------------------------------------------------

  /** Q19a: Distance preference (single) - CORE */
  Q19a?: string
  /** Q19b: Mobility/travel ability (single) - CORE */
  Q19b?: string
  /** Q19c: Willingness to travel (single) - CORE */
  Q19c?: string
  /** Q36: Social energy - introversion/extroversion (single) - CORE */
  Q36?: string
  /** Q36a: Social preference specifics (single) - CORE */
  Q36a?: string
  /** Q18: Substance use/relationship (single) - CORE */
  Q18?: string
  /** Q13: Lifestyle alignment importance (single) - EXTENDED */
  Q13?: string
  /** Q13a: Languages spoken (multi-select) - CORE/CONSTRAINT */
  Q13a?: string[]
  /** Q13a_required: Whether language match is required (boolean) */
  Q13a_required?: boolean
  /** Q14a: Cultural alignment (single) - EXTENDED */
  Q14a?: string
  /** Q14b: Worldview/values (single) - EXTENDED */
  Q14b?: string
  /** Q17: Children preference (single) - EXTENDED */
  Q17?: string
  /** Q17a: Dietary needs/restrictions (multi-select) - EXTENDED */
  Q17a?: string[]
  /** Q17b: Pet situation (single) - EXTENDED */
  Q17b?: string
}

// =============================================================================
// SCORING TYPES
// =============================================================================

/**
 * Result for a single sub-component within a category.
 * Example: "Goals" sub-component within Intent category.
 */
export interface SubScore {
  /** Identifier for this sub-component (e.g., 'goals', 'exclusivity') */
  key: string
  /** Computed score for this sub-component (0-100) */
  score: number
  /** Relative weight within the category (sums to 100 within category) */
  weight: number
  /** Whether both parties had enough data to compute this score */
  matched: boolean
  /** Human-readable explanation for UI display */
  reason?: string
}

/**
 * Result for a full category (e.g., Intent Fit, Structure Fit).
 */
export interface CategoryScore {
  /** Category identifier */
  category: 'intent' | 'structure' | 'connection' | 'chemistry' | 'lifestyle'
  /** Weighted average score for this category (0-100) */
  score: number
  /** Category weight in overall calculation (before/after normalization) */
  weight: number
  /** Breakdown of sub-component scores */
  subScores: SubScore[]
  /** Coverage: what fraction of sub-components were scorable (0-1) */
  coverage: number
  /** Whether this category is included in final calculation */
  included: boolean
}

/**
 * Result of global constraint checks.
 * If passed=false, match should be blocked entirely.
 */
export interface ConstraintResult {
  /** Whether all constraints passed */
  passed: boolean
  /** Which constraint caused the block (if any) */
  blockedBy?: 'language' | 'boundaries' | 'mutual_interest'
  /** Human-readable reason for the block */
  reason?: string
}

/**
 * Compatibility tier based on overall score.
 */
export type CompatibilityTier = 'Platinum' | 'Gold' | 'Silver' | 'Bronze'

/**
 * Final compatibility result returned by the matching engine.
 */
export interface CompatibilityResult {
  /** Overall compatibility score (0-100) */
  overallScore: number
  /** Tier classification based on score */
  tier: CompatibilityTier
  /** Detailed breakdown by category */
  categories: CategoryScore[]
  /** Result of global constraint checks */
  constraints: ConstraintResult
  /** Whether Lifestyle category was included (had enough coverage) */
  lifestyleIncluded: boolean
  /** Original category weights before normalization */
  rawWeights: Record<string, number>
  /** Actual weights used after normalization (if Lifestyle excluded) */
  normalizedWeights: Record<string, number>
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input representing one partner's survey answers.
 */
export interface PartnerAnswers {
  /** Partnership ID this user belongs to */
  partnershipId: string
  /** User ID within the partnership */
  userId: string
  /** Normalized survey answers */
  answers: NormalizedAnswers
  /** Whether this user is part of a couple (affects Q6c, Q6d logic) */
  isCouple: boolean
}

/**
 * Input to the main compatibility calculation function.
 */
export interface CompatibilityInput {
  /** First partner's answers (typically "User") */
  partnerA: PartnerAnswers
  /** Second partner's answers (typically "Match") */
  partnerB: PartnerAnswers
}
