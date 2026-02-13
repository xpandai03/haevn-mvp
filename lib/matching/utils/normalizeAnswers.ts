/**
 * HAEVN Matching Engine - Answer Normalization
 *
 * Converts raw survey answers (from answers_json) to normalized
 * NormalizedAnswers format with consistent types.
 */

import type { RawAnswers, NormalizedAnswers } from '../types'
import { MULTI_SELECT_QUESTIONS } from '../constants/questionMappings'
import { getInternalToCsvIdMap } from '@/lib/survey/questions'

// Build mapping once at module load: internal IDs → CSV IDs
// e.g. { 'q9_intentions': 'Q9', 'q10a_emotional_availability': 'Q10a', ... }
let _internalToCsvMap: Record<string, string> | null = null
function getKeyMap(): Record<string, string> {
  if (!_internalToCsvMap) {
    _internalToCsvMap = getInternalToCsvIdMap()
  }
  return _internalToCsvMap
}

/**
 * Convert raw answers from internal key format (q9_intentions) to
 * CSV key format (Q9) that the matching engine expects.
 * Keys already in CSV format are passed through unchanged.
 */
function convertToCsvKeys(raw: RawAnswers): RawAnswers {
  const keyMap = getKeyMap()
  const converted: RawAnswers = {}

  for (const [key, value] of Object.entries(raw)) {
    const csvKey = keyMap[key] || key // Use CSV key if mapped, otherwise keep original
    converted[csvKey] = value
  }

  return converted
}

/**
 * Normalize raw survey answers to consistent typed format.
 *
 * Handles:
 * - Converting internal question IDs to CSV IDs (q9_intentions → Q9)
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

  // Convert internal IDs (q9_intentions) to CSV IDs (Q9) first
  const csvKeyed = convertToCsvKeys(raw)

  // Iterate through all known questions and normalize
  for (const [key, value] of Object.entries(csvKeyed)) {
    if (value === null || value === undefined) {
      continue
    }

    const isMultiSelect = MULTI_SELECT_QUESTIONS.includes(key as any)

    if (isMultiSelect) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (normalized as any)[key] = normalizeToArray(value)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (normalized as any)[key] = normalizeToSingle(value)
    }
  }

  // Handle special case: Q13a_required flag
  if (csvKeyed.Q13a_required !== undefined) {
    normalized.Q13a_required = Boolean(csvKeyed.Q13a_required)
  }

  return normalized
}

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
