/**
 * HAEVN Theme Type Definitions
 *
 * TypeScript interfaces for theming system
 */

export type SectionId =
  | 'basic_demographics'
  | 'relationship_preferences'
  | 'communication_attachment'
  | 'lifestyle_values'
  | 'privacy_community'
  | 'intimacy_sexuality'
  | 'personal_expression'
  | 'personality_insights'

export interface SectionColorScheme {
  primary: string
  glow: string
  hover: string
  description: string
}

export interface SectionTheme {
  id: SectionId
  title: string
  description?: string
  colors: SectionColorScheme
  index: number
}

export interface ProgressBarProps {
  currentSection: SectionId
  completionPercentage: number
  showPercentage?: boolean
}

export interface GlassButtonProps {
  variant: 'back' | 'save' | 'continue'
  sectionColor?: string
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  className?: string
}

export interface SectionTransitionConfig {
  duration: number // milliseconds
  easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear'
  fadeOpacity: boolean
  glowTransition: boolean
}
