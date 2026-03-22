/**
 * HAEVN AI Summary System — Deterministic Mapping Layer
 *
 * Converts normalized survey answers into safe, human-readable
 * descriptors for AI summary generation.
 *
 * CRITICAL DESIGN RULES:
 * - No raw QIDs, scores, or internal enums in output
 * - No guessing — omit fields when data is weak
 * - No LLM calls — purely deterministic
 * - Every output string must be human-readable as-is
 */

import type { NormalizedAnswers } from '@/lib/matching/types'
import type { SummaryInput, BuildSummaryInputParams } from './types'
import { asArray, asSingle } from '@/lib/matching/utils/normalizeAnswers'

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Build a clean SummaryInput from normalized survey answers.
 *
 * Returns only fields that can be confidently derived from the data.
 * Prefers sparse-but-accurate over full-but-speculative.
 */
export function buildSummaryInput(params: BuildSummaryInputParams): SummaryInput {
  const { answers, displayName } = params

  const result: SummaryInput = {
    first_name: displayName || 'This user',
  }

  const age = extractAge(answers)
  if (age !== undefined) result.age = age

  const intent = mapRelationshipIntent(answers)
  if (intent) result.relationship_intent = intent

  const structure = mapRelationshipStructure(answers)
  if (structure) result.relationship_structure = structure

  const social = mapSocialStyle(answers)
  if (social) result.social_style = social

  const comm = mapCommunicationStyle(answers)
  if (comm) result.communication_style = comm

  const pace = mapDatingPace(answers)
  if (pace) result.dating_pace = pace

  const rhythm = mapLifestyleRhythm(answers)
  if (rhythm) result.lifestyle_rhythm = rhythm

  const values = mapValues(answers)
  if (values.length > 0) result.values = values

  const interests = mapInterests(answers)
  if (interests.length > 0) result.interests = interests

  return result
}

/**
 * Count how many optional fields are populated in a SummaryInput.
 * Useful for determining if fallback summaries should be used.
 */
export function countPopulatedSummaryFields(input: SummaryInput): number {
  let count = 0
  if (input.age !== undefined) count++
  if (input.relationship_intent) count++
  if (input.relationship_structure) count++
  if (input.social_style) count++
  if (input.communication_style) count++
  if (input.dating_pace) count++
  if (input.lifestyle_rhythm) count++
  if (input.values && input.values.length > 0) count++
  if (input.interests && input.interests.length > 0) count++
  return count
}

// =============================================================================
// FIELD MAPPERS
// =============================================================================

/**
 * Extract age from Q1 (birthdate string or numeric).
 * Returns undefined if unparseable.
 */
export function extractAge(answers: NormalizedAnswers): number | undefined {
  const q1 = asSingle(answers.Q1 as string | string[] | undefined)
  if (!q1) return undefined

  // Birthdate format: contains / or - with length > 4
  if (q1.includes('/') || (q1.includes('-') && q1.length > 4)) {
    const birth = new Date(q1)
    if (isNaN(birth.getTime())) return undefined
    const now = new Date()
    let age = now.getFullYear() - birth.getFullYear()
    const m = now.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
    if (age < 18 || age > 120) return undefined
    return age
  }

  // Numeric age
  const num = parseFloat(q1)
  if (isNaN(num) || num < 18 || num > 120) return undefined
  return Math.floor(num)
}

// =============================================================================
// INTENT MAPPING TABLES
// =============================================================================

// Q9 option → human-readable label
const INTENT_MAP: Record<string, string> = {
  'long-term partnership': 'long-term partnership',
  'long_term_partnership': 'long-term partnership',
  'long_term': 'long-term partnership',
  'casual dating': 'casual dating',
  'casual_dating': 'casual dating',
  'play partners': 'play partner connection',
  'play_partners': 'play partner connection',
  'community': 'social and community connection',
  'friendship': 'friendship',
  'learning/exploration': 'learning and exploration',
  'learning_exploration': 'learning and exploration',
  'not sure yet': 'open exploration',
  'not_sure_yet': 'open exploration',
}

