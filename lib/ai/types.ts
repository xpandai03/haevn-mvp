/**
 * HAEVN AI Summary System — Type Definitions
 *
 * Types for the deterministic mapping layer that converts
 * raw survey answers into safe, human-readable descriptors
 * for AI summary generation.
 */

import type { NormalizedAnswers } from '@/lib/matching/types'

/**
 * Clean, human-readable summary input for AI generation.
 *
 * Every field is a safe descriptor — no raw QIDs, no numeric scores,
 * no internal enums. Fields are optional so sparse surveys produce
 * sparse (but accurate) inputs rather than speculative ones.
 */
export interface SummaryInput {
  /** User's display name */
  first_name: string
  /** Calculated age from birthdate, omitted if unparseable */
  age?: number
  /** Human-readable relationship intent (from Q9) */
  relationship_intent?: string
  /** Human-readable relationship structure (from Q6 + Q4) */
  relationship_structure?: string
  /** Social energy / gathering preference descriptor (from Q36, Q36a) */
  social_style?: string
  /** Communication and conflict style descriptor (from Q12, Q12a, Q11) */
  communication_style?: string
  /** Dating pace / rhythm descriptor (from Q15, Q16a) */
  dating_pace?: string
  /** Overall lifestyle rhythm descriptor (from Q18, Q36, Q19a) */
  lifestyle_rhythm?: string
  /** Conservative value themes derived from strong signals only */
  values?: string[]
  /** Safe, generalized interest labels (from Q23, Q33, Q34) */
  interests?: string[]
}

/**
 * Input parameters for buildSummaryInput().
 */
export interface BuildSummaryInputParams {
  /** Normalized survey answers (same shape used by matching engine) */
  answers: NormalizedAnswers
  /** User's display name from partnerships table */
  displayName: string
}
