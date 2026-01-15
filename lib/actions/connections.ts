/**
 * Connections Actions
 *
 * Server actions for fetching and managing connections.
 * Uses the NEW 5-category matching engine for compatibility scores.
 */

'use server'

import {
  getConnectionsWithCompatibility,
  getConnectionDetails,
  type ConnectionResult,
} from '@/lib/connections/getConnections'
import { type UnreadCounts } from '@/lib/services/chat'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Re-export UnreadCounts type
export type { UnreadCounts }

// Re-export types for convenience
export type { ConnectionResult }

/**
 * Get all connections for the current user with full compatibility breakdown.
 *
 * @returns Array of connections sorted by matched_at descending
 */
export async function getMyConnections(): Promise<ConnectionResult[]> {
  return getConnectionsWithCompatibility()
}

/**
 * Get details for a specific connection.
 *
 * @param connectionId - Either the handshake ID or the other partnership's ID
 * @returns Connection details with full compatibility breakdown, or null if not found
 */
export async function getConnectionById(
  connectionId: string
): Promise<ConnectionResult | null> {
  return getConnectionDetails(connectionId)
}

// =============================================================================
// CONVERSATION LIST (for /chat page)
// =============================================================================

export interface ConversationItem {
  handshakeId: string
  partnershipId: string
  displayName: string
  city: string | null
  photoUrl: string | null
  lastMessage: {
    body: string
    createdAt: string
    isOwn: boolean
  } | null
  unreadCount: number
  matchedAt: string | null
}

/**
 * Get all conversations (matched handshakes) for the current user.
 * Uses admin client to bypass RLS issues.
 */
export async function getMyConversations(): Promise<ConversationItem[]> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[getMyConversations] Not authenticated')
      return []
    }

    const adminClient = await createAdminClient()

    // Get user's partnership(s)
    const { data: memberships, error: memberError } = await adminClient
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)

    if (memberError || !memberships || memberships.length === 0) {
      console.error('[getMyConversations] No partnerships found')
      return []
    }

    const userPartnershipIds = memberships.map(m => m.partnership_id)

    // Build OR condition for all user's partnerships
    const orConditions = userPartnershipIds
      .map(pid => `a_partnership.eq.${pid},b_partnership.eq.${pid}`)
      .join(',')

    // Get all matched handshakes with partnership info and messages
    const { data: handshakes, error: handshakeError } = await adminClient
      .from('handshakes')
      .select(`
        id,
        a_partnership,
        b_partnership,
        matched_at,
        partnership_a:a_partnership(id, display_name, city),
        partnership_b:b_partnership(id, display_name, city),
        messages(
          id,
          content,
          sender_partnership,
          created_at
        )
      `)
      .or(orConditions)
      .eq('state', 'matched')
      .order('matched_at', { ascending: false })

    if (handshakeError || !handshakes) {
      console.error('[getMyConversations] Fetch error:', handshakeError)
      return []
    }

    // Get unread counts
    const unreadCounts = await getUnreadCountsForUser(user.id)

    // Get photos for all "other" partnerships
    const conversations: ConversationItem[] = []

    for (const handshake of handshakes) {
      // Determine which partnership is "other"
      const userPartnershipInHandshake = userPartnershipIds.find(
        pid => pid === handshake.a_partnership || pid === handshake.b_partnership
      )

      if (!userPartnershipInHandshake) continue

      const isUserA = handshake.a_partnership === userPartnershipInHandshake
      const otherPartnership = isUserA
        ? (handshake.partnership_b as any)
        : (handshake.partnership_a as any)

      if (!otherPartnership) continue

      // Get photo for other partnership
      const { data: photoData } = await adminClient
        .from('partnership_photos')
        .select('storage_path')
        .eq('partnership_id', otherPartnership.id)
        .eq('is_primary', true)
        .eq('photo_type', 'public')
        .maybeSingle()

      let photoUrl: string | null = null
      if (photoData?.storage_path) {
        const { data: { publicUrl } } = supabase
          .storage
          .from('partnership-photos')
          .getPublicUrl(photoData.storage_path)
        photoUrl = publicUrl
      }

      // Get last message
      const messages = (handshake.messages as any[]) || []
      const sortedMessages = messages.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      const lastMessage = sortedMessages[0]

      conversations.push({
        handshakeId: handshake.id,
        partnershipId: otherPartnership.id,
        displayName: otherPartnership.display_name || 'User',
        city: otherPartnership.city,
        photoUrl,
        lastMessage: lastMessage ? {
          body: lastMessage.content,
          createdAt: lastMessage.created_at,
          isOwn: lastMessage.sender_partnership === userPartnershipInHandshake
        } : null,
        unreadCount: unreadCounts.byHandshake[handshake.id] || 0,
        matchedAt: handshake.matched_at
      })
    }

    return conversations
  } catch (error) {
    console.error('[getMyConversations] Error:', error)
    return []
  }
}

