/**
 * Static question metadata for the Match Inspection View.
 *
 * Maps internal answer keys → display label, category, sub-component, and type.
 * Derived from the 5 category scoring files in lib/matching/categories/.
 *
 * The "csvKey" is what the scoring engine sees after normalization (INTERNAL_TO_CSV).
 * The "internalKey" is what's stored in answers_json.
 */

export type QuestionType = 'multi_select' | 'tier' | 'numeric' | 'text' | 'binary'

export interface QuestionMeta {
  label: string
  category: 'intent' | 'structure' | 'connection' | 'chemistry' | 'lifestyle' | 'gate'
  subComponent: string
  type: QuestionType
}

/**
 * Map keyed by INTERNAL answer keys (as stored in answers_json).
 * When looking up, also try the CSV key variant.
 */
export const QUESTION_MAP: Record<string, QuestionMeta> = {
  // ═══════════════════════════════════════════════════════════════
  // INTENT FIT (30%)
  // ═══════════════════════════════════════════════════════════════

  // Goals sub-component (30w)
  q9_intentions:          { label: 'Connection Goals',         category: 'intent', subComponent: 'goals',       type: 'multi_select' },
  q9a_sex_or_more:        { label: 'Looking For (Sex+)',       category: 'intent', subComponent: 'goals',       type: 'tier' },
  q9b_dating_readiness:   { label: 'Dating Readiness',         category: 'intent', subComponent: 'goals',       type: 'tier' },

  // Style sub-component (20w)
  q6_relationship_styles: { label: 'Relationship Styles',      category: 'intent', subComponent: 'style',       type: 'multi_select' },

  // Exclusivity sub-component (15w)
  q7_emotional_exclusivity: { label: 'Emotional Exclusivity',  category: 'intent', subComponent: 'exclusivity', type: 'tier' },
  q8_sexual_exclusivity:    { label: 'Sexual Exclusivity',     category: 'intent', subComponent: 'exclusivity', type: 'tier' },

  // Attachment sub-component (15w)
  q10_attachment_style:       { label: 'Attachment Style',        category: 'intent', subComponent: 'attachment', type: 'tier' },
  q10a_emotional_availability:{ label: 'Emotional Availability',  category: 'intent', subComponent: 'attachment', type: 'tier' },

  // Timing sub-component (10w)
  q15_time_availability:      { label: 'Time Availability',      category: 'intent', subComponent: 'timing',     type: 'tier' },
  q16_typical_availability:   { label: 'Typical Availability',    category: 'intent', subComponent: 'timing',     type: 'multi_select' },
  q16a_first_meet_preference: { label: 'First Meet Preference',  category: 'intent', subComponent: 'timing',     type: 'text' },

  // Privacy sub-component (5w)
  q20_discretion:   { label: 'Privacy Level',        category: 'intent', subComponent: 'privacy',   type: 'tier' },
  q20b_how_out:     { label: 'Visibility / Outness', category: 'intent', subComponent: 'privacy',   type: 'tier' },

  // HAEVN Use sub-component (5w)
  q21_platform_use: { label: 'Platform Use Goals',   category: 'intent', subComponent: 'haevnUse',  type: 'multi_select' },

  // ═══════════════════════════════════════════════════════════════
  // STRUCTURE FIT (25%)
  // ═══════════════════════════════════════════════════════════════

  // Orientation sub-component (25w)
  q3_sexual_orientation:        { label: 'Sexual Orientation',     category: 'structure', subComponent: 'orientation', type: 'multi_select' },
  q3b_kinsey_scale:             { label: 'Kinsey Scale',           category: 'structure', subComponent: 'orientation', type: 'tier' },
  q3c_partner_kinsey_preference:{ label: 'Partner Kinsey Pref',    category: 'structure', subComponent: 'orientation', type: 'multi_select' },

  // Status sub-component (25w)
  q4_relationship_status: { label: 'Relationship Status',    category: 'structure', subComponent: 'status',      type: 'tier' },
  q6b_who_to_meet:        { label: 'Who To Meet',            category: 'structure', subComponent: 'status',      type: 'multi_select' },

  // Boundaries sub-component (25w)
  q6a_connection_type:    { label: 'Connection Type',         category: 'structure', subComponent: 'boundaries',  type: 'multi_select' },
  q6c_couple_connection:  { label: 'Couple Connection Style', category: 'structure', subComponent: 'boundaries',  type: 'tier' },
  q6d_couple_permissions: { label: 'Couple Permissions',      category: 'structure', subComponent: 'boundaries',  type: 'tier' },
  q28_hard_boundaries:    { label: 'Hard Boundaries',         category: 'structure', subComponent: 'boundaries',  type: 'multi_select' },

  // Safer Sex sub-component (15w)
  q30_safer_sex:       { label: 'Safer Sex Practices',   category: 'structure', subComponent: 'saferSex', type: 'multi_select' },
  q30a_fluid_bonding:  { label: 'Fluid Bonding',         category: 'structure', subComponent: 'saferSex', type: 'tier' },
  q31_health_testing:  { label: 'Health Testing',         category: 'structure', subComponent: 'saferSex', type: 'tier' },

  // Roles sub-component (10w)
  q26_roles: { label: 'Sexual Roles', category: 'structure', subComponent: 'roles', type: 'multi_select' },

  // Fidelity sub-component (10w)
  q3a_fidelity: { label: 'Fidelity Philosophy', category: 'structure', subComponent: 'fidelity', type: 'text' },

  // ═══════════════════════════════════════════════════════════════
  // CONNECTION STYLE (20%)
  // ═══════════════════════════════════════════════════════════════

  // Communication sub-component (26w)
  q11_love_languages:     { label: 'Love Languages',        category: 'connection', subComponent: 'communication', type: 'multi_select' },
  q12_conflict_resolution:{ label: 'Conflict Resolution',   category: 'connection', subComponent: 'communication', type: 'tier' },
  q12a_messaging_pace:    { label: 'Messaging Pace',        category: 'connection', subComponent: 'communication', type: 'tier' },

  // Emotional sub-component (17w)
  q37_empathy:            { label: 'Empathy Level',         category: 'connection', subComponent: 'emotional', type: 'tier' },
  q37a_harmony:           { label: 'Harmony Seeking',       category: 'connection', subComponent: 'emotional', type: 'tier' },
  q38_jealousy:           { label: 'Jealousy Level',        category: 'connection', subComponent: 'emotional', type: 'tier' },
  q38a_emotional_reactive:{ label: 'Emotional Reactivity',  category: 'connection', subComponent: 'emotional', type: 'tier' },

  // Emotional Pace sub-component (6w)
  q_emotional_pace: { label: 'Emotional Pace', category: 'connection', subComponent: 'emotionalPace', type: 'numeric' },

  // Emotional Engagement sub-component (8w)
  q_emotional_engagement: { label: 'Emotional Engagement', category: 'connection', subComponent: 'emotionalEngagement', type: 'numeric' },

  // ═══════════════════════════════════════════════════════════════
  // SEXUAL CHEMISTRY (15%)
  // ═══════════════════════════════════════════════════════════════

  // Erotic Profile sub-component (35w)
  q23_erotic_styles:         { label: 'Erotic Styles',        category: 'chemistry', subComponent: 'eroticProfile', type: 'multi_select' },
  q24_experiences:           { label: 'Experiences',           category: 'chemistry', subComponent: 'eroticProfile', type: 'multi_select' },
  q25_chemistry_vs_emotion:  { label: 'Chemistry vs Emotion',  category: 'chemistry', subComponent: 'eroticProfile', type: 'tier' },

  // Roles & Kinks sub-component (35w)
  q33_kinks:            { label: 'Kinks & Interests',    category: 'chemistry', subComponent: 'rolesKinks', type: 'multi_select' },
  q33a_experience_level:{ label: 'Kink Experience Level', category: 'chemistry', subComponent: 'rolesKinks', type: 'tier' },

  // Frequency sub-component (20w)
  q25a_frequency: { label: 'Sexual Frequency', category: 'chemistry', subComponent: 'frequency', type: 'tier' },

  // Boundaries sub-component (10w) — shared with structure but scored in chemistry too
  q29_maybe_boundaries: { label: 'Discussion Items', category: 'chemistry', subComponent: 'boundaries', type: 'multi_select' },

  // Physical Preferences sub-component (10w)
  q27_body_type_self:        { label: 'Body Type (Self)',       category: 'chemistry', subComponent: 'physicalPreferences', type: 'multi_select' },
  q27_body_type_preferences: { label: 'Body Type (Preferred)',  category: 'chemistry', subComponent: 'physicalPreferences', type: 'multi_select' },

  // Exploration sub-component (10w)
  q34_exploration: { label: 'Exploration Openness', category: 'chemistry', subComponent: 'exploration', type: 'numeric' },
  q34a_variety:    { label: 'Variety Desire',       category: 'chemistry', subComponent: 'exploration', type: 'numeric' },

  // ═══════════════════════════════════════════════════════════════
  // LIFESTYLE COMPATIBILITY (10%)
  // ═══════════════════════════════════════════════════════════════

  // Distance sub-component (19w)
  q19a_max_distance:    { label: 'Max Distance',         category: 'lifestyle', subComponent: 'distance',    type: 'tier' },
  q19b_distance_priority:{ label: 'Distance Priority',   category: 'lifestyle', subComponent: 'distance',    type: 'tier' },
  q19c_mobility:         { label: 'Travel Willingness',  category: 'lifestyle', subComponent: 'distance',    type: 'tier' },

  // Social Energy sub-component (14w)
  q36_social_energy: { label: 'Social Energy',      category: 'lifestyle', subComponent: 'socialEnergy', type: 'tier' },
  q36a_outgoing:     { label: 'Outgoing Preference', category: 'lifestyle', subComponent: 'socialEnergy', type: 'tier' },

  // Substances sub-component (9w)
  q18_substances: { label: 'Substance Use', category: 'lifestyle', subComponent: 'substances', type: 'tier' },

  // Languages sub-component (9w)
  q13a_languages: { label: 'Languages', category: 'lifestyle', subComponent: 'languages', type: 'multi_select' },

  // Independence Balance sub-component (6w)
  q_independence_balance: { label: 'Independence Balance', category: 'lifestyle', subComponent: 'independenceBalance', type: 'numeric' },

  // Lifestyle Importance sub-component (5w)
  q13_lifestyle_alignment: { label: 'Lifestyle Alignment', category: 'lifestyle', subComponent: 'lifestyleImportance', type: 'tier' },

  // Cultural sub-component (10w)
  q14a_cultural_alignment: { label: 'Cultural Alignment',  category: 'lifestyle', subComponent: 'cultural', type: 'numeric' },
  q14b_cultural_identity:  { label: 'Cultural Identity',   category: 'lifestyle', subComponent: 'cultural', type: 'text' },

  // Children sub-component (5w)
  Q17:  { label: 'Children',       category: 'lifestyle', subComponent: 'children', type: 'tier' },
  Q17a: { label: 'Dietary Prefs',  category: 'lifestyle', subComponent: 'dietary',  type: 'multi_select' },
  Q17b: { label: 'Pets',           category: 'lifestyle', subComponent: 'pets',     type: 'binary' },

  // ═══════════════════════════════════════════════════════════════
  // P0 GATE FIELDS (not scored, but displayed in gate panel)
  // ═══════════════════════════════════════════════════════════════
  q1_age:            { label: 'Birth Date / Age', category: 'gate', subComponent: 'age_range',  type: 'text' },
  q_age_min:         { label: 'Age Minimum',      category: 'gate', subComponent: 'age_range',  type: 'numeric' },
  q_age_max:         { label: 'Age Maximum',       category: 'gate', subComponent: 'age_range',  type: 'numeric' },
  q_race_identity:   { label: 'Race Identity',     category: 'gate', subComponent: 'race',       type: 'multi_select' },
  q_race_preference: { label: 'Race Preference',   category: 'gate', subComponent: 'race',       type: 'multi_select' },

  // Demographics (not directly scored but shown for context)
  q2_gender_identity: { label: 'Gender Identity',  category: 'gate', subComponent: 'demographics', type: 'text' },
  q2a_pronouns:       { label: 'Pronouns',          category: 'gate', subComponent: 'demographics', type: 'text' },
  q22_spirituality_sexuality: { label: 'Spirituality & Sexuality', category: 'gate', subComponent: 'demographics', type: 'text' },
  q20a_photo_sharing: { label: 'Photo Sharing Comfort', category: 'gate', subComponent: 'demographics', type: 'tier' },
  q32_looking_for:    { label: 'Looking For (Free Text)', category: 'gate', subComponent: 'demographics', type: 'text' },
  q35_agreements:     { label: 'Agreement Importance',    category: 'gate', subComponent: 'demographics', type: 'numeric' },
  q35a_structure:     { label: 'Structure Preference',    category: 'gate', subComponent: 'demographics', type: 'numeric' },
}

/** Get all questions for a given category, grouped by sub-component. */
export function getQuestionsByCategory(category: string): Record<string, { key: string; meta: QuestionMeta }[]> {
  const groups: Record<string, { key: string; meta: QuestionMeta }[]> = {}
  for (const [key, meta] of Object.entries(QUESTION_MAP)) {
    if (meta.category !== category) continue
    if (!groups[meta.subComponent]) groups[meta.subComponent] = []
    groups[meta.subComponent].push({ key, meta })
  }
  return groups
}

/** Category display metadata. */
export const CATEGORY_META: Record<string, { label: string; weight: number }> = {
  intent:     { label: 'Intent Fit',              weight: 30 },
  structure:  { label: 'Structure Fit',           weight: 25 },
  connection: { label: 'Connection Style',        weight: 20 },
  chemistry:  { label: 'Sexual Chemistry',        weight: 15 },
  lifestyle:  { label: 'Lifestyle Compatibility', weight: 10 },
}
