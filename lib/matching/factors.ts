/**
 * HAEVN Match Factor Labels
 * Human-readable labels for different compatibility dimensions
 */

export type FactorKey =
  | 'seeking_identity'
  | 'structure'
  | 'intent'
  | 'location'
  | 'discretion'
  | 'verification'
  | 'communication'
  | 'lifestyle'
  | 'intimacy'
  | 'values'

/**
 * Short labels for factors (for cards, badges)
 */
export const FACTOR_LABELS: Record<FactorKey, string> = {
  seeking_identity: 'Mutual Attraction',
  structure: 'Relationship Style',
  intent: 'Shared Goals',
  location: 'Proximity',
  discretion: 'Privacy Level',
  verification: 'Trust & Safety',
  communication: 'Communication Style',
  lifestyle: 'Lifestyle Compatibility',
  intimacy: 'Intimacy Alignment',
  values: 'Shared Values'
}

/**
 * Descriptive labels (for profile sections, tooltips)
 */
export const FACTOR_DESCRIPTIONS: Record<FactorKey, string> = {
  seeking_identity: 'How well your identities and what you\'re seeking align',
  structure: 'Compatibility of your relationship structures (ENM, Monogamous, Polyamorous, etc.)',
  intent: 'What you\'re both looking for on HAEVN (dating, play, friendship, long-term)',
  location: 'How close you are geographically',
  discretion: 'How aligned your privacy and discretion preferences are',
  verification: 'Verification status and background checks for trust and safety',
  communication: 'How your communication styles and attachment styles align',
  lifestyle: 'Compatibility in lifestyle choices, time availability, and daily routines',
  intimacy: 'Alignment in intimacy preferences, chemistry vs emotional connection',
  values: 'Shared values around relationships, boundaries, and connection'
}

/**
 * Icons for each factor (using lucide-react icon names)
 */
export const FACTOR_ICONS: Record<FactorKey, string> = {
  seeking_identity: 'Heart',
  structure: 'Users',
  intent: 'Target',
  location: 'MapPin',
  discretion: 'Lock',
  verification: 'ShieldCheck',
  communication: 'MessageCircle',
  lifestyle: 'Calendar',
  intimacy: 'Flame',
  values: 'Star'
}

/**
 * Contextual explanations for why a factor matters
 */
export const FACTOR_EXPLANATIONS: Record<FactorKey, string> = {
  seeking_identity: 'This measures whether what you\'re looking for matches who they are, and vice versa. High alignment here means you\'re both interested in each other\'s identity.',

  structure: 'Relationship structure compatibility is crucial. This shows how well your approaches to relationships (monogamy, ENM, polyamory, etc.) align with each other.',

  intent: 'This reflects shared goals—whether you\'re both looking for similar types of connections like dating, play, friendship, or long-term relationships.',

  location: 'Geographic proximity matters for in-person connections. Higher scores mean you\'re closer together, making meetups easier.',

  discretion: 'Privacy preferences alignment ensures you\'re comfortable with the same level of openness about your relationships and activities.',

  verification: 'Verified profiles with background checks create a safer, more trustworthy community. This bonus rewards mutual verification.',

  communication: 'How you communicate and attach emotionally affects relationship success. This measures alignment in communication styles and attachment patterns.',

  lifestyle: 'Daily routines, time availability, and lifestyle choices impact compatibility. This shows how well your lifestyles mesh.',

  intimacy: 'Intimacy preferences including sexual chemistry, emotional connection, and erotic styles are measured here.',

  values: 'Core values around boundaries, consent, relationship philosophy, and connection styles contribute to long-term compatibility.'
}

/**
 * Get a random positive match factor label
 * Useful for variety in UI display
 */
export function getRandomFactorLabel(factorKey: FactorKey): string {
  const alternatives: Record<FactorKey, string[]> = {
    seeking_identity: [
      'Strong mutual attraction',
      'Aligned identities',
      'You\'re what they\'re seeking'
    ],
    structure: [
      'Compatible relationship styles',
      'Aligned relationship approaches',
      'Similar relationship structures'
    ],
    intent: [
      'Shared intentions',
      'Aligned goals',
      'Similar relationship goals'
    ],
    location: [
      'Close proximity',
      'Same area',
      'Nearby location'
    ],
    discretion: [
      'Aligned privacy preferences',
      'Similar discretion levels',
      'Matched privacy approach'
    ],
    verification: [
      'Both verified',
      'Trusted profiles',
      'Verified & safe'
    ],
    communication: [
      'Communication compatibility',
      'Similar communication styles',
      'Aligned attachment styles'
    ],
    lifestyle: [
      'Lifestyle alignment',
      'Compatible daily routines',
      'Similar availability'
    ],
    intimacy: [
      'Intimacy alignment',
      'Strong chemistry potential',
      'Shared intimacy values'
    ],
    values: [
      'Shared values',
      'Aligned principles',
      'Similar relationship values'
    ]
  }

  const options = alternatives[factorKey] || [FACTOR_LABELS[factorKey]]
  return options[Math.floor(Math.random() * options.length)]
}

/**
 * Get emoji for a factor (for fun UI touches)
 */
export const FACTOR_EMOJIS: Record<FactorKey, string> = {
  seeking_identity: '💕',
  structure: '👥',
  intent: '🎯',
  location: '📍',
  discretion: '🔒',
  verification: '✅',
  communication: '💬',
  lifestyle: '📅',
  intimacy: '🔥',
  values: '⭐'
}
