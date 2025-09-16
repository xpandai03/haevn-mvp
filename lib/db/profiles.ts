import { createClient } from '@/lib/supabase/client'
import type {
  PartnershipProfile,
  PhotoMetadata,
  PhotoGrant,
  ProfileVisibility,
  ProfileViewData,
  ProfileFormData
} from '@/lib/types/profile'

// Get partnership profile with proper visibility checks
export async function getPartnershipProfile(
  partnershipId: string,
  viewerId?: string
): Promise<ProfileViewData | null> {
  // For development with localStorage
  if (typeof window !== 'undefined') {
    const profiles = JSON.parse(localStorage.getItem('haevn_profiles') || '{}')
    const photos = JSON.parse(localStorage.getItem('haevn_photos') || '{}')
    const handshakes = JSON.parse(localStorage.getItem('haevn_handshakes') || '[]')
    const grants = JSON.parse(localStorage.getItem('haevn_photo_grants') || '{}')

    const profile = profiles[partnershipId]
    if (!profile) return null

    // Check visibility
    const visibility = await checkProfileVisibility(partnershipId, viewerId)

    // Filter data based on visibility
    const viewData: ProfileViewData = {
      profile: {},
      photos: [],
      visibility
    }

    // Always show public fields
    if (visibility.canViewPublic) {
      viewData.profile = {
        id: profile.id,
        display_name: profile.display_name,
        short_bio: profile.short_bio,
        city: profile.city,
        badges: profile.badges,
        profile_state: profile.profile_state
      }
    }

    // Show gated fields if handshake exists
    if (visibility.canViewGated) {
      viewData.profile.long_bio = profile.long_bio
      viewData.profile.orientation = profile.orientation
      viewData.profile.structure = profile.structure
      viewData.profile.intentions = profile.intentions
      viewData.profile.lifestyle_tags = profile.lifestyle_tags
      viewData.profile.discretion_summary = profile.discretion_summary

      // Add public photos
      const publicPhotos = (photos[partnershipId] || [])
        .filter((p: PhotoMetadata) => p.photo_type === 'public')
      viewData.photos = publicPhotos
    }

    // Show private photos if granted
    if (visibility.canViewPrivate) {
      const privatePhotos = (photos[partnershipId] || [])
        .filter((p: PhotoMetadata) => p.photo_type === 'private')
      viewData.photos = [...viewData.photos, ...privatePhotos]
    }

    return viewData
  }

  // Production: Use Supabase with server-side visibility checks
  const supabase = createClient()

  try {
    // This would be replaced with an API call that does server-side checks
    const response = await fetch(`/api/profiles/${partnershipId}`, {
      headers: {
        'X-Viewer-Id': viewerId || ''
      }
    })

    if (!response.ok) return null
    return await response.json()

  } catch (error) {
    console.error('Error fetching profile:', error)
    return null
  }
}