/**
 * Internal helper to get unread counts for a specific user.
 * Uses admin client to bypass RLS issues with messages table.
 */
export async function getUnreadCountsForUser(userId: string): Promise<UnreadCounts> {
  const adminClient = await createAdminClient()

  try {
    // Get user's partnership(s)
    const { data: memberships, error: memberError } = await adminClient
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)

    if (memberError || !memberships || memberships.length === 0) {
      return { total: 0, byHandshake: {} }
    }

    const userPartnershipIds = memberships.map(m => m.partnership_id)

    // Build OR condition for all user's partnerships
    const orConditions = userPartnershipIds
      .map(pid => `a_partnership.eq.${pid},b_partnership.eq.${pid}`)
      .join(',')

    // Get all matched handshakes with messages
    const { data: handshakes, error: handshakeError } = await adminClient
      .from('handshakes')
      .select(`
        id,
        a_partnership,
        b_partnership,
        messages(
          id,
          sender_partnership,
          created_at
        )
      `)
      .or(orConditions)
      .eq('state', 'matched')

    if (handshakeError || !handshakes) {
      console.error('[getUnreadCountsForUser] Handshake fetch error:', handshakeError)
      return { total: 0, byHandshake: {} }
    }

    // Get all read statuses for this user
    const handshakeIds = handshakes.map(h => h.id)
    const { data: readStatuses } = await adminClient
      .from('message_reads')
      .select('handshake_id, last_read_at')
      .eq('user_id', userId)
      .in('handshake_id', handshakeIds)

    const readStatusMap = new Map<string, Date>()
    readStatuses?.forEach(rs => {
      readStatusMap.set(rs.handshake_id, new Date(rs.last_read_at))
    })

    // Calculate unread counts
    const byHandshake: Record<string, number> = {}
    let total = 0

    for (const handshake of handshakes) {
      const messages = (handshake.messages as any[]) || []
      const lastReadAt = readStatusMap.get(handshake.id) || new Date(0)

      // Find which of user's partnerships is in this handshake
      const userPartnershipInHandshake = userPartnershipIds.find(
        pid => pid === handshake.a_partnership || pid === handshake.b_partnership
      )

      if (!userPartnershipInHandshake) continue

      // Count unread: messages from OTHER partnership, created AFTER last_read_at
      const unreadCount = messages.filter(msg =>
        msg.sender_partnership !== userPartnershipInHandshake &&
        new Date(msg.created_at) > lastReadAt
      ).length

      if (unreadCount > 0) {
        byHandshake[handshake.id] = unreadCount
        total += unreadCount
      }
    }

    return { total, byHandshake }
  } catch (error) {
    console.error('[getUnreadCountsForUser] Error:', error)
    return { total: 0, byHandshake: {} }
  }
}

/**
 * Get unread message counts for the current user.
 * Returns total count and per-handshake breakdown.
 * Uses admin client to bypass RLS issues with messages table.
 *
 * @returns UnreadCounts with total and byHandshake map
 */
export async function getUnreadCounts(): Promise<UnreadCounts> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error('[getUnreadCounts] No authenticated user')
    return { total: 0, byHandshake: {} }
  }

  return getUnreadCountsForUser(user.id)
}

// =============================================================================
// LEGACY COMPATIBILITY
// =============================================================================

/**
 * @deprecated Use getMyConnections() instead - provides full compatibility breakdown
 */
export interface Connection {
  id: string
  photo?: string
  username: string
  city?: string
  distance?: number
  compatibilityPercentage: number
  topFactor: string
  latestMessage?: string
  latestMessageAt?: Date
  unreadCount: number
  hasActiveConversation: boolean
  isMutualMatch: boolean
}

/**
 * @deprecated Use getMyConnections() instead
 *
 * Legacy function maintained for backward compatibility.
 * Returns connections in the old format.
 */
