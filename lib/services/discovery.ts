import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types/supabase'

type Partnership = Database['public']['Tables']['partnerships']['Row']

export interface DiscoveryProfile {
  id: string
  display_name: string
  short_bio: string
  city: string
  badges: string[]
  structure: any
  lifestyle_tags: string[]
  compatibility_score?: number
  compatibility_bucket?: 'high' | 'medium' | 'low'
  has_liked?: boolean
  has_passed?: boolean
}

export async function getDiscoveryProfiles(userId: string, city?: string, partnershipId?: string) {
  const supabase = createClient()

  try {
    let userPartnershipId = partnershipId

    // If no partnershipId provided, fetch it
    if (!userPartnershipId) {
      // CRITICAL: Use array select (no .single()) to distinguish "no rows" from "fetch error"
      const { data: memberships, error: memberError, status } = await supabase
        .from('partnership_members')
        .select('partnership_id')
        .eq('user_id', userId)

      // CRITICAL FIX: If fetch failed, DO NOT interpret as "no partnership"
      if (memberError) {
        console.error('[Discovery] Partnership fetch failed (NOT "no partnership"):', {
          error: memberError,
          code: memberError.code,
          status,
          message: memberError.message
        })
        return { profiles: [], error: 'Failed to load partnership data' }
      }

      // Only if fetch succeeded AND returned zero rows = user truly has no partnership
      if (!memberships || memberships.length === 0) {
        console.log('[Discovery] User has no partnership (0 rows returned)')
        return { profiles: [], error: 'User has no partnership' }
      }

      userPartnershipId = memberships[0].partnership_id
    }

    console.log('[Discovery] Using partnership:', userPartnershipId)

    // Get user's survey responses for compatibility scoring
    const { data: userSurvey } = await supabase
      .from('survey_responses')
      .select('answers_json')
      .eq('partnership_id', userPartnershipId)
      .single()

    // Query partnerships that are live and in the same city
    let query = supabase
      .from('partnerships')
      .select(`
        id,
        display_name,
        short_bio,
        city,
        badges,
        structure,
        lifestyle_tags,
        profile_state
      `)
      .eq('profile_state', 'live')
      .neq('id', userPartnershipId) // Exclude own partnership

    if (city) {
      query = query.eq('city', city)
    }

    const { data: partnerships, error } = await query

    if (error) throw error

    if (!partnerships || partnerships.length === 0) {
      return { profiles: [], error: null }
    }

    // Get signals to check if already liked/passed
    const { data: signals } = await supabase
      .from('signals')
      .select('to_partnership')
      .eq('from_partnership', userPartnershipId)

    const likedPartnershipIds = new Set(signals?.map(s => s.to_partnership) || [])

    // Calculate compatibility scores (simplified version)
    const profilesWithScores = partnerships.map(partnership => {
      // Simple compatibility calculation based on shared lifestyle tags
      let compatibilityScore = 50 // Base score

      if (userSurvey?.answers_json && partnership.lifestyle_tags) {
        const userTags = userSurvey.answers_json.lifestyle_tags || []
        const partnershipTags = partnership.lifestyle_tags as string[]

        const sharedTags = userTags.filter((tag: string) =>
          partnershipTags.includes(tag)
        )

        compatibilityScore += sharedTags.length * 10
        compatibilityScore = Math.min(100, compatibilityScore)
      }

      // Determine compatibility bucket
      let bucket: 'high' | 'medium' | 'low' = 'low'
      if (compatibilityScore >= 85) bucket = 'high'
      else if (compatibilityScore >= 70) bucket = 'medium'

      return {
        id: partnership.id,
        display_name: partnership.display_name || 'Partnership',
        short_bio: partnership.short_bio || '',
        city: partnership.city || '',
        badges: partnership.badges as string[] || [],
        structure: partnership.structure || {},
        lifestyle_tags: partnership.lifestyle_tags as string[] || [],
        compatibility_score: compatibilityScore,
        compatibility_bucket: bucket,
        has_liked: likedPartnershipIds.has(partnership.id),
        has_passed: false // Would need a separate passes table
      }
    })

    // Sort by compatibility score
    profilesWithScores.sort((a, b) => (b.compatibility_score || 0) - (a.compatibility_score || 0))

    return { profiles: profilesWithScores, error: null }
  } catch (error) {
    console.error('Error fetching discovery profiles:', error)
    return { profiles: [], error: 'Failed to load profiles' }
  }
}

export async function sendSignal(fromPartnershipId: string, toPartnershipId: string) {
  const supabase = createClient()

  try {
    // Insert signal (database trigger will handle handshake creation)
    const { data, error } = await supabase
      .from('signals')
      .insert({
        from_partnership: fromPartnershipId,
        to_partnership: toPartnershipId
      })
      .select()
      .single()

    if (error) {
      // Check if it's a unique constraint error (already liked)
      if (error.code === '23505') {
        return { data: null, error: 'Already liked this profile', matched: false }
      }
      throw error
    }

    // Check if a handshake was created (mutual like)
    const { data: handshake } = await supabase
      .from('handshakes')
      .select('id')
      .or(
        `and(a_partnership.eq.${fromPartnershipId},b_partnership.eq.${toPartnershipId}),and(a_partnership.eq.${toPartnershipId},b_partnership.eq.${fromPartnershipId})`
      )
      .single()

    return {
      data,
      error: null,
      matched: !!handshake
    }
  } catch (error) {
    console.error('Error sending signal:', error)
    return { data: null, error: 'Failed to send like', matched: false }
  }
}