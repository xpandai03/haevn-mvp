/**
 * Nudges Actions
 * Server actions for the nudge system (HAEVN+ premium feature)
 *
 * Definition: Nudges = lightweight way to express interest in a profile
 * - Only HAEVN+ members can send and respond to nudges
 * - Free users can see they received a nudge but must upgrade to respond
 * - One nudge per sender-recipient pair
 */

'use server'

import { createClient } from '@/lib/supabase/server'

export interface Nudge {
  id: string // Nudge ID
  senderId: string
  senderPartnershipId: string
  photo?: string
  username: string
  city?: string
  compatibilityPercentage: number
  topFactor: string
  nudgedAt: Date
  isRead: boolean
}

/**
 * Get all nudges received by the current user
 * Returns profiles who have nudged the user
 * Sorted by: unread first, then by date (most recent first)
 */
export async function getReceivedNudges(): Promise<Nudge[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  try {
    console.log('[getReceivedNudges] Fetching for user:', user.id)

    // Get user's partnership
    const { data: userPartnership } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .single()

    if (!userPartnership) {
      console.log('[getReceivedNudges] No partnership found')
      return []
    }

    // Get all nudges where current user is recipient
    const { data: nudges, error: nudgesError } = await supabase
      .from('nudges')
      .select(`
        id,
        sender_id,
        created_at,
        read_at
      `)
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })

    if (nudgesError) {
      console.error('[getReceivedNudges] Error fetching nudges:', nudgesError)
      return []
    }

    if (!nudges || nudges.length === 0) {
      console.log('[getReceivedNudges] No nudges found')
      return []
    }

    // Build nudges array with sender partnership data
    const nudgesWithData: Nudge[] = []

    for (const nudge of nudges) {
      // Get sender's partnership
      const { data: senderPartnership } = await supabase
        .from('partnership_members')
        .select(`
          partnership_id,
          partnership:partnerships(id, display_name, city)
        `)
        .eq('user_id', nudge.sender_id)
        .single()

      if (!senderPartnership?.partnership) continue

      const partnership = Array.isArray(senderPartnership.partnership)
        ? senderPartnership.partnership[0]
        : senderPartnership.partnership

      // Get primary photo for sender's partnership
      const { data: photoData } = await supabase
        .from('partnership_photos')
        .select('storage_path')
        .eq('partnership_id', partnership.id)
        .eq('is_primary', true)
        .eq('photo_type', 'public')
        .single()

      let photoUrl: string | undefined
      if (photoData) {
        const { data: { publicUrl } } = supabase
          .storage
          .from('partnership-photos')
          .getPublicUrl(photoData.storage_path)
        photoUrl = publicUrl
      }

      // TODO: Calculate actual compatibility from survey responses
      // For now, use stub values
      const compatibilityPercentage = 80
      const topFactor = 'Mutual interest'

      nudgesWithData.push({
        id: nudge.id,
        senderId: nudge.sender_id,
        senderPartnershipId: partnership.id,
        photo: photoUrl,
        username: partnership.display_name || 'User',
        city: partnership.city,
        compatibilityPercentage,
        topFactor,
        nudgedAt: new Date(nudge.created_at),
        isRead: !!nudge.read_at
      })
    }

    // Sort: unread first, then by date
    nudgesWithData.sort((a, b) => {
      if (!a.isRead && b.isRead) return -1
      if (a.isRead && !b.isRead) return 1
      return b.nudgedAt.getTime() - a.nudgedAt.getTime()
    })

    console.log('[getReceivedNudges] Found', nudgesWithData.length, 'nudges')
    return nudgesWithData

  } catch (error) {
    console.error('[getReceivedNudges] Error:', error)
    return []
  }
}

/**
 * Get all nudges sent by the current user
 */
