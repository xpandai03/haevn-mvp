/**
 * Human-readable labels for SubScore keys across all 5 categories.
 *
 * Used by the question-level breakdown UI to display clear,
 * non-technical descriptions of each scoring component.
 */

export interface SubScoreLabel {
  /** Short human-readable name shown in the breakdown row */
  label: string
  /** One-line description shown under the label */
  description: string
}

/**
 * Maps SubScore.key → display label + description.
 *
 * Keys must match what each category scorer produces in SubScore.key.
 * Grouped by category for readability, but stored flat since keys are unique.
 */
export const SUB_SCORE_LABELS: Record<string, SubScoreLabel> = {
  // ── Intent & Goals ──
  goals: {
    label: 'Relationship Goals',
    description: 'What you are each looking for in a connection',
  },
  style: {
    label: 'Relationship Style',
    description: 'How your preferred relationship structures align',
  },
  exclusivity: {
    label: 'Exclusivity Preferences',
    description: 'How you each feel about emotional and sexual exclusivity',
  },
  attachment: {
    label: 'Attachment & Availability',
    description: 'Your attachment styles and emotional availability',
  },
  timing: {
    label: 'Timing & Availability',
    description: 'How your schedules and time availability match up',
  },
  privacy: {
    label: 'Privacy & Discretion',
    description: 'How your privacy needs and visibility comfort align',
  },
  haevnUse: {
    label: 'Platform Goals',
    description: 'What you are each hoping to get from HAEVN',
  },

  // ── Structure Fit ──
  orientation: {
    label: 'Orientation Alignment',
    description: 'How your sexual orientations and attractions align',
  },
  status: {
    label: 'Relationship Status',
    description: 'Whether your current relationship setups are compatible',
  },
  boundaries: {
    label: 'Boundaries',
    description: 'How your personal boundaries and limits align',
  },
  saferSex: {
    label: 'Safer Sex Practices',
    description: 'How your approaches to sexual health and safety compare',
  },
  roles: {
    label: 'Roles',
    description: 'How your preferred relational and sexual roles complement each other',
  },
  fidelity: {
    label: 'Fidelity Philosophy',
    description: 'How your views on commitment and fidelity align',
  },

  // ── Connection Style ──
  // Note: connection reuses 'attachment' and 'privacy' keys — same label works
  communication: {
    label: 'Communication Style',
    description: 'How your love languages, conflict style, and messaging pace match',
  },
  emotional: {
    label: 'Emotional Alignment',
    description: 'How your empathy, jealousy, and emotional reactivity levels compare',
  },
  emotionalPace: {
    label: 'Emotional Pace',
    description: 'How quickly you each like to build emotional depth',
  },
  emotionalEngagement: {
    label: 'Emotional Engagement',
    description: 'How deeply you each like to engage emotionally',
  },

  // ── Sexual Chemistry ──
  eroticProfile: {
    label: 'Erotic Profile',
    description: 'How your erotic styles, experiences, and chemistry priorities align',
  },
  rolesKinks: {
    label: 'Roles & Kinks',
    description: 'How your sexual roles, kinks, and experience levels match',
  },
  frequency: {
    label: 'Desired Frequency',
    description: 'How often you would each like to be intimate',
  },
  // 'boundaries' key reused from structure — same label works
  physicalPreferences: {
    label: 'Physical Preferences',
    description: 'How your body type preferences align with each other',
  },
  exploration: {
    label: 'Exploration & Variety',
    description: 'How open you both are to trying new things',
  },

  // ── Lifestyle Fit ──
  distance: {
    label: 'Distance & Mobility',
    description: 'How your locations, distance preferences, and willingness to travel align',
  },
  socialEnergy: {
    label: 'Social Energy',
    description: 'How your introversion/extroversion levels match',
  },
  substances: {
    label: 'Substance Use',
    description: 'How your attitudes toward substances compare',
  },
  languages: {
    label: 'Languages',
    description: 'Whether you share a common language',
  },
  independenceBalance: {
    label: 'Independence Balance',
    description: 'How you each balance independence with togetherness',
  },
  lifestyleImportance: {
    label: 'Lifestyle Priority',
    description: 'How important broader lifestyle alignment is to each of you',
  },
  cultural: {
    label: 'Cultural & Worldview',
    description: 'How your cultural values and worldviews align',
  },
  children: {
    label: 'Children',
    description: 'How your preferences around children compare',
  },
  dietary: {
    label: 'Dietary Needs',
    description: 'How your dietary restrictions and preferences align',
  },
  pets: {
    label: 'Pets',
    description: 'Whether your pet situations are compatible',
  },
}

/**
 * Determine the match quality label from a sub-score value.
 */
export type MatchQuality = 'exact' | 'close' | 'mismatch' | 'blocked' | 'no_data'

export function getMatchQuality(score: number, matched: boolean): MatchQuality {
  if (!matched) return 'no_data'
  if (score >= 90) return 'exact'
  if (score >= 60) return 'close'
  if (score > 0) return 'mismatch'
  return 'blocked'
}

export const MATCH_QUALITY_CONFIG: Record<MatchQuality, {
  label: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  exact: {
    label: 'Strong Match',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  close: {
    label: 'Good Match',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  mismatch: {
    label: 'Low Match',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  blocked: {
    label: 'Not Compatible',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  no_data: {
    label: 'Incomplete',
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
}
