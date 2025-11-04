'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Fetch invite details for displaying invitation information
 */
export async function fetchInviteDetails(inviteCode: string): Promise<{
  success: boolean
  data?: {
    partnershipId: string
    inviterName: string
    inviterEmail: string
    city: string
    membershipTier: string
    surveyComplete: boolean
    surveyCompletionPct: number
  }
  error?: string
}> {
  try {
    const adminClient = createAdminClient()

    console.log('[fetchInviteDetails] Looking up invite code:', inviteCode)

    // Fetch invite with related partnership and inviter data
    const { data: invite, error: inviteError } = await adminClient
      .from('partnership_requests')
      .select(`
        partnership_id,
        from_user_id,
        status
      `)
      .eq('invite_code', inviteCode.toUpperCase())
      .eq('status', 'pending')
      .single()

    if (inviteError || !invite) {
      console.error('[fetchInviteDetails] Invite not found:', inviteError)
      return { success: false, error: 'Invalid or expired invite code' }
    }

    // Get inviter's profile information
    const { data: inviterProfile } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('user_id', invite.from_user_id)
      .single()

    // Get inviter's email from auth
    const { data: inviterAuth } = await adminClient.auth.admin.getUserById(invite.from_user_id)

    // Get partnership details
    const { data: partnership } = await adminClient
      .from('partnerships')
      .select('city, membership_tier')
      .eq('id', invite.partnership_id)
      .single()

    // Get survey completion status
    // DEFENSIVE GUARD: Validate partnership_id before querying
    let surveyData = null
    if (invite.partnership_id && typeof invite.partnership_id === 'string' && invite.partnership_id.length >= 10) {
      const result = await adminClient
        .from('user_survey_responses')
        .select('completion_pct')
        .eq('partnership_id', invite.partnership_id)
        .single()
      surveyData = result.data
    } else {
      console.warn('[fetchInviteDetails] ⚠️ Invalid partnershipId, skipping survey query')
    }

    console.log('[fetchInviteDetails] Invite details found:', {
      partnershipId: invite.partnership_id,
      inviterName: inviterProfile?.full_name,
      surveyCompletionPct: surveyData?.completion_pct || 0
    })

    return {
      success: true,
      data: {
        partnershipId: invite.partnership_id,
        inviterName: inviterProfile?.full_name || 'Your partner',
        inviterEmail: inviterAuth?.user?.email || '',
        city: partnership?.city || 'Unknown',
        membershipTier: partnership?.membership_tier || 'free',
        surveyComplete: surveyData?.completion_pct === 100,
        surveyCompletionPct: surveyData?.completion_pct || 0
      }
    }
  } catch (error) {
    console.error('[fetchInviteDetails] Error:', error)
    return { success: false, error: 'Failed to fetch invite details' }
  }
}

/**
 * Get partnership survey data for review
 */
export async function getPartnershipSurvey(partnershipId: string): Promise<{
  success: boolean
  data?: {
    answers: Record<string, any>
    completionPct: number
    currentStep: number
    completedSections: string[]
  }
  error?: string
}> {
  try {
    // DEFENSIVE GUARD: Validate partnership_id before querying
    if (!partnershipId || typeof partnershipId !== 'string' || partnershipId.length < 10) {
      console.warn('[getPartnershipSurvey] ⚠️ Missing or invalid partnershipId:', partnershipId)
      console.warn('[getPartnershipSurvey] partnershipId guard executed --- returning empty survey')
      return {
        success: true,
        data: {
          answers: {},
          completionPct: 0,
          currentStep: 0,
          completedSections: []
        }
      }
    }

    const adminClient = createAdminClient()

    console.log('[getPartnershipSurvey] ✅ Valid partnershipId, fetching survey:', partnershipId)

    const { data: surveyData, error: surveyError } = await adminClient
      .from('user_survey_responses')
      .select('answers_json, completion_pct, current_step, completed_sections')
      .eq('partnership_id', partnershipId)
      .single()

    if (surveyError || !surveyData) {
      console.error('[getPartnershipSurvey] Survey not found:', surveyError)
      return {
        success: true,  // Not an error, just no survey yet
        data: {
          answers: {},
          completionPct: 0,
          currentStep: 0,
          completedSections: []
        }
      }
    }

    console.log('[getPartnershipSurvey] Survey found:', {
      answerCount: Object.keys(surveyData.answers_json || {}).length,
      completionPct: surveyData.completion_pct
    })

    return {
      success: true,
      data: {
        answers: (surveyData.answers_json as Record<string, any>) || {},
        completionPct: surveyData.completion_pct || 0,
        currentStep: surveyData.current_step || 0,
        completedSections: (surveyData.completed_sections as string[]) || []
      }
    }
  } catch (error) {
    console.error('[getPartnershipSurvey] Error:', error)
    return { success: false, error: 'Failed to fetch survey data' }
  }
}

/**
 * Mark the current user as having reviewed the partnership survey
 */
export async function markSurveyReviewed(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[markSurveyReviewed] Not authenticated')
      return { success: false, error: 'Not authenticated' }
    }

    console.log('[markSurveyReviewed] Marking survey reviewed for user:', user.id)

    // Get user's partnership
    const { data: membership, error: membershipError } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      console.error('[markSurveyReviewed] No partnership found:', membershipError)
      return { success: false, error: 'No partnership found' }
    }

    // Update review status
    const { error: updateError } = await supabase
      .from('partnership_members')
      .update({
        survey_reviewed: true,
        survey_reviewed_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('partnership_id', membership.partnership_id)

    if (updateError) {
      console.error('[markSurveyReviewed] Update error:', updateError)
      return { success: false, error: 'Failed to mark survey as reviewed' }
    }

    console.log('[markSurveyReviewed] Survey marked as reviewed successfully')
    return { success: true }
  } catch (error) {
    console.error('[markSurveyReviewed] Error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Check if the current user has reviewed the partnership survey
 */
export async function hasUserReviewedSurvey(): Promise<{
  reviewed: boolean
  partnershipId?: string
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { reviewed: false, error: 'Not authenticated' }
    }

    const { data: membership, error: membershipError } = await supabase
      .from('partnership_members')
      .select('partnership_id, survey_reviewed')
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return { reviewed: false, error: 'No partnership found' }
    }

    return {
      reviewed: membership.survey_reviewed || false,
      partnershipId: membership.partnership_id
    }
  } catch (error) {
    console.error('[hasUserReviewedSurvey] Error:', error)
    return { reviewed: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get current user's partnership ID
 */
export async function getCurrentUserPartnershipId(): Promise<{
  success: boolean
  partnershipId?: string
  role?: string
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: membership, error: membershipError } = await supabase
      .from('partnership_members')
      .select('partnership_id, role')
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return { success: false, error: 'No partnership found' }
    }

    return {
      success: true,
      partnershipId: membership.partnership_id,
      role: membership.role
    }
  } catch (error) {
    console.error('[getCurrentUserPartnershipId] Error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
