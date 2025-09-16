// Profile-related types for HAEVN

export type ProfileState = 'draft' | 'pending' | 'live'
export type PhotoType = 'public' | 'private'

export interface PartnershipProfile {
  id: string
  owner_id: string
  city: string | null
  membership_tier: 'free' | 'plus' | 'select'

  // Profile fields
  display_name: string | null
  short_bio: string | null
  long_bio: string | null
  orientation: {
    value?: string
    seeking?: string[]
  }
  structure: {
    type?: string // 'single' | 'couple' | 'throuple'
    open_to?: string[]
  }
  intentions: string[]
  lifestyle_tags: string[]
  discretion_summary: string | null
  profile_state: ProfileState
  badges: string[]

  // Timestamps
  created_at: string
  updated_at?: string
}

export interface PhotoMetadata {
  id: string
  partnership_id: string
  photo_url: string
  photo_type: PhotoType
  width: number | null
  height: number | null
  nsfw_flag: boolean
  order_index: number
  created_at: string
}

export interface PhotoGrant {
  handshake_id: string
  granted: boolean
  updated_at: string
}

export interface ProfileVisibility {
  canViewPublic: boolean
  canViewGated: boolean
  canViewPrivate: boolean
  hasHandshake: boolean
  handshakeId?: string
  privatePhotoGrant?: boolean
}

// Form data for profile editing
export interface ProfileFormData {
  display_name: string
  short_bio: string
  long_bio: string
  orientation: {
    value: string
    seeking: string[]
  }
  structure: {
    type: string
    open_to: string[]
  }
  intentions: string[]
  lifestyle_tags: string[]
  discretion_summary: string
}

// Photo upload response
export interface PhotoUploadResponse {
  url: string
  signedUrl?: string
  error?: string
}

// Profile view data (what's sent to client based on visibility)
export interface ProfileViewData {
  profile: Partial<PartnershipProfile>
  photos: PhotoMetadata[]
  visibility: ProfileVisibility
  compatibility?: {
    score: number
    bucket: 'High' | 'Medium' | 'Low'
  }
}