/**
 * HAEVN Matching Engine - Question Mappings
 *
 * Maps survey questions to categories and sub-components.
 * Defines which questions are used for each scoring component.
 */

// =============================================================================
// INTENT FIT QUESTION MAPPINGS
// =============================================================================

export const INTENT_QUESTIONS = {
  goals: {
    questions: ['Q9', 'Q9a'],
    description: 'Connection goals - what each party is looking for',
    logic: 'Must have at least one overlapping intention',
  },
  style: {
    questions: ['Q6'],
    description: 'Relationship style - ENM type preferences',
    logic: 'Many-to-many flexible matching',
  },
  whoToMeet: {
    questions: ['Q6b'],
    description: 'Who they want to meet (solo/couple)',
    logic: 'Must be mutually inclusive',
  },
  coupleIntent: {
    questions: ['Q6c', 'Q6d'],
    description: 'Couple-specific rules and dynamics',
    logic: 'Only evaluated if either party is a couple',
  },
  exclusivity: {
    questions: ['Q7', 'Q8', 'Q25'],
    description: 'Exclusivity preferences and chemistry importance',
    logic: 'Compare using tier logic',
  },
  attachment: {
    questions: ['Q10', 'Q10a'],
    description: 'Attachment style and emotional availability',
    logic: 'Use adjacency scoring (nearby styles score higher)',
  },
  timing: {
    questions: ['Q15', 'Q16', 'Q16a'],
    description: 'Time availability and scheduling flexibility',
    logic: 'Match windows and availability levels',
  },
  messagingPace: {
    questions: ['Q12a'],
    description: 'Messaging and communication pace',
    logic: 'Within one tier difference',
  },
  privacy: {
    questions: ['Q20', 'Q20b'],
    description: 'Privacy needs and visibility comfort',
    logic: 'Avoid extreme high-low mismatch',
  },
  haevnUse: {
    questions: ['Q21'],
    description: 'Purpose for using HAEVN',
    logic: 'Must overlap on at least one purpose',
  },
} as const

// =============================================================================
// STRUCTURE FIT QUESTION MAPPINGS
// =============================================================================

export const STRUCTURE_QUESTIONS = {
  orientation: {
    questions: ['Q3', 'Q3b'],
    description: 'Sexual orientation and Kinsey position',
    logic: 'Use Kinsey-scale proximity scoring',
  },
  kinseyPreference: {
    questions: ['Q3c'],
    description: 'Preferred Kinsey range in partners',
    logic: 'Ensure User is within Match preferred range',
  },
  status: {
    questions: ['Q4'],
    description: 'Relationship status',
    logic: 'Must be compatible (e.g., solo with couple-friendly)',
  },
  coupleRules: {
    questions: ['Q6c', 'Q6d'],
    description: 'Couple/pod rules',
    logic: 'Only evaluated if applicable',
  },
  fidelity: {
    questions: ['Q3a'],
    description: 'Fidelity/commitment philosophy',
    logic: 'Compare philosophy tier',
  },
  whoToMeet: {
    questions: ['Q6b'],
    description: 'Who they want to meet',
    logic: 'Must match (solo → open to couple, etc.)',
  },
  saferSex: {
    questions: ['Q30', 'Q30a'],
    description: 'Safer-sex preferences',
    logic: 'Must align or be discussable',
  },
  sexualHealth: {
    questions: ['Q31'],
    description: 'Sexual health practices',
    logic: 'Must be within acceptable range',
  },
  roles: {
    questions: ['Q26'],
    description: 'Relational/sexual roles',
    logic: 'Overlap required',
  },
  boundaries: {
    questions: ['Q28'],
    description: 'Hard boundaries',
    logic: 'Hard boundaries must not conflict',
  },
} as const

// =============================================================================
// CONNECTION STYLE QUESTION MAPPINGS
// =============================================================================

export const CONNECTION_QUESTIONS = {
  attachmentStyle: {
    questions: ['Q10'],
    description: 'Attachment style',
    logic: 'Adjacency logic - nearby styles compatible',
  },
  emotionalAvailability: {
    questions: ['Q10a'],
    description: 'Emotional availability level',
    logic: 'Must be within 1 level',
  },
  loveLanguages: {
    questions: ['Q11'],
    description: 'Love languages',
    logic: 'Compare primary categories',
  },
  conflictStyle: {
    questions: ['Q12'],
    description: 'Conflict handling style',
    logic: 'Avoid extreme opposites',
  },
  messagingPace: {
    questions: ['Q12a'],
    description: 'Messaging pace',
    logic: 'Must align generally',
  },
  empathyHarmony: {
    questions: ['Q37', 'Q37a'],
    description: 'Empathy and harmony preferences',
    logic: 'Tier alignment',
  },
  jealousyReactivity: {
    questions: ['Q38', 'Q38a'],
    description: 'Jealousy and reactivity levels',
    logic: 'Balanced pairings preferred',
  },
  privacy: {
    questions: ['Q20'],
    description: 'Privacy sensitivity',
    logic: 'Compare sensitivity levels',
  },
  visibility: {
    questions: ['Q20b'],
    description: 'Comfort with visibility',
    logic: 'Avoid high-low pairing',
  },
} as const

// =============================================================================
// SEXUAL CHEMISTRY QUESTION MAPPINGS
// =============================================================================

