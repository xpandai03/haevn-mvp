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
import { getUnreadMessageCounts as getUnreadCountsService, type UnreadCounts } from '@/lib/services/chat'
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

/**
 * Get unread message counts for the current user.
 * Returns total count and per-handshake breakdown.
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

  return getUnreadCountsService(user.id)
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
  created_at: string
  is_own_message?: boolean
}

/**
 * Send a message in a connection chat using admin client.
 * Bypasses RLS to ensure message inserts work regardless of partnership_members setup.
 */
export async function sendMessageAction(
  handshakeId: string,
  body: string
): Promise<{ message?: ChatMessage; error?: string }> {
  try {
    // Get current user from server-side auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: 'Not authenticated' }
    }

    const userId = user.id

    // Validate message
    if (!body.trim()) {
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
        content: body.trim()
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
      created_at: newMessage.created_at,
      is_own_message: true
    }

    return { message: chatMessage }
  } catch (error) {
    console.error('[sendMessageAction] Error:', error)
    return { error: 'Failed to send message' }
  }
}