/**
 * Map Q9 connection goals to human-readable intent string.
 * Combines multiple intents conservatively.
 */
export function mapRelationshipIntent(answers: NormalizedAnswers): string | undefined {
  const raw = asArray(answers.Q9)
  if (raw.length === 0) return undefined

  const labels = raw
    .map(v => INTENT_MAP[v.toLowerCase().trim()] ?? null)
    .filter((v): v is string => v !== null)

  if (labels.length === 0) return undefined
  if (labels.length === 1) return capitalize(labels[0])

  // Combine: primary + "open to" secondary
  const primary = capitalize(labels[0])
  if (labels.length === 2) {
    return `${primary}, open to ${labels[1]}`
  }
  return `${primary}, also open to ${labels.slice(1).join(' and ')}`
}

// =============================================================================
// STRUCTURE MAPPING
// =============================================================================

const STRUCTURE_MAP: Record<string, string> = {
  'monogamous': 'monogamous',
  'monogamish': 'monogamish',
  'enm': 'ethically non-monogamous',
  'polyamorous': 'polyamorous',
  'open': 'open',
  'exploring': 'exploring relationship styles',
}

const STATUS_MAP: Record<string, string> = {
  'single': 'currently single',
  'dating': 'currently dating',
  'married': 'currently married',
  'partnered': 'currently partnered',
  'couple': 'in a couple',
  'in a polycule': 'in a polycule',
  'in_a_polycule': 'in a polycule',
  'solo poly': 'solo polyamorous',
  'solo_poly': 'solo polyamorous',
  'exploring': 'currently exploring',
}

/**
 * Map Q6 (structure) + Q4 (status) into a combined descriptor.
 */
export function mapRelationshipStructure(answers: NormalizedAnswers): string | undefined {
  const structures = asArray(answers.Q6)
  const status = asSingle(answers.Q4 as string | string[] | undefined)

  const structLabels = structures
    .map(v => STRUCTURE_MAP[v.toLowerCase().trim()] ?? null)
    .filter((v): v is string => v !== null)

  const statusLabel = status
    ? STATUS_MAP[status.toLowerCase().trim()] ?? null
    : null

  if (structLabels.length === 0 && !statusLabel) return undefined

  const structPart = structLabels.length > 0
    ? capitalize(structLabels[0])
    : null

  if (structPart && statusLabel) {
    return `${structPart}, ${statusLabel}`
  }
  if (structPart) return structPart
  if (statusLabel) return capitalize(statusLabel)

  return undefined
}

// =============================================================================
// SOCIAL STYLE MAPPING
// =============================================================================

/**
 * Map Q36 (slider 1-10) + Q36a (slider 1-10) into social style descriptor.
 * Sliders are stored as string numbers in normalized answers.
 */
export function mapSocialStyle(answers: NormalizedAnswers): string | undefined {
  const q36 = parseSlider(asSingle(answers.Q36 as string | string[] | undefined))
  const q36a = parseSlider(asSingle(answers.Q36a as string | string[] | undefined))

  // Use primary Q36 as the anchor
  const score = q36 ?? q36a
  if (score === null) return undefined

  if (score <= 3) return 'Prefers one-on-one or small group settings'
  if (score <= 5) return 'Comfortable in both social and quieter environments'
  if (score <= 7) return 'Enjoys a mix of social and personal time'
  return 'Enjoys active social environments and meeting new people'
}

// =============================================================================
// COMMUNICATION STYLE MAPPING
// =============================================================================

const CONFLICT_MAP: Record<string, string> = {
  'address immediately and directly': 'direct',
  'take time to cool down first': 'reflective',
  'seek mediation or help': 'collaborative',
  'avoid if possible': 'conflict-avoidant',
  'it depends on the situation': 'adaptive',
}

const PACE_MAP: Record<string, string> = {
  'constant communication': 'highly responsive',
  'multiple times daily': 'responsive',
  'once a day': 'steady',
  'every few days': 'deliberate',
  'only when meeting in person': 'in-person focused',
  'flexible': 'flexible',
}