export async function getSentNudges(): Promise<Nudge[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  try {
    console.log('[getSentNudges] Fetching for user:', user.id)

    // Get user's partnership
    const { data: userPartnership } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .single()

    if (!userPartnership) {
      console.log('[getSentNudges] No partnership found')
      return []
    }

    // Get all nudges sent by current user
    const { data: nudges, error: nudgesError } = await supabase
      .from('nudges')
      .select(`
        id,
        recipient_id,
        created_at,
        read_at
      `)
      .eq('sender_id', user.id)
      .order('created_at', { ascending: false })

    if (nudgesError) {
      console.error('[getSentNudges] Error fetching nudges:', nudgesError)
      return []
    }

    if (!nudges || nudges.length === 0) {
      console.log('[getSentNudges] No sent nudges found')
      return []
    }

    // Build nudges array with recipient partnership data
    const nudgesWithData: Nudge[] = []

    for (const nudge of nudges) {
      // Get recipient's partnership
      const { data: recipientPartnership } = await supabase
        .from('partnership_members')
        .select(`
          partnership_id,
          partnership:partnerships(id, display_name, city)
        `)
        .eq('user_id', nudge.recipient_id)
        .single()

      if (!recipientPartnership?.partnership) continue

      const partnership = Array.isArray(recipientPartnership.partnership)
        ? recipientPartnership.partnership[0]
        : recipientPartnership.partnership

      // Get primary photo for recipient's partnership
      const { data: photoData } = await supabase
        .from('partnership_photos')
        .select('storage_path')
        .eq('partnership_id', partnership.id)
        .eq('is_primary', true)
        .eq('photo_type', 'public')
        .single()

      let photoUrl: string | undefined
      if (photoData) {
        const { data: { publicUrl } } = supabase
          .storage
          .from('partnership-photos')
          .getPublicUrl(photoData.storage_path)
        photoUrl = publicUrl
      }

      // TODO: Calculate actual compatibility from survey responses
      const compatibilityPercentage = 80
      const topFactor = 'Mutual interest'

      nudgesWithData.push({
        id: nudge.id,
        senderId: user.id,
        senderPartnershipId: partnership.id,
        photo: photoUrl,
        username: partnership.display_name || 'User',
        city: partnership.city,
        compatibilityPercentage,
        topFactor,
        nudgedAt: new Date(nudge.created_at),
        isRead: !!nudge.read_at
      })
    }

    console.log('[getSentNudges] Found', nudgesWithData.length, 'sent nudges')
    return nudgesWithData

  } catch (error) {
    console.error('[getSentNudges] Error:', error)
    return []
  }
}

/**
 * Send a nudge to another user
 * Requires HAEVN+ membership
 */
export async function sendNudge(recipientUserId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Check if sender has HAEVN+ membership
    const { data: profile } = await supabase
      .from('profiles')
      .select('membership_tier')
      .eq('user_id', user.id)
      .single()

    if (profile?.membership_tier !== 'plus') {
      return { success: false, error: 'HAEVN+ membership required to send nudges' }
    }

    // Check if nudge already exists
    const { data: existingNudge } = await supabase
      .from('nudges')
      .select('id')
      .eq('sender_id', user.id)
      .eq('recipient_id', recipientUserId)
      .single()

    if (existingNudge) {
      return { success: false, error: 'You have already nudged this user' }
    }

    // Create nudge
    const { error: insertError } = await supabase
      .from('nudges')
      .insert({
        sender_id: user.id,
        recipient_id: recipientUserId
      })

    if (insertError) {
      console.error('[sendNudge] Error creating nudge:', insertError)
      return { success: false, error: 'Failed to send nudge' }
    }

    console.log('[sendNudge] ✅ Nudge sent to user:', recipientUserId)
    return { success: true }

  } catch (error) {
    console.error('[sendNudge] Error:', error)
    return { success: false, error: 'Failed to send nudge' }
  }
}

/**
 * Mark a nudge as read
 */
export async function markNudgeAsRead(nudgeId: string): Promise<{ success: boolean }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false }
  }

  try {
    const { error } = await supabase
      .from('nudges')
      .update({ read_at: new Date().toISOString() })
      .eq('id', nudgeId)
      .eq('recipient_id', user.id) // Ensure user owns this nudge

    if (error) {
      console.error('[markNudgeAsRead] Error:', error)
      return { success: false }
    }

    console.log('[markNudgeAsRead] ✅ Nudge marked as read:', nudgeId)
    return { success: true }

  } catch (error) {
    console.error('[markNudgeAsRead] Error:', error)
    return { success: false }
  }
}

/**
 * Check if current user has nudged a specific user
 */
export async function hasNudgedUser(recipientUserId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  try {
    const { data } = await supabase
      .from('nudges')
      .select('id')
      .eq('sender_id', user.id)
      .eq('recipient_id', recipientUserId)
      .single()

    return !!data

  } catch (error) {
    return false
  }
}
