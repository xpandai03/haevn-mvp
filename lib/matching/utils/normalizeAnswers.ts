/**
 * HAEVN Matching Engine - Answer Normalization
 *
 * Converts raw survey answers (from answers_json) to normalized
 * NormalizedAnswers format with consistent types.
 *
 * Uses a HARDCODED key alias map so key resolution never depends
 * on runtime imports from the survey module. This is bulletproof
 * in serverless environments (Vercel).
 */

import type { RawAnswers, NormalizedAnswers } from '../types'
import { MULTI_SELECT_QUESTIONS } from '../constants/questionMappings'

// =============================================================================
// HARDCODED KEY ALIAS MAP
// =============================================================================
// Maps every known internal survey question ID to its canonical CSV ID.
// This is the SINGLE SOURCE OF TRUTH for key resolution in the matching engine.
// DO NOT import from @/lib/survey/questions — that dependency is fragile at runtime.

const INTERNAL_TO_CSV: Record<string, string> = {
  'q1_age': 'Q1',
  'q2_gender_identity': 'Q2',
  'q2a_pronouns': 'Q2a',
  'q3_sexual_orientation': 'Q3',
  'q3a_fidelity': 'Q3a',
  'q3b_kinsey_scale': 'Q3b',
  'q3c_partner_kinsey_preference': 'Q3c',
  'q4_relationship_status': 'Q4',
  'q6_relationship_styles': 'Q6',
  'q6a_connection_type': 'Q6a',
  'q6b_who_to_meet': 'Q6b',
  'q6c_couple_connection': 'Q6c',
  'q6d_couple_permissions': 'Q6d',
  'q7_emotional_exclusivity': 'Q7',
  'q8_sexual_exclusivity': 'Q8',
  'q9_intentions': 'Q9',
  'q9a_sex_or_more': 'Q9a',
  'q9b_dating_readiness': 'Q9b',
  'q10_attachment_style': 'Q10',
  'q10a_emotional_availability': 'Q10a',
  'q11_love_languages': 'Q11',
  'q12_conflict_resolution': 'Q12',
  'q12a_messaging_pace': 'Q12a',
  'q13_lifestyle_alignment': 'Q13',
  'q13a_languages': 'Q13a',
  'q14a_cultural_alignment': 'Q14a',
  'q14b_cultural_identity': 'Q14b',
  'q15_time_availability': 'Q15',
  'q16_typical_availability': 'Q16',
  'q16a_first_meet_preference': 'Q16a',
  'q18_substances': 'Q18',
  'q19a_max_distance': 'Q19a',
  'q19b_distance_priority': 'Q19b',
  'q19c_mobility': 'Q19c',
  'q20_discretion': 'Q20',
  'q20a_photo_sharing': 'Q20a',
  'q20b_how_out': 'Q20b',
  'q21_platform_use': 'Q21',
  'q22_spirituality_sexuality': 'Q22',
  'q23_erotic_styles': 'Q23',
  'q24_experiences': 'Q24',
  'q25_chemistry_vs_emotion': 'Q25',
  'q25a_frequency': 'Q25a',
  'q26_roles': 'Q26',
  'q27_body_type_self': 'Q27',
  'q27_body_type_preferences': 'Q27b',
  'q28_hard_boundaries': 'Q28',
  'q29_maybe_boundaries': 'Q29',
  'q30_safer_sex': 'Q30',
  'q30a_fluid_bonding': 'Q30a',
  'q31_health_testing': 'Q31',
  'q32_looking_for': 'Q32',
  'q33_kinks': 'Q33',
  'q33a_experience_level': 'Q33a',
  'q34_exploration': 'Q34',
  'q34a_variety': 'Q34a',
  'q35_agreements': 'Q35',
  'q35a_structure': 'Q35a',
  'q36_social_energy': 'Q36',
  'q36a_outgoing': 'Q36a',
  'q37_empathy': 'Q37',
  'q37a_harmony': 'Q37a',
  'q38_jealousy': 'Q38',
  'q38a_emotional_reactive': 'Q38a',
}

// Build a case-insensitive lookup at module load.
// Maps ANY key variant (internal ID, CSV ID, lowercase) → canonical CSV key.
const KEY_RESOLVER = new Map<string, string>()

// Add internal → CSV mappings (case-insensitive)
for (const [internal, csv] of Object.entries(INTERNAL_TO_CSV)) {
  KEY_RESOLVER.set(internal.toLowerCase(), csv)
}

// Add CSV keys as identity mappings (case-insensitive)
// e.g., 'q9' → 'Q9', 'q10a' → 'Q10a'
for (const csv of new Set(Object.values(INTERNAL_TO_CSV))) {
  KEY_RESOLVER.set(csv.toLowerCase(), csv)
}

/**
 * Resolve any raw answer key to its canonical CSV key.
 * Handles: internal IDs, CSV IDs, case variations.
 * Falls back to the original key if no mapping found.
 */
export function resolveToCanonicalKey(rawKey: string): string {
  return KEY_RESOLVER.get(rawKey.toLowerCase()) || rawKey
}

// =============================================================================
// MAIN NORMALIZATION
// =============================================================================

