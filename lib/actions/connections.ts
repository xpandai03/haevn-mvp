/**
 * Connections Actions
 * Server actions for fetching and managing connections
 *
 * Definition: Connections = profiles where mutual match OR active conversation exists
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { calculateMatch } from '@/lib/matching/scoring'

export interface Connection {
  id: string // Partnership ID
  photo?: string
  username: string
  city?: string
  distance?: number
  compatibilityPercentage: number
  topFactor: string
  // Connection-specific fields
  latestMessage?: string
  latestMessageAt?: Date
  unreadCount: number
  hasActiveConversation: boolean
  isMutualMatch: boolean
}

/**
 * Get all connections for the current user
 * Returns profiles with mutual matches or active conversations
 * Sorted by: active conversations first, then by recent activity
 */
export async function getConnections(): Promise<Connection[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  try {
    console.log('[getConnections] Fetching for user:', user.id)

    // Get user's partnership
    const { data: userPartnership } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .single()

    if (!userPartnership) {
      console.log('[getConnections] No partnership found')
      return []
    }

    const partnershipId = userPartnership.partnership_id

    // Get all handshakes (mutual matches) for this partnership
    const { data: handshakes, error: handshakesError } = await supabase
      .from('handshakes')
      .select(`
        id,
        a_partnership,
        b_partnership,
        created_at,
        a_partnership_data:partnerships!handshakes_a_partnership_fkey(id, display_name, city),
        b_partnership_data:partnerships!handshakes_b_partnership_fkey(id, display_name, city)
      `)
      .or(`a_partnership.eq.${partnershipId},b_partnership.eq.${partnershipId}`)

    if (handshakesError) {
      console.error('[getConnections] Error fetching handshakes:', handshakesError)
      return []
    }

    if (!handshakes || handshakes.length === 0) {
      console.log('[getConnections] No handshakes found')
      return []
    }

    // Build connections array
    const connections: Connection[] = []

    for (const handshake of handshakes) {
      // Determine which partnership is the "other" one
      const isUserA = handshake.a_partnership === partnershipId
      const otherPartnership = isUserA
        ? handshake.b_partnership_data
        : handshake.a_partnership_data

      if (!otherPartnership) continue

      // Get latest message for this handshake
      const { data: latestMessageData } = await supabase
        .from('messages')
        .select('body, created_at, sender_user')
        .eq('handshake_id', handshake.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // Get unread count (messages sent by other user that current user hasn't read)
      const { count: unreadCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('handshake_id', handshake.id)
        .neq('sender_user', user.id)
        .is('read_at', null)

      // Get primary photo for other partnership
      const { data: photoData } = await supabase
        .from('partnership_photos')
        .select('storage_path')
        .eq('partnership_id', otherPartnership.id)
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

      // Calculate compatibility (stub for now - would need full profile data)
      // TODO: Fetch survey responses and calculate actual compatibility
      const compatibilityPercentage = 75 // Stub value
      const topFactor = 'Mutual connection'

      connections.push({
        id: otherPartnership.id,
        photo: photoUrl,
        username: otherPartnership.display_name || 'User',
        city: otherPartnership.city,
        compatibilityPercentage,
        topFactor,
        latestMessage: latestMessageData?.body,
        latestMessageAt: latestMessageData ? new Date(latestMessageData.created_at) : undefined,
        unreadCount: unreadCount || 0,
        hasActiveConversation: !!latestMessageData,
        isMutualMatch: true
      })
    }

    // Sort connections:
    // 1. Active conversations (has messages) first
    // 2. Then by most recent message
    // 3. Then by match date
    connections.sort((a, b) => {
      // Active conversations first
      if (a.hasActiveConversation && !b.hasActiveConversation) return -1
      if (!a.hasActiveConversation && b.hasActiveConversation) return 1

      // Then by latest message time
      if (a.latestMessageAt && b.latestMessageAt) {
        return b.latestMessageAt.getTime() - a.latestMessageAt.getTime()
      }
      if (a.latestMessageAt && !b.latestMessageAt) return -1
      if (!a.latestMessageAt && b.latestMessageAt) return 1

      // Fallback: alphabetical
      return a.username.localeCompare(b.username)
    })

    console.log('[getConnections] Found', connections.length, 'connections')
    return connections

  } catch (error) {
    console.error('[getConnections] Error:', error)
    return []
  }
}

/**
 * Get a single connection by partnership ID
 */
export async function getConnection(partnershipId: string): Promise<Connection | null> {
  const connections = await getConnections()
  return connections.find(c => c.id === partnershipId) || null
}
