/**
 * Dashboard Type Definitions
 * Types for the internal relationship dashboard
 */

export type PartnerStatus = 'completed' | 'in_progress' | 'not_started' | 'invite_pending'

export interface PartnerInfo {
  userId: string
  name: string
  email: string
  role: 'owner' | 'member'
  status: PartnerStatus
  onboardingCompletion: number
  surveyReviewed: boolean
}

export interface PendingInviteInfo {
  id: string
  email: string
  inviteCode: string
  createdAt: string
}

/**
 * Category score from the matching engine
 */
export interface CategoryScoreDisplay {
  key: 'intent' | 'structure' | 'connection' | 'chemistry' | 'lifestyle'
  score: number
  weight: number
  coverage: number
  included: boolean
  reason?: string
}

/**
 * Compatibility scores from the internal matching engine
 */
export interface CompatibilityScores {
  overall: number
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze'
  categories: {
    intent: number
    structure: number
    connection: number
    chemistry: number
    lifestyle: number
  }
  /** Detailed category scores with coverage info */
  categoryDetails?: CategoryScoreDisplay[]
  /** Whether lifestyle was included in calculation */
  lifestyleIncluded: boolean
}

export interface CompatibilityCategoryDisplay {
  key: keyof CompatibilityScores['categories']
  label: string
  description: string
  score: number
}

export interface DashboardData {
  user: {
    id: string
    email: string
  }
  profile: {
    fullName: string
    photoUrl?: string
  } | null
  partnership: {
    id: string
    type: 'solo' | 'couple' | 'pod'
    tier: 'free' | 'plus'
    ownerId: string
    profileState: 'draft' | 'pending' | 'live'
  } | null
  partners: PartnerInfo[]
  pendingInvites: PendingInviteInfo[]
  onboarding: {
    userCompletion: number
    allPartnersComplete: boolean
  }
  compatibility: CompatibilityScores | null
}

// Props types for components
export interface UserProfileCardProps {
  user: DashboardData['user']
  profile: DashboardData['profile']
  onboardingCompletion: number
}

export interface RelationshipStatusCardProps {
  partnership: DashboardData['partnership']
  partners: PartnerInfo[]
  pendingInvites: PendingInviteInfo[]
}

export interface PartnerListProps {
  partners: PartnerInfo[]
  currentUserId: string
}

export interface OnboardingProgressProps {
  percentage: number
  label?: string
  showPercentage?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export interface CompatibilityLockedCardProps {
  partners: PartnerInfo[]
  userCompletion: number
}

export interface CompatibilityPreviewCardProps {
  scores: CompatibilityScores
}
