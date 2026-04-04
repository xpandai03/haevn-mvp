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
  // Emotional / independence questions (2026-03)
  'q_emotional_pace': 'Q_EMOTIONAL_PACE',
  'emotional_pace': 'Q_EMOTIONAL_PACE',
  'q_emotional_engagement': 'Q_EMOTIONAL_ENGAGEMENT',
  'emotional_engagement': 'Q_EMOTIONAL_ENGAGEMENT',
  'q_independence_balance': 'Q_INDEPENDENCE_BALANCE',
  'independence_balance': 'Q_INDEPENDENCE_BALANCE',
  // Age preference fields
  'q_age_min': 'Q_AGE_MIN',
  'q_age_max': 'Q_AGE_MAX',
  'age_min_preference': 'Q_AGE_MIN',
  'age_max_preference': 'Q_AGE_MAX',
  // Race / ethnicity fields
  'q_race_identity': 'Q_RACE_IDENTITY',
  'q_race_preference': 'Q_RACE_PREFERENCE',
  'race_identity': 'Q_RACE_IDENTITY',
  'race_preference': 'Q_RACE_PREFERENCE',
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

    // Pass through partnership metadata fields as-is (numeric, not survey data)
    if (rawKey === '_latitude' || rawKey === '_longitude') {
      (normalized as any)[rawKey] = typeof value === 'number' ? value : parseFloat(String(value))
      continue
    }

    // Resolve to canonical CSV key using hardcoded alias map
    const csvKey = resolveToCanonicalKey(rawKey)

    const isMultiSelect = MULTI_SELECT_QUESTIONS.includes(csvKey as any)

    let normalizedValue: string | string[] | undefined
    if (isMultiSelect) {
      normalizedValue = normalizeToArray(value)
    } else {
      normalizedValue = normalizeToSingle(value)
    }

    // Apply semantic value normalization (numeric→tier, display→canonical)
    normalizedValue = normalizeFieldValue(csvKey, normalizedValue as any) as any

    ;(normalized as any)[csvKey] = normalizedValue
  }

  // Handle special case: Q13a_required flag (check all key variants)
  const reqVal = raw['Q13a_required'] ?? raw['q13a_required']
  if (reqVal !== undefined && reqVal !== null) {
    normalized.Q13a_required = Boolean(reqVal)
  }

  // Enforce ShowIf conditions — strip answers for questions that should
  // not have been stored based on the user's own answer profile.
  enforceShowIf(normalized)

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
// VALUE NORMALIZATION — SEMANTIC MAPPINGS
// =============================================================================
// Maps real survey values (display strings, 1-10 scales) to canonical tier
// strings expected by the scoring engine. Without this, tierProximityScore()
// returns 50 (neutral) for unrecognized values, silently degrading scores.

/**
 * Map 1-10 numeric scales to canonical tier strings.
 * Breakpoints: 1-2 → tier[0], 3-4 → tier[1], 5-6 → tier[2], 7-8 → tier[3], 9-10 → tier[4]
 */
function numericToTier(value: number, tiers: readonly string[]): string {
  if (tiers.length === 5) {
    if (value <= 2) return tiers[0]
    if (value <= 4) return tiers[1]
    if (value <= 6) return tiers[2]
    if (value <= 8) return tiers[3]
    return tiers[4]
  }
  if (tiers.length === 6) {
    // 6-tier: 1 → [0], 2-3 → [1], 4-5 → [2], 6-7 → [3], 8-9 → [4], 10 → [5]
    if (value <= 1) return tiers[0]
    if (value <= 3) return tiers[1]
    if (value <= 5) return tiers[2]
    if (value <= 7) return tiers[3]
    if (value <= 9) return tiers[4]
    return tiers[5]
  }
  // Fallback: linear distribution
  const idx = Math.min(Math.floor((value - 1) / (10 / tiers.length)), tiers.length - 1)
  return tiers[Math.max(0, idx)]
}

// Tier arrays matching scoring engine (copied from scoring.ts and categories/*.ts)
const EXCLUSIVITY_5 = ['fully_open', 'open', 'flexible', 'mostly_exclusive', 'monogamous'] as const
const AVAILABILITY_5 = ['very_limited', 'limited', 'moderate', 'available', 'very_available'] as const
const PRIVACY_5 = ['very_open', 'open', 'moderate', 'private', 'very_private'] as const
const EMPATHY_6 = ['very_low', 'low', 'moderate', 'medium', 'high', 'very_high'] as const
const REACTIVITY_6 = ['very_low', 'low', 'moderate', 'medium', 'high', 'very_high'] as const
const SOCIAL_5 = ['very_introverted', 'introverted', 'ambivert', 'extroverted', 'very_extroverted'] as const

