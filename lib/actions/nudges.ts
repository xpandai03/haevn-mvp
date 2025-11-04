'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface NudgeItem {
  id: string
  type:
    | 'handshake_received'
    | 'handshake_accepted'
    | 'section_completed'
    | 'partner_joined'
    | 'partner_survey_progress'
    | 'partner_reviewed_survey'
    | 'invite_sent'
  title: string
  description: string
  created_at: string
  read: boolean
  link?: string
  metadata?: Record<string, any>
}

/**
 * Get all nudges/notifications for the current user
 */
export async function getUserNudges(): Promise<{ data: NudgeItem[], error: string | null }> {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { data: [], error: 'Not authenticated' }
  }

  try {
    const adminClient = createAdminClient()
    const nudges: NudgeItem[] = []

    // Get user's partnership
    const { data: memberData } = await adminClient
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!memberData) {
      return { data: [], error: null }
    }

    const partnershipId = memberData.partnership_id

    // 1. Get incoming handshake requests (not yet accepted)
    const { data: incomingHandshakes } = await adminClient
      .from('handshakes')
      .select(`
        id,
        created_at,
        a_partnership:partnerships!handshakes_a_partnership_id_fkey(id, display_name)
      `)
      .eq('b_partnership_id', partnershipId)
      .eq('a_consent', true)
      .eq('b_consent', false)

    if (incomingHandshakes) {
      incomingHandshakes.forEach((hs: any) => {
        nudges.push({
          id: `handshake-${hs.id}`,
          type: 'handshake_received',
          title: 'New Handshake Request',
          description: `${hs.a_partnership?.display_name || 'A partnership'} wants to connect with you!`,
          created_at: hs.created_at,
          read: false,
          link: '/connections',
          metadata: { handshake_id: hs.id }
        })
      })
    }

    // 2. Get accepted handshakes (mutual consent) from last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: acceptedHandshakes } = await adminClient
      .from('handshakes')
      .select(`
        id,
        updated_at,
        a_partnership:partnerships!handshakes_a_partnership_id_fkey(id, display_name),
        b_partnership:partnerships!handshakes_b_partnership_id_fkey(id, display_name)
      `)
      .or(`a_partnership_id.eq.${partnershipId},b_partnership_id.eq.${partnershipId}`)
      .eq('a_consent', true)
      .eq('b_consent', true)
      .gte('updated_at', sevenDaysAgo.toISOString())

    if (acceptedHandshakes) {
      acceptedHandshakes.forEach((hs: any) => {
        const otherPartnership = hs.a_partnership?.id === partnershipId
          ? hs.b_partnership
          : hs.a_partnership

        nudges.push({
          id: `accepted-${hs.id}`,
          type: 'handshake_accepted',
          title: 'New Connection!',
          description: `You're now connected with ${otherPartnership?.display_name || 'a partnership'}`,
          created_at: hs.updated_at,
          read: false,
          link: '/connections',
          metadata: { handshake_id: hs.id }
        })
      })
    }

    // 3. Get recent partnership survey completions (partnership-based, last 7 days)
    const { data: surveyData } = await adminClient
      .from('user_survey_responses')
      .select('completed_sections, updated_at, completion_pct')
      .eq('partnership_id', partnershipId)
      .gte('updated_at', sevenDaysAgo.toISOString())
      .maybeSingle()

    if (surveyData && surveyData.completed_sections) {
      const sections = surveyData.completed_sections as string[]
      if (sections.length > 0) {
        nudges.push({
          id: `survey-progress-${partnershipId}`,
          type: 'section_completed',
          title: 'Survey Progress!',
          description: `Your partnership completed ${sections.length} survey section${sections.length > 1 ? 's' : ''} (${surveyData.completion_pct}%)`,
          created_at: surveyData.updated_at,
          read: false,
          link: '/onboarding/survey',
          metadata: { completion_pct: surveyData.completion_pct }
        })
      }
    }

    // 4. Get recent partner joins (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: partnerJoins } = await adminClient
      .from('partnership_members')
      .select(`
        user_id,
        joined_at,
        role,
        profiles (
          full_name,
          email
        )
      `)
      .eq('partnership_id', partnershipId)
      .neq('user_id', user.id)
      .gte('joined_at', thirtyDaysAgo.toISOString())
      .order('joined_at', { ascending: false })

    if (partnerJoins && partnerJoins.length > 0) {
      partnerJoins.forEach((member: any) => {
        const partnerName = member.profiles?.full_name || member.profiles?.email || 'Your partner'
        nudges.push({
          id: `partner-joined-${member.user_id}`,
          type: 'partner_joined',
          title: 'New Partner Joined!',
          description: `${partnerName} joined your partnership`,
          created_at: member.joined_at,
          read: false,
          link: '/dashboard',
          metadata: { user_id: member.user_id }
        })
      })
    }

    // 5. Get recent partner survey reviews (last 30 days)
    const { data: partnerReviews } = await adminClient
      .from('partnership_members')
      .select(`
        user_id,
        survey_reviewed,
        survey_reviewed_at,
        profiles (
          full_name,
          email
        )
      `)
      .eq('partnership_id', partnershipId)
      .neq('user_id', user.id)
      .eq('survey_reviewed', true)
      .not('survey_reviewed_at', 'is', null)
      .gte('survey_reviewed_at', thirtyDaysAgo.toISOString())
      .order('survey_reviewed_at', { ascending: false })

    if (partnerReviews && partnerReviews.length > 0) {
      partnerReviews.forEach((member: any) => {
        const partnerName = member.profiles?.full_name || member.profiles?.email || 'Your partner'
        nudges.push({
          id: `partner-reviewed-${member.user_id}`,
          type: 'partner_reviewed_survey',
          title: 'Partner Reviewed Survey',
          description: `${partnerName} reviewed and approved your partnership survey`,
          created_at: member.survey_reviewed_at,
          read: false,
          link: '/dashboard',
          metadata: { user_id: member.user_id }
        })
      })
    }

    // 6. Get pending invites sent (last 30 days)
    const { data: sentInvites } = await adminClient
      .from('partnership_requests')
      .select('id, invite_code, to_email, created_at, status')
      .eq('partnership_id', partnershipId)
      .eq('from_user_id', user.id)
      .eq('status', 'pending')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    if (sentInvites && sentInvites.length > 0) {
      sentInvites.forEach((invite: any) => {
        nudges.push({
          id: `invite-sent-${invite.id}`,
          type: 'invite_sent',
          title: 'Invite Pending',
          description: `Waiting for ${invite.to_email} to accept your partnership invite (Code: ${invite.invite_code})`,
          created_at: invite.created_at,
          read: false,
          link: '/dashboard',
          metadata: { invite_id: invite.id, invite_code: invite.invite_code }
        })
      })
    }

    // Sort by date (newest first)
    nudges.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return { data: nudges, error: null }
  } catch (err) {
    console.error('[getUserNudges] Error:', err)
    return { data: [], error: 'Failed to load notifications' }
  }
}

/**
 * Get count of unread nudges
 */
export async function getUnreadNudgesCount(): Promise<{ count: number, error: string | null }> {
  const { data, error } = await getUserNudges()

  if (error) {
    return { count: 0, error }
  }

  const unreadCount = data.filter(n => !n.read).length
  return { count: unreadCount, error: null }
}