export async function getConnections(): Promise<Connection[]> {
  const connections = await getConnectionsWithCompatibility()

  // Map to legacy format
  return connections.map(conn => {
    // Find top category for "topFactor"
    const topCategory = conn.compatibility.categories
      .filter(c => c.included)
      .reduce((best, cat) => cat.score > best.score ? cat : best, { category: 'intent', score: 0 })

    const categoryLabels: Record<string, string> = {
      intent: 'Intent & Goals',
      structure: 'Structure Fit',
      connection: 'Connection Style',
      chemistry: 'Sexual Chemistry',
      lifestyle: 'Lifestyle Fit',
    }

    return {
      id: conn.partnership.id,
      photo: conn.partnership.photo_url,
      username: conn.partnership.display_name || 'User',
      city: conn.partnership.city,
      compatibilityPercentage: conn.compatibility.overallScore,
      topFactor: categoryLabels[topCategory.category] || 'Compatible',
      // These fields require message data - not currently fetched
      latestMessage: undefined,
      latestMessageAt: undefined,
      unreadCount: 0,
      hasActiveConversation: false,
      isMutualMatch: true,
    }
  })
}

/**
 * @deprecated Use getConnectionById() instead
 */
export async function getConnection(partnershipId: string): Promise<Connection | null> {
  const connections = await getConnections()
  return connections.find(c => c.id === partnershipId) || null
}

// =============================================================================
// CHAT ACTIONS (Admin client to bypass RLS)
// =============================================================================

export interface ChatMessage {
  id: string
  handshake_id: string
  sender_user: string
  sender_name?: string
  sender_partnership_id?: string
  body: string
  image_url?: string  // Optional image URL for image messages
  created_at: string
  is_own_message?: boolean
}

/**
 * Get messages for a handshake using admin client.
 * Bypasses RLS to ensure messages can be read regardless of client auth state.
 */
export async function getMessagesForHandshake(
  handshakeId: string
): Promise<ChatMessage[]> {
  try {
    // Get current user from server-side auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[getMessagesForHandshake] Not authenticated')
      return []
    }

    const adminClient = await createAdminClient()

    // Get user's partnership(s)
    const { data: memberships, error: memberError } = await adminClient
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)

    if (memberError || !memberships || memberships.length === 0) {
      console.error('[getMessagesForHandshake] No partnerships found:', memberError)
      return []
    }

    const userPartnershipIds = memberships.map(m => m.partnership_id)

    // Verify user is part of this handshake
    const { data: handshake, error: handshakeError } = await adminClient
      .from('handshakes')
      .select('id, a_partnership, b_partnership, state')
      .eq('id', handshakeId)
      .single()

    if (handshakeError || !handshake) {
      console.error('[getMessagesForHandshake] Handshake not found:', handshakeError)
      return []
    }

    // Check if any of user's partnerships is part of this handshake
    const userPartnershipInHandshake = userPartnershipIds.find(
      pid => pid === handshake.a_partnership || pid === handshake.b_partnership
    )

    if (!userPartnershipInHandshake) {
      console.error('[getMessagesForHandshake] User not part of handshake')
      return []
    }

    if (handshake.state !== 'matched') {
      console.error('[getMessagesForHandshake] Handshake not matched')
      return []
    }

    // Fetch messages using admin client
    const { data: messages, error: messagesError } = await adminClient
      .from('messages')
      .select(`
        id,
        handshake_id,
        sender_partnership,
        content,
        image_url,
        created_at
      `)
      .eq('handshake_id', handshakeId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('[getMessagesForHandshake] Messages fetch error:', messagesError)
      return []
    }

    if (!messages || messages.length === 0) {
      return []
    }

    // Get partnership display names for all unique senders
    const senderIds = [...new Set(messages.map(m => m.sender_partnership))]
    const { data: partnerships } = await adminClient
      .from('partnerships')
      .select('id, display_name')
      .in('id', senderIds)

    const partnershipNames = new Map<string, string>()
    partnerships?.forEach(p => {
      partnershipNames.set(p.id, p.display_name || 'Unknown')
    })

    // Map to ChatMessage format
    return messages.map(msg => ({
      id: msg.id,
      handshake_id: msg.handshake_id,
      sender_user: '', // Not stored in schema
      sender_name: partnershipNames.get(msg.sender_partnership) || 'Unknown',
      sender_partnership_id: msg.sender_partnership,
      body: msg.content,
      image_url: msg.image_url || undefined,
      created_at: msg.created_at,
      is_own_message: msg.sender_partnership === userPartnershipInHandshake
    }))
  } catch (error) {
    console.error('[getMessagesForHandshake] Error:', error)
    return []
  }
}

