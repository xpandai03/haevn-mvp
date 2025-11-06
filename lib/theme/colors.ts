/**
 * HAEVN Survey Theme Colors
 *
 * Centralized color system for survey sections aligned with brand guidelines.
 * Each section has a primary color and secondary glow/accent for visual feedback.
 */

export interface SectionColorScheme {
  primary: string
  glow: string
  hover: string
  description: string
}

/**
 * Section-specific color schemes
 * Maps to 8 survey sections: basic_demographics through personality_insights
 */
export const SECTION_COLORS: Record<string, SectionColorScheme> = {
  basic_demographics: {
    primary: '#E29E0C',
    glow: 'rgba(226, 158, 12, 0.4)',
    hover: '#F5B840',
    description: 'Gold Yellow - Warm and welcoming'
  },
  relationship_preferences: {
    primary: '#E29E0C',
    glow: 'linear-gradient(135deg, rgba(226, 158, 12, 0.4) 0%, rgba(255, 255, 255, 0.3) 100%)',
    hover: '#F5B840',
    description: 'Gold with White Glow - Transitional warmth'
  },
  communication_attachment: {
    primary: '#008080',
    glow: 'rgba(0, 128, 128, 0.35)',
    hover: '#00A0A0',
    description: 'Teal Blue - Calm and connected'
  },
  lifestyle_values: {
    primary: '#008080',
    glow: 'rgba(0, 128, 128, 0.25)',
    hover: '#00A0A0',
    description: 'Muted Teal - Balanced and grounded'
  },
  privacy_community: {
    primary: '#1E24AA',
    glow: 'rgba(30, 36, 170, 0.35)',
    hover: '#3F51B5',
    description: 'Navy Blue - Trust and security'
  },
  intimacy_sexuality: {
    primary: '#252627',
    glow: 'rgba(226, 158, 12, 0.3)',
    hover: '#3A3B3C',
    description: 'Charcoal with Gold Accent - Intimate and warm'
  },
  personal_expression: {
    primary: 'linear-gradient(135deg, #008080 0%, #E29E0C 100%)',
    glow: 'linear-gradient(135deg, rgba(0, 128, 128, 0.3) 0%, rgba(226, 158, 12, 0.3) 100%)',
    hover: 'linear-gradient(135deg, #00A0A0 0%, #F5B840 100%)',
    description: 'Teal to Gold Gradient - Creative expression'
  },
  personality_insights: {
    primary: '#008080', // Teal for visibility (not light gray)
    glow: 'rgba(0, 128, 128, 0.2)',
    hover: '#00A0A0',
    description: 'Teal - Reflective clarity'
  }
}

/**
 * Brand color constants for general use
 */
export const BRAND_COLORS = {
  gold: '#E29E0C',
  teal: '#008080',
  navy: '#1E24AA',
  charcoal: '#252627',
  lightGray: '#EBE6E3',
  white: '#FFFFFF'
}

/**
 * Get color scheme for a specific section
 */
export function getSectionColor(sectionId: string): SectionColorScheme {
  return SECTION_COLORS[sectionId] || SECTION_COLORS.basic_demographics
}

/**
 * Get the primary color from a section ID
 */
export function getSectionPrimaryColor(sectionId: string): string {
  return getSectionColor(sectionId).primary
}

/**
 * Get the glow color/gradient from a section ID
 */
export function getSectionGlow(sectionId: string): string {
  return getSectionColor(sectionId).glow
}

/**
 * Interpolate between two hex colors
 * Used for smooth color transitions between sections
 *
 * @param color1 - Starting hex color (e.g., '#E29E0C')
 * @param color2 - Ending hex color (e.g., '#008080')
 * @param progress - Transition progress (0-1)
 * @returns Interpolated hex color
 */
export function interpolateColors(color1: string, color2: string, progress: number): string {
  // Handle gradient colors by returning the destination
  if (color1.includes('gradient') || color2.includes('gradient')) {
    return progress < 0.5 ? color1 : color2
  }

  // Parse hex colors
  const hex1 = color1.replace('#', '')
  const hex2 = color2.replace('#', '')

  const r1 = parseInt(hex1.substring(0, 2), 16)
  const g1 = parseInt(hex1.substring(2, 4), 16)
  const b1 = parseInt(hex1.substring(4, 6), 16)

  const r2 = parseInt(hex2.substring(0, 2), 16)
  const g2 = parseInt(hex2.substring(2, 4), 16)
  const b2 = parseInt(hex2.substring(4, 6), 16)

  // Interpolate RGB values
  const r = Math.round(r1 + (r2 - r1) * progress)
  const g = Math.round(g1 + (g2 - g1) * progress)
  const b = Math.round(b1 + (b2 - b1) * progress)

  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Lighten a hex color by a percentage
 * Used for hover states
 *
 * @param color - Hex color to lighten
 * @param percent - Amount to lighten (0-100)
 * @returns Lightened hex color
 */
export function lightenColor(color: string, percent: number): string {
  // Handle gradient colors
  if (color.includes('gradient')) {
    return color // Return as-is for gradients (use CSS filter instead)
  }

  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  const amount = (percent / 100) * 255
  const newR = Math.min(255, Math.round(r + amount))
  const newG = Math.min(255, Math.round(g + amount))
  const newB = Math.min(255, Math.round(b + amount))

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
}

/**
 * Get text color (black or white) based on background luminance
 * Ensures readable contrast
 *
 * @param bgColor - Background hex color
 * @returns '#000000' or '#FFFFFF'
 */
export function getContrastTextColor(bgColor: string): string {
  // Handle gradient colors - default to white
  if (bgColor.includes('gradient')) {
    return '#FFFFFF'
  }

  const hex = bgColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Calculate luminance (perceived brightness)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

/**
 * Section order for progress tracking
 */
export const SECTION_ORDER = [
  'basic_demographics',
  'relationship_preferences',
  'communication_attachment',
  'lifestyle_values',
  'privacy_community',
  'intimacy_sexuality',
  'personal_expression',
  'personality_insights'
] as const

/**
 * Get section index (0-7) from section ID
 */
export function getSectionIndex(sectionId: string): number {
  return SECTION_ORDER.indexOf(sectionId as any)
}

/**
 * Get section ID from index (0-7)
 */
export function getSectionById(index: number): string {
  return SECTION_ORDER[index] || SECTION_ORDER[0]
}
