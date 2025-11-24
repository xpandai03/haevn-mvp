/**
 * Profile Actions
 * Server actions for fetching profile/partnership data
 */

'use server'

import { createClient } from '@/lib/supabase/server'

export interface ProfileData {
  partnershipId: string
  displayName: string
  city?: string
  distance?: number
  membershipTier: 'free' | 'plus'
  bio?: string
  primaryPhoto?: string
  photos: string[]
  compatibilityPercentage?: number
  topFactor?: string
  // Survey data (will be populated in BATCH 13)
  surveyData?: any
}

/**
 * Get full profile data for a partnership
 */
export async function getProfileData(partnershipId: string): Promise<ProfileData | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  try {
    console.log('[getProfileData] Fetching partnership:', partnershipId)

    // Get partnership basic info
    const { data: partnership, error: partnershipError } = await supabase
      .from('partnerships')
      .select('id, display_name, city')
      .eq('id', partnershipId)
      .single()

    if (partnershipError || !partnership) {
      console.error('[getProfileData] Partnership not found:', partnershipError)
      return null
    }

    // Get membership tier from first user in partnership
    const { data: partnershipMember } = await supabase
      .from('partnership_members')
      .select(`
        user_id,
        user:profiles(membership_tier)
      `)
      .eq('partnership_id', partnershipId)
      .limit(1)
      .single()

    const membershipTier = (partnershipMember?.user as any)?.membership_tier === 'plus' ? 'plus' : 'free'

    // Get all photos for this partnership
    const { data: photosData } = await supabase
      .from('partnership_photos')
      .select('storage_path, is_primary')
      .eq('partnership_id', partnershipId)
      .eq('photo_type', 'public')
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })

    let photos: string[] = []
    let primaryPhoto: string | undefined

    if (photosData && photosData.length > 0) {
      photos = photosData.map(photo => {
        const { data: { publicUrl } } = supabase
          .storage
          .from('partnership-photos')
          .getPublicUrl(photo.storage_path)
        
        if (photo.is_primary) {
          primaryPhoto = publicUrl
        }
        
        return publicUrl
      })
    }

    // TODO: Calculate compatibility with current user (BATCH 13)
    const compatibilityPercentage = undefined
    const topFactor = undefined

    // TODO: Fetch survey data (BATCH 13)
    const surveyData = undefined

    return {
      partnershipId: partnership.id,
      displayName: partnership.display_name || 'User',
      city: partnership.city,
      membershipTier,
      primaryPhoto,
      photos,
      compatibilityPercentage,
      topFactor,
      surveyData
    }

  } catch (error) {
    console.error('[getProfileData] Error:', error)
    return null
  }
}

/**
 * Get bio/about text for a partnership
 */
export async function getPartnershipBio(partnershipId: string): Promise<string | null> {
  const supabase = await createClient()

  try {
    // Bio might be stored in partnerships table or separate bio field
    // For now, return null - will be implemented with survey data
    return null
  } catch (error) {
    console.error('[getPartnershipBio] Error:', error)
    return null
  }
}
