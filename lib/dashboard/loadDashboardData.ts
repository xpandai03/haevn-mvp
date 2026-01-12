/**
 * Dashboard Data Loader
 * Server-side function to load all dashboard data
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateSurveyCompletion } from '@/lib/survey/questions'
import { getInternalCompatibility } from './getInternalCompatibility'
import { selectBestPartnership } from '@/lib/partnership/selectPartnership'
import type {
  DashboardData,
  PartnerInfo,
  PendingInviteInfo,
  CompatibilityScores,
  PartnerStatus
} from '@/lib/types/dashboard'

/**
 * Determine partner status based on their survey data
 */
function getPartnerStatus(
  surveyReviewed: boolean,
  completionPct: number
): PartnerStatus {
  if (completionPct >= 100 && surveyReviewed) {
    return 'completed'
  }
  if (completionPct > 0) {
    return 'in_progress'
  }
  return 'not_started'
}

/**
 * Load all dashboard data for the current user
 */
export async function loadDashboardData(): Promise<DashboardData | null> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user || authError) {
    console.error('[loadDashboardData] No authenticated user')
    return null
  }

  const adminClient = await createAdminClient()

  try {
    // 1. Fetch user profile
    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .single()

    // Get name from profile table OR auth user metadata (set during signup)
    const userName = profile?.full_name || user.user_metadata?.full_name || 'User'

    // 2. Get user's partnership membership (use deterministic selection for multiple)
    const membership = await selectBestPartnership(adminClient, user.id)

    // Default data if no partnership
    if (!membership) {
      // Get user's own survey completion
      const { data: userSurvey } = await adminClient
        .from('user_survey_responses')
        .select('answers_json, completion_pct')
        .eq('user_id', user.id)
        .maybeSingle()

      const userCompletion = userSurvey?.completion_pct ?? 0

      return {
        user: {
          id: user.id,
          email: user.email || ''
        },
        profile: {
          fullName: userName,
          photoUrl: undefined
        },
        partnership: null,
        partners: [],
        pendingInvites: [],
        onboarding: {
          userCompletion,
          allPartnersComplete: false
        },
        compatibility: null
      }
    }

    const partnershipId = membership.partnership_id

    // 3. Fetch partnership details
    const { data: partnership } = await adminClient
      .from('partnerships')
      .select('id, owner_id, profile_type, membership_tier, profile_state')
      .eq('id', partnershipId)
      .single()

    // 4. Fetch all partnership members with their profiles
    const { data: members } = await adminClient
      .from('partnership_members')
      .select(`
        user_id,
        role,
        joined_at,
        survey_reviewed,
        profiles (
          full_name,
          email
        )
      `)
      .eq('partnership_id', partnershipId)
      .order('joined_at', { ascending: true })

    // 5. Fetch survey responses for all members
    const memberUserIds = members?.map(m => m.user_id) || []
    const { data: surveyResponses } = await adminClient
      .from('user_survey_responses')
      .select('user_id, answers_json, completion_pct')
      .in('user_id', memberUserIds)

    // Create a map of survey responses by user_id
    const surveyMap = new Map<string, { completion_pct: number; answers_json: any }>()
    surveyResponses?.forEach(sr => {
      surveyMap.set(sr.user_id, {
        completion_pct: sr.completion_pct ?? 0,
        answers_json: sr.answers_json
      })
    })

    // 6. Build partner info list
    const partners: PartnerInfo[] = (members || []).map((member: any) => {
      const surveyData = surveyMap.get(member.user_id)
      const completionPct = surveyData?.completion_pct ?? 0

      return {
        userId: member.user_id,
        name: member.profiles?.full_name || 'Unknown',
        email: member.profiles?.email || '',
        role: member.role as 'owner' | 'member',
        status: getPartnerStatus(member.survey_reviewed, completionPct),
        onboardingCompletion: completionPct,
        surveyReviewed: member.survey_reviewed || false
      }
    })

    // 7. Fetch pending invites
    const { data: invites } = await adminClient
      .from('partnership_requests')
      .select('id, to_email, invite_code, created_at')
      .eq('partnership_id', partnershipId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    const pendingInvites: PendingInviteInfo[] = (invites || []).map(inv => ({
      id: inv.id,
      email: inv.to_email,
      inviteCode: inv.invite_code,
      createdAt: inv.created_at
    }))

    // 8. Calculate onboarding status
    const currentUserSurvey = surveyMap.get(user.id)
    const userCompletion = currentUserSurvey?.completion_pct ?? 0

    // All partners complete if everyone has 100% completion AND has reviewed
    const allPartnersComplete = partners.every(
      p => p.onboardingCompletion >= 100 && p.surveyReviewed
    )

    // 9. Get first profile photo (public type, ordered by index)
    // Query ALL photos first to debug, then select first public one
    const { data: allPhotos } = await adminClient
      .from('partnership_photos')
      .select('id, photo_url, photo_type, order_index')
      .eq('partnership_id', partnershipId)
      .order('order_index', { ascending: true })

    // Get first public photo for avatar
    const publicPhotos = (allPhotos || []).filter(p => p.photo_type === 'public')
    const photoUrl = publicPhotos.length > 0 ? publicPhotos[0].photo_url : undefined

    // Debug log (will remove after verification)
    console.log('[DASHBOARD_PHOTO_DEBUG]', {
      partnershipId,
      totalPhotos: allPhotos?.length || 0,
      publicPhotos: publicPhotos.length,
      selectedUrl: photoUrl ? 'found' : 'none',
      profileState: partnership?.profile_state
    })

    // 10. Get compatibility from matching engine
    let compatibility: CompatibilityScores | null = null
    if (allPartnersComplete && partnership) {
      const profileType = (partnership.profile_type as 'solo' | 'couple' | 'pod') || 'solo'
      compatibility = await getInternalCompatibility(
        adminClient,
        partnershipId,
        profileType
      )
    }

    return {
      user: {
        id: user.id,
        email: user.email || ''
      },
      profile: {
        fullName: userName,
        photoUrl
      },
      partnership: partnership ? {
        id: partnership.id,
        type: (partnership.profile_type as 'solo' | 'couple' | 'pod') || 'solo',
        tier: partnership.membership_tier === 'free' ? 'free' : 'plus',
        ownerId: partnership.owner_id,
        profileState: (partnership.profile_state as 'draft' | 'pending' | 'live') || 'draft'
      } : null,
      partners,
      pendingInvites,
      onboarding: {
        userCompletion,
        allPartnersComplete
      },
      compatibility
    }
  } catch (error) {
    console.error('[loadDashboardData] Error:', error)
    return null
  }
}