/**
 * Map Q12 (conflict) + Q12a (messaging pace) + Q11 (love languages)
 * into a compact communication style descriptor.
 */
export function mapCommunicationStyle(answers: NormalizedAnswers): string | undefined {
  const conflict = asSingle(answers.Q12 as string | string[] | undefined)
  const pace = asSingle(answers.Q12a as string | string[] | undefined)
  const languages = asArray(answers.Q11)

  const parts: string[] = []

  if (conflict) {
    const label = CONFLICT_MAP[conflict.toLowerCase().trim()]
    if (label) parts.push(label)
  }

  if (pace) {
    const label = PACE_MAP[pace.toLowerCase().trim()]
    if (label && !parts.includes(label)) parts.push(label)
  }

  if (parts.length === 0) return undefined

  let result = capitalize(parts.join(' and '))

  // Add primary love language if it adds value
  if (languages.length > 0) {
    const primary = languages[0].toLowerCase().trim()
    if (primary && primary !== 'receiving gifts') {
      result += `, values ${primary}`
    }
  }

  return result
}

// =============================================================================
// DATING PACE MAPPING
// =============================================================================

const AVAILABILITY_MAP: Record<string, string> = {
  "unlimited - i'm very available": 'very available and open to frequent connection',
  'several days a week': 'available for regular connection',
  'once or twice a week': 'comfortable with a balanced pace',
  'a few times a month': 'prefers connection to build gradually',
  'once a month or less': 'prefers a slow, intentional pace',
  'it varies greatly': 'flexible about pacing',
}

/**
 * Map Q15 (time availability) + Q16a (first meet preference) into dating pace.
 */
export function mapDatingPace(answers: NormalizedAnswers): string | undefined {
  const avail = asSingle(answers.Q15 as string | string[] | undefined)
  if (!avail) return undefined

  const label = AVAILABILITY_MAP[avail.toLowerCase().trim()]
  return label ? capitalize(label) : undefined
}

// =============================================================================
// LIFESTYLE RHYTHM MAPPING
// =============================================================================

/**
 * Map Q18 (substances) + Q36 (social energy slider) + Q19a (distance)
 * into an overall lifestyle rhythm descriptor.
 */
export function mapLifestyleRhythm(answers: NormalizedAnswers): string | undefined {
  const socialScore = parseSlider(asSingle(answers.Q36 as string | string[] | undefined))
  const substances = asArray(answers.Q18)
  const distance = asSingle(answers.Q19a as string | string[] | undefined)

  // Build rhythm from social energy as anchor
  if (socialScore !== null) {
    if (socialScore <= 3) return 'Prefers a quieter, more relaxed rhythm'
    if (socialScore <= 5) return 'Balanced between going out and staying in'
    if (socialScore <= 7) return 'Leans toward an active and social lifestyle'
    return 'Enjoys a highly active and outgoing lifestyle'
  }

  // Fallback: infer from substance and distance signals
  const isSober = substances.some(s => s.toLowerCase().includes('sober'))
  const isLocal = distance?.toLowerCase().includes('neighborhood')

  if (isSober && isLocal) return 'Prefers a quieter, locally rooted lifestyle'
  if (isSober) return 'Values a grounded, intentional lifestyle'

  return undefined
}

// =============================================================================
// VALUES MAPPING
// =============================================================================

const ATTACHMENT_VALUES: Record<string, string[]> = {
  'secure': ['stability', 'emotional balance'],
  'anxious': ['closeness', 'emotional connection'],
  'avoidant': ['independence', 'personal space'],
  'disorganized': ['understanding', 'patience'],
}

/**
 * Map Q10 (attachment), Q37 (empathy slider), Q14a (cultural slider)
 * into an array of conservative value themes.
 *
 * Only includes values when signals are strong. Prefers fewer over more.
 */