/**
 * Send a message in a connection chat using admin client.
 * Bypasses RLS to ensure message inserts work regardless of partnership_members setup.
 */
export async function sendMessageAction(
  handshakeId: string,
  body: string,
  imageUrl?: string  // Optional image URL for image messages
): Promise<{ message?: ChatMessage; error?: string }> {
  try {
    // Get current user from server-side auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: 'Not authenticated' }
    }

    const userId = user.id

    // Validate message - either text or image required
    if (!body.trim() && !imageUrl) {
      return { error: 'Message cannot be empty' }
    }

    if (body.length > 2000) {
      return { error: 'Message too long (max 2000 characters)' }
    }

    const adminClient = await createAdminClient()

    // Verify handshake exists and user is part of it
    const { data: handshake, error: handshakeError } = await adminClient
      .from('handshakes')
      .select('id, a_partnership, b_partnership, state')
      .eq('id', handshakeId)
      .single()

    if (handshakeError || !handshake) {
      console.error('[sendMessageAction] Handshake not found:', handshakeError)
      return { error: 'Handshake not found' }
    }

    if (handshake.state !== 'matched') {
      return { error: 'Chat is only available for matched connections' }
    }

    // Get ALL user's partnerships (user may have multiple)
    const { data: memberships, error: membershipError } = await adminClient
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)

    if (membershipError || !memberships || memberships.length === 0) {
      console.error('[sendMessageAction] No partnerships found for user:', membershipError)
      return { error: 'User has no partnership' }
    }

    // Check if ANY of user's partnerships is part of the handshake
    const userPartnershipIds = memberships.map(m => m.partnership_id)
    const matchingPartnershipId = userPartnershipIds.find(pid =>
      pid === handshake.a_partnership || pid === handshake.b_partnership
    )

    if (!matchingPartnershipId) {
      console.error('[sendMessageAction] User not part of handshake:', { userPartnershipIds, handshake })
      return { error: 'Unauthorized to send messages in this chat' }
    }

    const userPartnershipId = matchingPartnershipId

    // Insert message using admin client (bypasses RLS)
    // NOTE: Schema uses sender_partnership + content (not sender_user + body)
    const { data: newMessage, error: insertError } = await adminClient
      .from('messages')
      .insert({
        handshake_id: handshakeId,
        sender_partnership: userPartnershipId,
        content: body.trim(),
        image_url: imageUrl || null
      })
      .select()
      .single()

    if (insertError) {
      console.error('[sendMessageAction] Insert failed:', insertError)
      return { error: 'Failed to send message' }
    }

    // Get sender info
    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('user_id', userId)
      .single()

    // Map DB columns (sender_partnership, content) to ChatMessage fields (sender_user, body)
    const chatMessage: ChatMessage = {
      id: newMessage.id,
      handshake_id: newMessage.handshake_id,
      sender_user: userId, // Use the authenticated user ID
      sender_name: profile?.full_name || 'Unknown',
      sender_partnership_id: newMessage.sender_partnership,
      body: newMessage.content, // Map content -> body
      image_url: newMessage.image_url || undefined,
      created_at: newMessage.created_at,
      is_own_message: true
    }

    return { message: chatMessage }
  } catch (error) {
    console.error('[sendMessageAction] Error:', error)
    return { error: 'Failed to send message' }
  }
}

/**
 * Get the current user's partnership ID for a specific handshake.
 * Used for real-time message comparison (determining which messages are "own").
 */
export async function getMyPartnershipIdForHandshake(
  handshakeId: string
): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return null
    }

    const adminClient = await createAdminClient()

    // Get handshake
    const { data: handshake } = await adminClient
      .from('handshakes')
      .select('a_partnership, b_partnership')
      .eq('id', handshakeId)
      .single()

    if (!handshake) {
      return null
    }

    // Get user's partnerships
    const { data: memberships } = await adminClient
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)

    if (!memberships || memberships.length === 0) {
      return null
    }

    // Find which of user's partnerships is in this handshake
    const userPartnershipIds = memberships.map(m => m.partnership_id)
    const myPartnershipId = userPartnershipIds.find(
      pid => pid === handshake.a_partnership || pid === handshake.b_partnership
    )

    return myPartnershipId || null
  } catch (error) {
    console.error('[getMyPartnershipIdForHandshake] Error:', error)
    return null
  }
}
