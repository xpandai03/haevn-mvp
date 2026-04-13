// REVISION: Matching Model Update per Rik spec 04-10-2026
/**
 * HAEVN Matching Engine - Row Classification Map
 *
 * Maps every scored row to its classification tier, concept key,
 * primary/secondary status, and penalty mode. Used for:
 *
 * 1. Classification multipliers (major=1.0, moderate=0.6, light=0.2)
 * 2. Cross-section duplicate concept suppression (non-primary × 0.33)
 * 3. Scoring function selection (overlap_soft vs strict vs tolerant)
 */

import type { RowMetadata } from '../types'

type RowKey =
  // Intent (7 rows)
  | 'intent.goals' | 'intent.style' | 'intent.exclusivity'
  | 'intent.attachment' | 'intent.timing' | 'intent.privacy' | 'intent.haevnUse'
  // Structure (6 rows)
  | 'structure.orientation' | 'structure.status' | 'structure.boundaries'
  | 'structure.saferSex' | 'structure.roles' | 'structure.fidelity'
  // Connection (6 rows)
  | 'connection.attachment' | 'connection.communication' | 'connection.emotional'
  | 'connection.privacy' | 'connection.emotionalPace' | 'connection.emotionalEngagement'
  // Chemistry (6 rows)
  | 'chemistry.eroticProfile' | 'chemistry.rolesKinks' | 'chemistry.frequency'
  | 'chemistry.boundaries' | 'chemistry.physicalPreferences' | 'chemistry.exploration'
  // Lifestyle (12 rows — 11 original + 1 new ageRange)
  | 'lifestyle.distance' | 'lifestyle.privacy' | 'lifestyle.socialEnergy'
  | 'lifestyle.substances' | 'lifestyle.languages' | 'lifestyle.independenceBalance'
  | 'lifestyle.lifestyleImportance' | 'lifestyle.cultural' | 'lifestyle.children'
  | 'lifestyle.dietary' | 'lifestyle.pets' | 'lifestyle.ageRange'

