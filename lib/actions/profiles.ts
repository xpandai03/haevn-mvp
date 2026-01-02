/**
 * Profile Actions
 * Server actions for fetching profile/partnership data
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface SurveyDisplayData {
  goals?: Record<string, any>
  communication?: Record<string, any>
  energy?: Record<string, any>
  boundaries?: Record<string, any>
  interests?: Record<string, any>
  bodyType?: Record<string, any>
  loveLanguages?: Record<string, any>
  kinks?: Record<string, any>
  preferences?: Record<string, any>
}

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
  surveyData?: SurveyDisplayData
  handshakeId?: string // If user is connected to this partnership
  isConnected: boolean
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

  // Use admin client to bypass RLS for reading other users' profiles
  const adminClient = createAdminClient()

  try {
    console.log('[getProfileData] Fetching partnership:', partnershipId)

    // Get partnership basic info (using admin client to bypass RLS)
    const { data: partnership, error: partnershipError } = await adminClient
      .from('partnerships')
      .select('id, display_name, city, membership_tier')
      .eq('id', partnershipId)
      .single()

    if (partnershipError || !partnership) {
      console.error('[getProfileData] Partnership not found:', partnershipError)
      return null
    }

    // Membership tier is now directly on partnerships table
    const membershipTier = partnership.membership_tier && partnership.membership_tier !== 'free' ? 'plus' : 'free'

    // Get all photos for this partnership (using admin client)
    const { data: photosData } = await adminClient
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

    // Get survey responses for this partnership (using admin client)
    const { data: surveyResponse } = await adminClient
      .from('survey_responses')
      .select('answers_json')
      .eq('partnership_id', partnershipId)
      .single()

    let surveyData: SurveyDisplayData | undefined
    if (surveyResponse?.answers_json) {
      surveyData = categorizeSurveyData(surveyResponse.answers_json as Record<string, any>)
    }

    // Check if current user is connected to this partnership
    // First get current user's partnership
    const { data: currentUserMembership } = await adminClient
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    let handshakeId: string | undefined
    let isConnected = false

    if (currentUserMembership) {
      const currentPartnershipId = currentUserMembership.partnership_id

      // Check for a matched handshake between current user's partnership and viewed partnership
      const { data: handshake } = await adminClient
        .from('handshakes')
        .select('id')
        .eq('state', 'matched')
        .eq('a_consent', true)
        .eq('b_consent', true)
        .or(`and(a_partnership.eq.${currentPartnershipId},b_partnership.eq.${partnershipId}),and(a_partnership.eq.${partnershipId},b_partnership.eq.${currentPartnershipId})`)
        .single()

      if (handshake) {
        handshakeId = handshake.id
        isConnected = true
      }
    }

    // Calculate compatibility (stub for now - would use matching engine)
    const compatibilityPercentage = undefined
    const topFactor = undefined

    return {
      partnershipId: partnership.id,
      displayName: partnership.display_name || 'User',
      city: partnership.city,
      membershipTier,
      primaryPhoto,
      photos,
      compatibilityPercentage,
      topFactor,
      surveyData,
      handshakeId,
      isConnected
    }

  } catch (error) {
    console.error('[getProfileData] Error:', error)
    return null
  }
}

/**
 * Categorize raw survey answers into display sections
 */
function categorizeSurveyData(answersJson: Record<string, any>): SurveyDisplayData {
  return {
    goals: {
      'Relationship Goals': answersJson.q7_relationship_goals,
      'Long-term Intentions': answersJson.q8_long_term_intentions,
      'Current Dating Stage': answersJson.q9_dating_stage
    },
    communication: {
      'Communication Style': answersJson.q15_communication_style,
      'Conflict Resolution': answersJson.q16_conflict_resolution,
      'Meeting Preferences': answersJson.q17_meeting_preferences
    },
    energy: {
      'Social Energy': answersJson.q18_social_energy,
      'Activity Level': answersJson.q19_activity_level,
      'Lifestyle Pace': answersJson.q20_lifestyle_pace
    },
    boundaries: {
      'Emotional Exclusivity': answersJson.q10_emotional_exclusivity,
      'Sexual Exclusivity': answersJson.q11_sexual_exclusivity,
      'Discretion Level': answersJson.q12_discretion_level
    },
    interests: {
      'Hobbies': answersJson.q21_hobbies,
      'Interests': answersJson.q22_interests,
      'Favorite Activities': answersJson.q23_activities
    },
    bodyType: {
      'Body Type': answersJson.q13_body_type,
      'Body Type Preferences': answersJson.q14_body_preferences
    },
    loveLanguages: {
      'Primary Love Language': answersJson.q24_love_language,
      'Secondary Love Language': answersJson.q25_secondary_love_language
    },
    kinks: {
      'Kink Openness': answersJson.q26_kink_openness,
      'Kink Interests': answersJson.q27_kink_interests
    },
    preferences: {
      'Age Range': answersJson.q3_age_preferences,
      'Location Preference': answersJson.q4_location_preference,
      'Distance': answersJson.q5_max_distance
    }
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