// Update partnership profile
export async function updatePartnershipProfile(
  partnershipId: string,
  data: Partial<ProfileFormData>
): Promise<{ success: boolean; error?: string }> {
  // For development with localStorage
  if (typeof window !== 'undefined') {
    const profiles = JSON.parse(localStorage.getItem('haevn_profiles') || '{}')

    profiles[partnershipId] = {
      ...profiles[partnershipId],
      ...data,
      updated_at: new Date().toISOString()
    }

    localStorage.setItem('haevn_profiles', JSON.stringify(profiles))
    return { success: true }
  }

  // Production: Use API route
  try {
    const response = await fetch(`/api/profiles/${partnershipId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to update profile' }
  }
}

// Check profile visibility based on viewer's relationship
export async function checkProfileVisibility(
  partnershipId: string,
  viewerId?: string
): Promise<ProfileVisibility> {
  // Default visibility (no viewer)
  if (!viewerId) {
    return {
      canViewPublic: true,
      canViewGated: false,
      canViewPrivate: false,
      hasHandshake: false
    }
  }

  // For development with localStorage
  if (typeof window !== 'undefined') {
    const userData = localStorage.getItem('haevn_user')
    if (!userData) {
      return {
        canViewPublic: true,
        canViewGated: false,
        canViewPrivate: false,
        hasHandshake: false
      }
    }

    const user = JSON.parse(userData)
    const viewerPartnershipId = `partnership-${user.email}`

    // Check if viewer is the owner
    if (viewerPartnershipId === partnershipId) {
      return {
        canViewPublic: true,
        canViewGated: true,
        canViewPrivate: true,
        hasHandshake: false
      }
    }

    // Check for handshake
    const handshakes = JSON.parse(localStorage.getItem('haevn_handshakes') || '[]')
    const handshake = handshakes.find((h: any) =>
      (h.a_partnership === partnershipId && h.b_partnership === viewerPartnershipId) ||
      (h.b_partnership === partnershipId && h.a_partnership === viewerPartnershipId)
    )

    if (!handshake) {
      return {
        canViewPublic: true,
        canViewGated: false,
        canViewPrivate: false,
        hasHandshake: false
      }
    }

    // Check for private photo grant
    const grants = JSON.parse(localStorage.getItem('haevn_photo_grants') || '{}')
    const grant = grants[handshake.id]

    return {
      canViewPublic: true,
      canViewGated: true,
      canViewPrivate: grant?.granted || false,
      hasHandshake: true,
      handshakeId: handshake.id,
      privatePhotoGrant: grant?.granted || false
    }
  }

  // Production: Server-side check via API
  try {
    const response = await fetch(`/api/profiles/${partnershipId}/visibility`, {
      headers: {
        'X-Viewer-Id': viewerId
      }
    })

    if (!response.ok) {
      return {
        canViewPublic: false,
        canViewGated: false,
        canViewPrivate: false,
        hasHandshake: false
      }
    }

    return await response.json()
  } catch (error) {
    console.error('Error checking visibility:', error)
    return {
      canViewPublic: false,
      canViewGated: false,
      canViewPrivate: false,
      hasHandshake: false
    }
  }
}

// Grant or revoke private photo access
export async function updatePhotoGrant(
  handshakeId: string,
  granted: boolean
): Promise<{ success: boolean; error?: string }> {
  // For development with localStorage
  if (typeof window !== 'undefined') {
    const grants = JSON.parse(localStorage.getItem('haevn_photo_grants') || '{}')

    grants[handshakeId] = {
      handshake_id: handshakeId,
      granted,
      updated_at: new Date().toISOString()
    }

    localStorage.setItem('haevn_photo_grants', JSON.stringify(grants))
    return { success: true }
  }

  // Production: Use API route
  try {
    const response = await fetch(`/api/photos/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ handshakeId, granted })
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to update grant' }
  }
}

// Get photos for a partnership
export async function getPartnershipPhotos(
  partnershipId: string,
  photoType?: 'public' | 'private'
): Promise<PhotoMetadata[]> {
  // For development with localStorage
  if (typeof window !== 'undefined') {
    const photos = JSON.parse(localStorage.getItem('haevn_photos') || '{}')
    const partnershipPhotos = photos[partnershipId] || []

    if (photoType) {
      return partnershipPhotos.filter((p: PhotoMetadata) => p.photo_type === photoType)
    }

    return partnershipPhotos
  }

  // Production: Use API route
  try {
    const params = new URLSearchParams({ partnership_id: partnershipId })
    if (photoType) params.append('type', photoType)

    const response = await fetch(`/api/photos?${params}`)

    if (!response.ok) return []

    return await response.json()
  } catch (error) {
    console.error('Error fetching photos:', error)
    return []
  }
}

// Delete a photo
export async function deletePhoto(photoId: string): Promise<{ success: boolean }> {
  // For development with localStorage
  if (typeof window !== 'undefined') {
    const photos = JSON.parse(localStorage.getItem('haevn_photos') || '{}')

    // Find and remove the photo
    for (const partnershipId in photos) {
      photos[partnershipId] = photos[partnershipId].filter(
        (p: PhotoMetadata) => p.id !== photoId
      )
    }

    localStorage.setItem('haevn_photos', JSON.stringify(photos))
    return { success: true }
  }

  // Production: Use API route
  try {
    const response = await fetch(`/api/photos/${photoId}`, {
      method: 'DELETE'
    })

    return { success: response.ok }
  } catch (error) {
    console.error('Error deleting photo:', error)
    return { success: false }
  }
}