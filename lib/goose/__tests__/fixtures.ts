/**
 * Synthetic survey answers for Goose tests (no real member data).
 *
 * base(): scripts/seed-synthetic-users.ts baseAnswers() — passes every hard
 * gate. Non-gate personality fields vary with i so scores spread.
 * gatedAgainstBase(): shares no connection intent with base() → the CORE_INTENT
 * hard gate blocks every pair with a base member (engine returns 0).
 */

import type { SeedMember } from './memoryRepo'

export function base(i: number): Record<string, unknown> {
  return {
    q1_age: '1990-05-15', q2_gender_identity: 'Non-binary', q2a_pronouns: 'they/them',
    q3_sexual_orientation: ['Bisexual', 'Pansexual'], q3a_fidelity: 'open_communication', q3b_kinsey_scale: '3',
    q3c_partner_kinsey_preference: ['No preference'], q4_relationship_status: 'partnered',
    q6_relationship_styles: ['ENM', 'Polyamorous'], q6a_connection_type: ['As an individual'],
    q6b_who_to_meet: ['Individuals', 'Couples'], q6c_couple_connection: 'Mix together + solo',
    q6d_couple_permissions: 'equal_autonomy', q7_emotional_exclusivity: 'flexible', q8_sexual_exclusivity: 'open',
    q9_intentions: ['Long-term partnership', 'Community', 'Friendship'], q9a_sex_or_more: 'both_equally',
    q9b_dating_readiness: 'ready', q10_attachment_style: 'secure', q10a_emotional_availability: 'very_available',
    q11_love_languages: ['Quality time', 'Physical touch', 'Words of affirmation'],
    q12_conflict_resolution: i % 3 === 0 ? 'collaborative' : 'passive', q12a_messaging_pace: 'moderate',
    q13_lifestyle_alignment: 'important', q13a_languages: 'English', q14a_cultural_alignment: 1 + (i % 9),
    q15_time_availability: i % 2 ? 'weekly' : 'monthly', q16_typical_availability: ['Weekday evenings', 'Weekends'],
    q16a_first_meet_preference: 'Walk or coffee', Q17: 'no_children', Q17a: ['omnivore'], Q17b: 'has_pets',
    q18_substances: 'social_drinker', q19a_max_distance: 'within_30_miles', q19b_distance_priority: 'moderate',
    q19c_mobility: 'often', q20_discretion: 'moderate', q20a_photo_sharing: 'After chatting', q20b_how_out: 'selective',
    q21_platform_use: ['Dating', 'Community', 'Exploration'], q22_spirituality_sexuality: 'Somewhat connected',
    q23_erotic_styles: ['Sensual', 'Playful', 'Romantic'], q24_experiences: ['Private encounters', 'Workshops'],
    q25_chemistry_vs_emotion: 'both_equally', q25a_frequency: 'few_times_week', q26_roles: ['Verse/Switch'],
    q27_body_type_self: 'Athletic / fit', q27_body_type_preferences: ['Athletic / fit', 'Average build', 'Curvy / soft'],
    q28_hard_boundaries: ['Degradation'], q29_maybe_boundaries: ['Exhibitionism'],
    q30_safer_sex: ['Regular testing', 'Discussion before intimacy'], q30a_fluid_bonding: 'open_to_it',
    q31_health_testing: 'quarterly', q33_kinks: ['Sensory play', 'Role play', 'Bondage'],
    q33a_experience_level: 'experienced', q34_exploration: 1 + (i % 9), q34a_variety: 1 + ((i * 3) % 9),
    q35_agreements: 7, q35a_structure: 5, q36_social_energy: ['ambivert', 'introverted', 'extroverted'][i % 3],
    q36a_outgoing: 'ambivert', q37_empathy: 'very_high', q37a_harmony: 'high', q38_jealousy: 'very_low',
    q38a_emotional_reactive: 'low', q_emotional_pace: 1 + (i % 5), q_emotional_engagement: 3, q_independence_balance: 3,
    q_age_min: 21, q_age_max: 55, q_race_identity: ['any'], q_race_preference: ['any'],
  }
}

export function gatedAgainstBase(i: number): Record<string, unknown> {
  return { ...base(i), q9_intentions: ['Casual fun'] }
}

/** Deterministic uuid-shaped ids that sort in index order. */
export function mid(i: number): string {
  return `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
}

export function solo(i: number, answers: Record<string, unknown> | null = base(i)): SeedMember {
  return {
    id: mid(i),
    users: [{ user_id: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`, role: 'owner', email: `test-goose-${i}@qa.haevn.invalid`, answers }],
  }
}