/**
 * Normalize raw survey answers to consistent typed format.
 *
 * Handles:
 * - Converting internal question IDs to CSV IDs (q9_intentions → Q9)
 *   via hardcoded alias map (no runtime dependency on survey module)
 * - Case-insensitive key resolution
 * - Converting single values to arrays for multi-select questions
 * - Converting arrays to single values for single-select questions
 * - Handling null/undefined values
 * - Type coercion for legacy data formats
 *
 * @param raw - Raw answers from survey_responses.answers_json
 * @returns Normalized answers with consistent types
 */
export function normalizeAnswers(raw: RawAnswers): NormalizedAnswers {
  const normalized: NormalizedAnswers = {}

  for (const [rawKey, value] of Object.entries(raw)) {
    if (value === null || value === undefined) {
      continue
    }

    // Resolve to canonical CSV key using hardcoded alias map
    const csvKey = resolveToCanonicalKey(rawKey)

    const isMultiSelect = MULTI_SELECT_QUESTIONS.includes(csvKey as any)

    if (isMultiSelect) {
      (normalized as any)[csvKey] = normalizeToArray(value)
    } else {
      (normalized as any)[csvKey] = normalizeToSingle(value)
    }
  }

  // Handle special case: Q13a_required flag (check all key variants)
  const reqVal = raw['Q13a_required'] ?? raw['q13a_required']
  if (reqVal !== undefined && reqVal !== null) {
    normalized.Q13a_required = Boolean(reqVal)
  }

  return normalized
}

/**
 * Validate that normalized answers contain expected scoring keys.
 * Returns a diagnostic object for logging.
 */
export function validateNormalizedAnswers(
  answers: NormalizedAnswers,
  label: string
): { label: string; keyCount: number; hasQ9: boolean; hasQ6: boolean; hasQ10: boolean; hasQ10a: boolean; hasQ20: boolean; missingCritical: string[] } {
  const keys = Object.keys(answers)
  const criticalKeys = ['Q9', 'Q6', 'Q10', 'Q10a', 'Q20', 'Q3', 'Q23', 'Q26'] as const
  const missingCritical = criticalKeys.filter(k => (answers as any)[k] === undefined)

  return {
    label,
    keyCount: keys.length,
    hasQ9: (answers as any).Q9 !== undefined,
    hasQ6: (answers as any).Q6 !== undefined,
    hasQ10: (answers as any).Q10 !== undefined,
    hasQ10a: (answers as any).Q10a !== undefined,
    hasQ20: (answers as any).Q20 !== undefined,
    missingCritical,
  }
}

// =============================================================================
// VALUE NORMALIZERS
// =============================================================================

/**
 * Convert a value to an array format.
 */
function normalizeToArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    // Handle comma-separated strings
    if (value.includes(',')) {
      return value.split(',').map(s => s.trim()).filter(Boolean)
    }
    return [value]
  }
  if (typeof value === 'number') {
    return [String(value)]
  }
  return []
}

/**
 * Convert a value to a single string format.
 */
function normalizeToSingle(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.toString()
  }
  if (typeof value === 'string' && value.trim()) {
    return value
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (typeof value === 'boolean') {
    return String(value)
  }
  return undefined
}

// =============================================================================
// ANSWER ACCESS HELPERS
// =============================================================================

/**
 * Check if a normalized answer has a value (not empty).
 */
export function hasAnswer(value: string | string[] | undefined | boolean): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return false
}

/**
 * Get a normalized answer as an array (even if stored as single).
 */
export function asArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  return [value]
}

/**
 * Get a normalized answer as a single value (first if array).
 */
export function asSingle(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined
  if (Array.isArray(value)) return value[0]
  return value
}

/**
 * Check if both partners have answered a specific question.
 */
export function bothAnswered(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers,
  questionKey: keyof NormalizedAnswers
): boolean {
  const userVal = userAnswers[questionKey]
  const matchVal = matchAnswers[questionKey]
  return hasAnswer(userVal as any) && hasAnswer(matchVal as any)
}

/**
 * Check if both partners have answered any of the given questions.
 */
export function bothAnsweredAny(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers,
  questionKeys: (keyof NormalizedAnswers)[]
): boolean {
  return questionKeys.some(key => bothAnswered(userAnswers, matchAnswers, key))
}

/**
 * Get answers for a question from both partners.
 * Returns null if either hasn't answered.
 */
export function getBothAnswers<T extends string | string[] | boolean | undefined>(
  userAnswers: NormalizedAnswers,
  matchAnswers: NormalizedAnswers,
  questionKey: keyof NormalizedAnswers
): { user: T; match: T } | null {
  const userVal = userAnswers[questionKey] as T
  const matchVal = matchAnswers[questionKey] as T

  if (!hasAnswer(userVal as any) || !hasAnswer(matchVal as any)) {
    return null
  }

  return { user: userVal, match: matchVal }
}

/**
 * Safely get an array answer, returning empty array if not present.
 */
export function getArrayAnswer(
  answers: NormalizedAnswers,
  key: keyof NormalizedAnswers
): string[] {
  const val = answers[key]
  return asArray(val as string | string[] | undefined)
}

/**
 * Safely get a string answer, returning undefined if not present.
 */
export function getStringAnswer(
  answers: NormalizedAnswers,
  key: keyof NormalizedAnswers
): string | undefined {
  const val = answers[key]
  return asSingle(val as string | string[] | undefined)
}