/**
 * Fields where numeric 1-10 values must be mapped to tier strings.
 * Key = canonical CSV key, Value = tier array (low→high direction).
 */
const NUMERIC_TO_TIER_FIELDS: Record<string, readonly string[]> = {
  'Q7':  EXCLUSIVITY_5,    // 1=fully_open → 10=monogamous
  'Q8':  EXCLUSIVITY_5,    // same scale
  'Q10a': AVAILABILITY_5,  // 1=very_limited → 10=very_available
  'Q20': PRIVACY_5,        // 1=very_open → 10=very_private (inverted: high number = more private)
  'Q36': SOCIAL_5,         // 1=very_introverted → 10=very_extroverted
  'Q36a': SOCIAL_5,        // same scale
  'Q37': EMPATHY_6,        // 1=very_low → 10=very_high
  'Q37a': EMPATHY_6,       // same scale
  'Q38': REACTIVITY_6,     // 1=very_low → 10=very_high (low jealousy = low reactivity)
  'Q38a': REACTIVITY_6,    // same scale
}

/**
 * Display string → canonical tier value mappings.
 * These handle the verbose display strings from the survey UI.
 * Matched case-insensitively via substring/prefix checks.
 */
const DISPLAY_TO_TIER: Record<string, [RegExp, string][]> = {
  'Q10': [
    [/secure/i, 'secure'],
    [/anxious.*preoccupied|preoccupied/i, 'anxious-preoccupied'],
    [/fearful.*avoidant/i, 'fearful-avoidant'],
    [/dismissive.*avoidant/i, 'dismissive-avoidant'],
    [/avoidant/i, 'avoidant'],
    [/anxious/i, 'anxious'],
  ],
  'Q12': [
    [/collaborative|work.*together|team/i, 'collaborative'],
    [/compromise|middle.*ground/i, 'compromising'],
    [/avoid|walk.*away|space/i, 'avoidant'],
    [/passive|go.*with.*flow/i, 'passive'],
    [/direct|head.*on|confront/i, 'competitive'],
    [/depends|situati/i, 'compromising'],  // "It depends on the situation" → middle ground
  ],
  'Q12a': [
    [/multiple.*daily|several.*day/i, 'very_quick'],
    [/once.*day|daily/i, 'quick'],
    [/few.*times.*week/i, 'moderate'],
    [/once.*week|weekly/i, 'slow'],
    [/rarely|when.*need/i, 'very_slow'],
  ],
  'Q15': [
    [/unlimited|very.*available/i, 'very_flexible'],
    [/quite.*bit|flexible|most/i, 'flexible'],
    [/moderate|some/i, 'moderate'],
    [/limited|busy/i, 'limited'],
    [/very.*limited|minimal/i, 'very_limited'],
  ],
  'Q19a': [
    [/same.*neighbor/i, 'same_neighborhood'],
    [/same.*city/i, 'same_city'],
    [/25.*mile|within.*25/i, 'within_30_miles'],
    [/30.*mile|within.*30/i, 'within_30_miles'],
    [/50.*mile|within.*50/i, 'within_50_miles'],
    [/100.*mile|within.*100/i, 'within_100_miles'],
    [/same.*state/i, 'same_state'],
    [/same.*region/i, 'same_region'],
    [/anywhere|any.*distance|doesn.*matter/i, 'anywhere'],
  ],
  'Q19c': [
    [/very.*mobile|travel.*frequent/i, 'frequently'],
    [/somewhat|sometimes|occasional/i, 'sometimes'],
    [/prefer.*stay|rarely|not.*very/i, 'rarely'],
    [/never|no.*travel/i, 'never'],
    [/often/i, 'often'],
  ],
  'Q25a': [
    [/multiple.*daily|every.*day.*multiple/i, 'multiple_daily'],
    [/daily|every.*day/i, 'daily'],
    [/few.*times.*week|several.*week/i, 'few_times_week'],
    [/weekly|once.*week/i, 'weekly'],
    [/few.*times.*month|couple.*month/i, 'few_times_month'],
    [/monthly|once.*month/i, 'monthly'],
    [/rarely|occasionally/i, 'few_times_year'],
  ],
  'Q9b': [
    [/open.*ready|dating.*relationship/i, 'ready'],
    [/curious|exploring|browsing/i, 'exploring'],
    [/not.*sure|figuring/i, 'unsure'],
  ],
  'Q30a': [
    [/yes.*right.*person|open.*to/i, 'open_to_it'],
    [/maybe|needs.*discussion/i, 'needs_discussion'],
    [/no|not.*interested|prefer.*not/i, 'no'],
  ],
}