export function mapValues(answers: NormalizedAnswers): string[] {
  const values: string[] = []

  // Q10: attachment style → values
  const attachment = asSingle(answers.Q10 as string | string[] | undefined)
  if (attachment) {
    // Extract the label before the dash: "Secure - I'm comfortable..."
    const key = attachment.split('-')[0]?.trim().toLowerCase() ??
                attachment.split('–')[0]?.trim().toLowerCase()
    const mapped = key ? ATTACHMENT_VALUES[key] : undefined
    if (mapped) values.push(...mapped)
  }

  // Q37: empathy slider — only add if strong signal (7+)
  const empathy = parseSlider(asSingle(answers.Q37 as string | string[] | undefined))
  if (empathy !== null && empathy >= 7) {
    values.push('empathy')
  }

  // Q14a: cultural alignment slider — only add if strong signal (7+)
  const cultural = parseSlider(asSingle(answers.Q14a as string | string[] | undefined))
  if (cultural !== null && cultural >= 7) {
    values.push('shared cultural values')
  }

  // Q9: intent can imply values
  const intents = asArray(answers.Q9).map(v => v.toLowerCase().trim())
  if (intents.includes('long-term partnership') || intents.includes('long_term_partnership')) {
    if (!values.includes('intentional connection')) {
      values.push('intentional connection')
    }
  }

  // Deduplicate
  return [...new Set(values)]
}

// =============================================================================
// INTERESTS MAPPING
// =============================================================================

// Q23 erotic styles → safe, generalized labels
const EROTIC_SAFE_MAP: Record<string, string> = {
  'sensual': 'sensual connection',
  'playful': 'playful connection',
  'romantic': 'romantic connection',
  'kinky': 'kink-aware exploration',
  'experimental': 'open to new experiences',
  'tantric': 'mindful intimacy',
  'primal': 'physical connection',
  'still exploring': 'exploring preferences',
  // 'vanilla' is omitted — not an interest label, it's a baseline
}

// Q33 kink level → safe label (only meaningful ones)
const KINK_SAFE_MAP: Record<string, string> = {
  "i'm curious about kink but new to it": 'curious about exploration',
  'i enjoy some light exploration (e.g., playful restraint, role play)': 'light exploration',
  "i'm into bdsm and/or power dynamics": 'power dynamics',
  "i have specific fetishes or kinks i'd like to explore": 'specific interests to explore',
  // "not into kink" and "prefer not to say" → omit
}

/**
 * Map Q23 (erotic styles) + Q33 (kink level) + Q34 (exploration slider)
 * into safe, generalized interest labels.
 *
 * CRITICAL: No explicit sexual content or overly sensitive phrasing.
 * Labels must be platform-safe and high-level.
 */
export function mapInterests(answers: NormalizedAnswers): string[] {
  const interests: string[] = []

  // Q23: erotic styles → safe labels
  const eroticRaw = asArray(answers.Q23)
  for (const style of eroticRaw) {
    const safe = EROTIC_SAFE_MAP[style.toLowerCase().trim()]
    if (safe) interests.push(safe)
  }

  // Q33: kink level → safe label
  const kink = asSingle(answers.Q33 as string | string[] | undefined)
  if (kink) {
    const safe = KINK_SAFE_MAP[kink.toLowerCase().trim()]
    if (safe && !interests.includes(safe)) interests.push(safe)
  }

  // Q34: exploration slider — add if high (7+)
  const exploration = parseSlider(asSingle(answers.Q34 as string | string[] | undefined))
  if (exploration !== null && exploration >= 7) {
    if (!interests.includes('open to new experiences')) {
      interests.push('open to new experiences')
    }
  }

  // Cap at 4 interests to keep it concise
  return [...new Set(interests)].slice(0, 4)
}

// =============================================================================
// HELPERS
// =============================================================================

/** Parse a slider value (string "1"-"10") to a number, or null. */
function parseSlider(val: string | undefined): number | null {
  if (!val) return null
  const n = parseFloat(val)
  if (isNaN(n) || n < 1 || n > 10) return null
  return n
}

/** Capitalize first letter of a string. */
function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}