export const CLASSIFICATION_MAP: Record<RowKey, RowMetadata> = {
  // ===========================================================================
  // INTENT FIT (7 rows)
  // ===========================================================================
  'intent.goals': {
    classification: 'major',
    concept_key: 'goals',
    is_primary_concept: true,
    penalty_mode: 'overlap_soft',
  },
  'intent.style': {
    classification: 'major',
    concept_key: 'relationship_style',
    is_primary_concept: true,
    penalty_mode: 'overlap_soft',
  },
  'intent.exclusivity': {
    classification: 'major',
    concept_key: 'exclusivity',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'intent.attachment': {
    classification: 'moderate',
    concept_key: 'attachment',
    is_primary_concept: false,
    penalty_mode: 'tolerant',
  },
  'intent.timing': {
    classification: 'moderate',
    concept_key: 'timing',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'intent.privacy': {
    classification: 'light',
    concept_key: 'privacy',
    is_primary_concept: false,
    penalty_mode: 'tolerant',
  },
  'intent.haevnUse': {
    classification: 'light',
    concept_key: 'haevn_use',
    is_primary_concept: true,
    penalty_mode: 'overlap_soft',
  },

  // ===========================================================================
  // STRUCTURE FIT (6 rows)
  // ===========================================================================
  'structure.orientation': {
    classification: 'major',
    concept_key: 'orientation',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'structure.status': {
    classification: 'major',
    concept_key: 'relationship_status',
    is_primary_concept: true,
    penalty_mode: 'strict',
  },
  'structure.boundaries': {
    classification: 'moderate',
    concept_key: 'boundaries',
    is_primary_concept: false,
    penalty_mode: 'tolerant',
  },
  'structure.saferSex': {
    classification: 'major',
    concept_key: 'safer_sex',
    is_primary_concept: true,
    penalty_mode: 'strict',
  },
  'structure.roles': {
    classification: 'moderate',
    concept_key: 'roles',
    is_primary_concept: false,
    penalty_mode: 'tolerant',
  },
  'structure.fidelity': {
    classification: 'major',
    concept_key: 'fidelity',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },

  // ===========================================================================
  // CONNECTION STYLE (6 rows)
  // ===========================================================================
  'connection.attachment': {
    classification: 'major',
    concept_key: 'attachment',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'connection.communication': {
    classification: 'major',
    concept_key: 'communication',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'connection.emotional': {
    classification: 'major',
    concept_key: 'emotional_style',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'connection.privacy': {
    classification: 'light',
    concept_key: 'privacy',
    is_primary_concept: false,
    penalty_mode: 'tolerant',
  },
  'connection.emotionalPace': {
    classification: 'moderate',
    concept_key: 'emotional_pace',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'connection.emotionalEngagement': {
    classification: 'moderate',
    concept_key: 'emotional_engagement',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },

  // ===========================================================================
  // SEXUAL CHEMISTRY (6 rows)
  // ===========================================================================
  'chemistry.eroticProfile': {
    classification: 'moderate',
    concept_key: 'erotic_profile',
    is_primary_concept: true,
    penalty_mode: 'overlap_soft',
  },
  'chemistry.rolesKinks': {
    classification: 'moderate',
    concept_key: 'roles',
    is_primary_concept: true,
    penalty_mode: 'overlap_soft',
  },
  'chemistry.frequency': {
    classification: 'moderate',
    concept_key: 'frequency',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'chemistry.boundaries': {
    classification: 'light',
    concept_key: 'boundaries',
    is_primary_concept: false,
    penalty_mode: 'tolerant',
  },
  'chemistry.physicalPreferences': {
    classification: 'light',
    concept_key: 'physical_preferences',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'chemistry.exploration': {
    classification: 'moderate',
    concept_key: 'exploration',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },

  // ===========================================================================
  // LIFESTYLE COMPATIBILITY (12 rows — includes new ageRange)
  // ===========================================================================
  'lifestyle.distance': {
    classification: 'moderate',
    concept_key: 'distance',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'lifestyle.privacy': {
    classification: 'light',
    concept_key: 'privacy',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'lifestyle.socialEnergy': {
    classification: 'moderate',
    concept_key: 'social_energy',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'lifestyle.substances': {
    classification: 'moderate',
    concept_key: 'substances',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'lifestyle.languages': {
    classification: 'light',
    concept_key: 'languages',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'lifestyle.independenceBalance': {
    classification: 'light',
    concept_key: 'independence',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'lifestyle.lifestyleImportance': {
    classification: 'light',
    concept_key: 'lifestyle_importance',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'lifestyle.cultural': {
    classification: 'moderate',
    concept_key: 'cultural_fit',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'lifestyle.children': {
    classification: 'moderate',
    concept_key: 'children',
    is_primary_concept: true,
    penalty_mode: 'strict',
  },
  'lifestyle.dietary': {
    classification: 'light',
    concept_key: 'dietary',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'lifestyle.pets': {
    classification: 'light',
    concept_key: 'pets',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
  'lifestyle.ageRange': {
    classification: 'moderate',
    concept_key: 'age_range',
    is_primary_concept: true,
    penalty_mode: 'tolerant',
  },
} as const

/**
 * Lookup a row's classification metadata.
 * Returns undefined for unknown keys (should never happen if map is complete).
 */
export function getRowMetadata(section: string, key: string): RowMetadata | undefined {
  return CLASSIFICATION_MAP[`${section}.${key}` as RowKey]
}

/**
 * Get all rows for a given section.
 */
export function getRowsForSection(section: string): Array<{ key: string; metadata: RowMetadata }> {
  return Object.entries(CLASSIFICATION_MAP)
    .filter(([k]) => k.startsWith(`${section}.`))
    .map(([k, v]) => ({ key: k.split('.')[1], metadata: v }))
}