// =============================================================================
// Q28 BOUNDARY CANONICALIZATION
// =============================================================================
// Maps free-text boundary strings to canonical tokens for Jaccard scoring.
// Each pattern maps one or more user phrases to a single canonical token.

const BOUNDARY_CANONICAL_MAP: [RegExp, string][] = [
  [/\bpain\b/i, 'pain'],
  [/\bblood\b/i, 'blood_play'],
  [/\bbreath/i, 'breath_play'],
  [/\bchok/i, 'choking'],
  [/\bdegrad/i, 'degradation'],
  [/\bhumiliat/i, 'humiliation'],
  [/\bbodily|urin|scat|gross/i, 'bodily_fluids'],
  [/\brough/i, 'rough_play'],
  [/\bgroup|threesome|moresome|gangbang/i, 'group_dynamics'],
  [/\bpower.*exchange|dom.*sub/i, 'power_exchange'],
  [/\bexhibit/i, 'exhibitionism'],
  [/\bpublic/i, 'public_play'],
  [/\bbondag/i, 'bondage'],
  [/\bimpact|spank|hit|slap|whip|flog/i, 'impact_play'],
  [/\bedge/i, 'edge_play'],
  [/\bdrug|substance|intoxic/i, 'substance_use'],
  [/\banal/i, 'anal_play'],
  [/\bage.*play/i, 'age_play'],
  [/\brole.*play/i, 'roleplay'],
  [/\bwax/i, 'wax_play'],
  [/\belectr/i, 'electro_play'],
  [/\bneedle|pierc/i, 'needle_play'],
  [/\bfist/i, 'fisting'],
  [/\blatex|rubber/i, 'latex'],
  [/\bfeet|foot/i, 'foot_play'],
  [/\bvoyeur/i, 'voyeurism'],
  [/\bsensor/i, 'sensory_play'],
]

/**
 * Canonicalize a free-text boundary array into canonical tokens.
 * Tokenizes comma-separated text, then maps each fragment via regex patterns.
 * Unrecognized fragments are preserved as-is (better than dropping them).
 */
function canonicalizeBoundaries(values: string[]): string[] {
  const canonical = new Set<string>()
  for (const raw of values) {
    let matched = false
    for (const [pattern, token] of BOUNDARY_CANONICAL_MAP) {
      if (pattern.test(raw)) {
        canonical.add(token)
        matched = true
      }
    }
    // Preserve unmatched values lowercase-trimmed (don't drop them)
    if (!matched && raw.trim()) {
      canonical.add(raw.toLowerCase().trim())
    }
  }
  return [...canonical]
}

// =============================================================================
// Q33 KINK READINESS NORMALIZATION
// =============================================================================
// Q33 is a SINGLE-SELECT kink readiness level, not a kink list.
// The engine incorrectly treats it as a multi-select kink array.
// Fix: map the display strings to canonical readiness tiers so the engine
// can use tier-proximity scoring instead of Jaccard on description strings.

const KINK_READINESS_MAP: [RegExp, string][] = [
  [/not.*into.*kink|prefer.*conventional|vanilla/i, 'not_interested'],
  [/prefer.*not.*say/i, 'not_interested'],
  [/curious.*new|curious.*kink/i, 'curious'],
  [/light.*exploration|playful.*restraint/i, 'beginner'],
  [/bdsm|power.*dynamic/i, 'experienced'],
  [/specific.*fetish|specific.*kink/i, 'experienced'],
]

/**
 * Apply semantic value normalization AFTER key mapping.
 * Converts numeric scales and display strings to canonical tier values.
 */
