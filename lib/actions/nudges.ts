'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface NudgeItem {
  id: string
  type: 'handshake_received' | 'handshake_accepted' | 'section_completed'
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

    // 3. Get recent survey section completions (last 7 days)
    const { data: surveyData } = await adminClient
      .from('user_survey_responses')
      .select('completed_sections, updated_at')
      .eq('user_id', user.id)
      .gte('updated_at', sevenDaysAgo.toISOString())
      .maybeSingle()

    if (surveyData && surveyData.completed_sections) {
      const sections = surveyData.completed_sections as string[]
      sections.forEach((sectionId: string, index: number) => {
        nudges.push({
          id: `section-${sectionId}`,
          type: 'section_completed',
          title: 'Survey Progress!',
          description: `You completed the ${sectionId.replace(/-/g, ' ')} section`,
          created_at: surveyData.updated_at,
          read: false,
          link: '/onboarding/survey',
          metadata: { section_id: sectionId }
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