export const CHEMISTRY_QUESTIONS = {
  eroticStyles: {
    questions: ['Q23'],
    description: 'Erotic styles and turn-ons',
    logic: 'Must overlap in at least one major category',
  },
  experiences: {
    questions: ['Q24'],
    description: 'Sexual experiences and interests',
    logic: 'Compare experience buckets',
  },
  chemistryImportance: {
    questions: ['Q25'],
    description: 'Importance of sexual chemistry',
    logic: 'Tier alignment',
  },
  frequency: {
    questions: ['Q25a'],
    description: 'Frequency preference',
    logic: 'Must be within 1 tier',
  },
  roles: {
    questions: ['Q26'],
    description: 'Sexual roles',
    logic: 'Compatible pairings required',
  },
  physicalPreferences: {
    questions: ['Q27'],
    description: 'Body/physical preferences',
    logic: 'Soft or strict depending on user flag',
  },
  kinks: {
    questions: ['Q33'],
    description: 'Kinks and fetishes',
    logic: 'At least one overlap preferred',
  },
  kinkExperience: {
    questions: ['Q33a'],
    description: 'Kink experience level',
    logic: 'Avoid extreme mismatch (novice vs extreme)',
  },
  exploration: {
    questions: ['Q34', 'Q34a'],
    description: 'Exploration and adventure openness',
    logic: 'Compare levels of adventurousness',
  },
  boundaries: {
    questions: ['Q28'],
    description: 'Hard boundaries',
    logic: 'No hard conflicts',
  },
  discussionItems: {
    questions: ['Q29'],
    description: 'Activities needing discussion',
    logic: 'Overlap okay; conflicts penalized',
  },
} as const

// =============================================================================
// LIFESTYLE COMPATIBILITY QUESTION MAPPINGS
// =============================================================================

export const LIFESTYLE_QUESTIONS = {
  distance: {
    questions: ['Q19a', 'Q19b', 'Q19c'],
    description: 'Distance, mobility, and travel willingness',
    type: 'core' as const,
    logic: 'Determine feasibility and preferred treatment of distance',
  },
  privacy: {
    questions: ['Q20'],
    description: 'Privacy and discretion level',
    type: 'core' as const,
    logic: 'Compare sensitivity levels, avoid high-low extremes',
  },
  socialEnergy: {
    questions: ['Q36', 'Q36a'],
    description: 'Introversion/extroversion and social preferences',
    type: 'core' as const,
    logic: 'Alignment on social energy',
  },
  substances: {
    questions: ['Q18'],
    description: 'Substance use and tolerance',
    type: 'core' as const,
    logic: 'Match tolerance and use levels',
  },
  languages: {
    questions: ['Q13a'],
    description: 'Languages spoken',
    type: 'core' as const,
    logic: 'CONSTRAINT: If required, mismatch blocks match entirely',
  },
  lifestyleImportance: {
    questions: ['Q13'],
    description: 'Lifestyle alignment importance',
    type: 'extended' as const,
    logic: 'Only asked when user cares about broader lifestyle matching',
  },
  cultural: {
    questions: ['Q14a', 'Q14b'],
    description: 'Cultural and worldview alignment',
    type: 'extended' as const,
    logic: 'Soft pairing; avoid extremes when both answered',
  },
  children: {
    questions: ['Q17'],
    description: 'Children preferences',
    type: 'extended' as const,
    logic: 'Must match or be clearly compatible',
  },
  dietary: {
    questions: ['Q17a'],
    description: 'Dietary needs and restrictions',
    type: 'extended' as const,
    logic: 'Avoid conflicts (especially allergies)',
  },
  pets: {
    questions: ['Q17b'],
    description: 'Pet situation',
    type: 'extended' as const,
    logic: 'Hard mismatches flagged (e.g., allergies vs multiple pets)',
  },
} as const

// =============================================================================
// GLOBAL CONSTRAINT QUESTIONS
// =============================================================================

/**
 * Questions that are evaluated as global constraints.
 * These can block a match entirely regardless of category scores.
 */
export const CONSTRAINT_QUESTIONS = {
  language: {
    questions: ['Q13a'],
    requiredFlag: 'Q13a_required',
    description: 'Language compatibility',
    logic: 'If either party requires language match and no overlap, BLOCK',
  },
  mutualInterest: {
    questions: ['Q6b'],
    description: 'Who they want to meet',
    logic: 'Must be mutually inclusive (solo↔solo, couple↔couple-friendly)',
  },
  hardBoundaries: {
    questions: ['Q28'],
    description: 'Hard boundaries',
    logic: 'If User desires conflict with Match hard nos, BLOCK',
  },
} as const

// =============================================================================
// QUESTION TYPE HELPERS
// =============================================================================

/**
 * All questions that should be normalized to arrays (multi-select)
 */
export const MULTI_SELECT_QUESTIONS = [
  'Q9', 'Q9a', 'Q6', 'Q6b', 'Q16', 'Q21',     // Intent
  'Q3c', 'Q30a', 'Q26', 'Q28',                 // Structure
  'Q11',                                        // Connection
  'Q23', 'Q24', 'Q27', 'Q33', 'Q29',           // Chemistry
  'Q13a', 'Q17a',                              // Lifestyle
] as const

/**
 * Questions that use tier/scale comparison (adjacency scoring)
 */
export const TIER_QUESTIONS = [
  'Q7', 'Q8', 'Q10', 'Q10a', 'Q12a', 'Q20', 'Q20b',  // Intent/Connection
  'Q30', 'Q31',                                       // Structure
  'Q25', 'Q25a', 'Q33a', 'Q34', 'Q34a',              // Chemistry
  'Q18', 'Q36', 'Q36a',                              // Lifestyle
] as const