function normalizeFieldValue(csvKey: string, value: string | string[] | undefined): string | string[] | undefined {
  if (value === undefined) return undefined

  // Q28: Canonicalize free-text boundaries into standard tokens
  if (csvKey === 'Q28' && Array.isArray(value)) {
    return canonicalizeBoundaries(value)
  }

  // Q33: Map kink readiness description to canonical tier
  // The engine treats Q33 as multi-select but it's actually single-select categorical.
  // Convert the description string to a canonical readiness token array.
  if (csvKey === 'Q33' && Array.isArray(value) && value.length > 0) {
    const raw = value[0] // Single-select stored as first array element
    for (const [pattern, tier] of KINK_READINESS_MAP) {
      if (pattern.test(raw)) {
        return [tier]
      }
    }
    // If no match, preserve as-is
    return value
  }

  // Handle numeric → tier for single-value fields
  const tierMap = NUMERIC_TO_TIER_FIELDS[csvKey]
  if (tierMap) {
    const numVal = typeof value === 'string' ? parseFloat(value) : (typeof value === 'number' ? value : NaN)
    if (!isNaN(numVal) && numVal >= 1 && numVal <= 10) {
      return numericToTier(numVal, tierMap)
    }
    // If it's already a valid tier string, pass through
    if (typeof value === 'string' && tierMap.includes(value.toLowerCase() as any)) {
      return value.toLowerCase()
    }
  }

  // Handle display string → tier for single-value fields
  const displayMap = DISPLAY_TO_TIER[csvKey]
  if (displayMap && typeof value === 'string') {
    for (const [pattern, canonical] of displayMap) {
      if (pattern.test(value)) {
        return canonical
      }
    }
  }

  return value
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

// =============================================================================
// SHOW-IF ENFORCEMENT
// =============================================================================
// Strips answers for questions whose ShowIf preconditions are not met.
// This prevents hidden questions from accidentally influencing scoring.

type ShowIfCondition =
  | 'IF_COUPLE'
  | 'IF_LTR_INTENT'
  | 'IF_KINK_MODE'
  | 'IF_NON_MONO'

/**
 * Mapping of questions to their ShowIf precondition.
 * Questions not listed here are implicitly ALL (always shown).
 */
const QUESTION_SHOW_IF: Record<string, ShowIfCondition> = {
  Q6c: 'IF_COUPLE',
  Q6d: 'IF_COUPLE',
  Q7: 'IF_NON_MONO',
  Q8: 'IF_NON_MONO',
  Q13: 'IF_LTR_INTENT',
  Q14a: 'IF_LTR_INTENT',
  Q14b: 'IF_LTR_INTENT',
  Q17: 'IF_LTR_INTENT',
  Q17a: 'IF_LTR_INTENT',
  Q17b: 'IF_LTR_INTENT',
  Q33a: 'IF_KINK_MODE',
}

const COUPLE_STATUSES = [
  'dating', 'married', 'partnered', 'couple', 'in_a_couple',
  'in_relationship', 'engaged',
]

const NON_MONO_STYLES = [
  'open', 'polyamory', 'polyamorous', 'poly', 'enm',
  'ethical_non_monogamy', 'non-monogamous', 'non_monogamous',
  'dont_know_yet', 'exploring', 'relationship_anarchy',
  'monogamish',  // Monogamish users answer Q7/Q8 in the survey
]

const LTR_INTENTS = [
  'long_term', 'long-term', 'romantic', 'relationship', 'serious',
  'marriage', 'partnership', 'committed', 'ltr', 'life_partner',
]

function isCoupleFromAnswers(answers: NormalizedAnswers): boolean {
  const q4 = (answers.Q4 || '').toLowerCase().trim()
  if (!q4) return false
  return COUPLE_STATUSES.some(s => q4.includes(s))
}

function hasNonMonoStyle(answers: NormalizedAnswers): boolean {
  const styles = asArray(answers.Q6).map(v => v.toLowerCase().trim())
  return styles.some(style =>
    NON_MONO_STYLES.some(nms => style.includes(nms))
  )
}

function hasLtrIntent(answers: NormalizedAnswers): boolean {
  const intents = asArray(answers.Q9).map(v => v.toLowerCase().trim())
  return intents.some(intent =>
    LTR_INTENTS.some(ltr => intent.includes(ltr))
  )
}

function hasKinkAnswers(answers: NormalizedAnswers): boolean {
  return asArray(answers.Q33).length > 0
}

/**
 * Determine whether a question should be shown for this user.
 */
function shouldShow(questionKey: string, answers: NormalizedAnswers): boolean {
  const condition = QUESTION_SHOW_IF[questionKey]
  if (!condition) return true

  switch (condition) {
    case 'IF_COUPLE':
      return isCoupleFromAnswers(answers)
    case 'IF_NON_MONO':
      return hasNonMonoStyle(answers)
    case 'IF_LTR_INTENT':
      return hasLtrIntent(answers)
    case 'IF_KINK_MODE':
      return hasKinkAnswers(answers)
    default:
      return true
  }
}

/**
 * Enforce ShowIf conditions on normalized answers in-place.
 * Deletes answers for questions that should not have been presented
 * given the user's own profile data (Q4, Q6, Q9, Q33).
 */
function enforceShowIf(answers: NormalizedAnswers): void {
  for (const key of Object.keys(answers)) {
    if (!shouldShow(key, answers)) {
      delete (answers as Record<string, unknown>)[key]
    }
  }
}
