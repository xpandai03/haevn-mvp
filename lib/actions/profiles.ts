/**
 * Profile Actions
 * Server actions for fetching profile/partnership data
 */

'use server'

import { createClient } from '@/lib/supabase/server'

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

    // Get survey responses for this partnership's users
    const { data: partnershipMembers } = await supabase
      .from('partnership_members')
      .select('user_id')
      .eq('partnership_id', partnershipId)

    let surveyData: SurveyDisplayData | undefined

    if (partnershipMembers && partnershipMembers.length > 0) {
      // Get first user's survey responses
      const { data: surveyResponse } = await supabase
        .from('user_survey_responses')
        .select('answers_json')
        .eq('user_id', partnershipMembers[0].user_id)
        .single()

      if (surveyResponse?.answers_json) {
        surveyData = categorizeSurveyData(surveyResponse.answers_json)
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
      surveyData
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
