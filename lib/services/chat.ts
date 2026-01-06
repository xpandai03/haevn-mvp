import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types/supabase'

type Message = Database['public']['Tables']['messages']['Row']
type Handshake = Database['public']['Tables']['handshakes']['Row']

export interface HandshakeWithPartnerships {
  id: string
  triggered_at: string
  matched_at?: string
  a_partnership: {
    id: string
    display_name: string
    city: string
    badges?: string[]
  }
  b_partnership: {
    id: string
    display_name: string
    city: string
    badges?: string[]
  }
  last_message?: {
    body: string
    created_at: string
    sender_user: string
  }
  photo_grant?: {
    granted: boolean
  }
  unread_count: number
  last_read_at?: string
}

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

export async function getUserHandshakes(userId: string): Promise<HandshakeWithPartnerships[]> {
  const supabase = createClient()

  try {
    // Get ALL user's partnerships (user may have multiple)
    const { data: memberships, error: memberError } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)

    if (memberError || !memberships || memberships.length === 0) {
      console.log('[getUserHandshakes] No partnerships found for user')
      return []
    }

    const userPartnershipIds = memberships.map(m => m.partnership_id)

    // Build OR condition for all user's partnerships
    const orConditions = userPartnershipIds
      .map(pid => `a_partnership.eq.${pid},b_partnership.eq.${pid}`)
      .join(',')

    // Get all MATCHED handshakes involving any of user's partnerships
    // NOTE: messages schema uses sender_partnership + content (not sender_user + body)
    const { data: handshakes, error } = await supabase
      .from('handshakes')
      .select(`
        id,
        triggered_at,
        matched_at,
        a_partnership:partnerships!handshakes_a_partnership_fkey(
          id,
          display_name,
          city,
          badges
        ),
        b_partnership:partnerships!handshakes_b_partnership_fkey(
          id,
          display_name,
          city,
          badges
        ),
        messages(
          content,
          created_at,
          sender_partnership
        ),
        photo_grants(
          granted
        )
      `)
      .or(orConditions)
      .eq('state', 'matched')
      .order('matched_at', { ascending: false })

    if (error) {
      console.error('Error fetching handshakes:', error)
      throw error
    }

    // Process handshakes to add last message and calculate unread count
    const processedHandshakes = await Promise.all(handshakes?.map(async handshake => {
      // Find which of user's partnerships is in THIS handshake
      const aPartnership = handshake.a_partnership as any
      const bPartnership = handshake.b_partnership as any
      const userPartnershipInHandshake = userPartnershipIds.find(
        pid => pid === aPartnership?.id || pid === bPartnership?.id
      )

      const messages = handshake.messages as any[]
      const lastMessage = messages && messages.length > 0
        ? messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : undefined

      // Get last read timestamp for this handshake
      const { data: readStatus } = await supabase
        .from('message_reads')
        .select('last_read_at')
        .eq('handshake_id', handshake.id)
        .eq('user_id', userId)
        .maybeSingle()

      // Count unread messages (from OTHER partnership, not user's)
      let unreadCount = 0
      if (messages && messages.length > 0 && userPartnershipInHandshake) {
        const lastReadAt = readStatus?.last_read_at ? new Date(readStatus.last_read_at) : new Date(0)
        unreadCount = messages.filter(msg =>
          msg.sender_partnership !== userPartnershipInHandshake &&
          new Date(msg.created_at) > lastReadAt
        ).length
      }

      // Map last_message fields for UI compatibility
      const mappedLastMessage = lastMessage ? {
        body: lastMessage.content,
        created_at: lastMessage.created_at,
        sender_user: lastMessage.sender_partnership // Use partnership ID as sender identifier
      } : undefined

      return {
        ...handshake,
        last_message: mappedLastMessage,
        photo_grant: handshake.photo_grants?.[0],
        unread_count: unreadCount,
        last_read_at: readStatus?.last_read_at
      } as HandshakeWithPartnerships
    }) || [])

    return processedHandshakes
  } catch (error) {
    console.error('Error fetching handshakes:', error)
    return []
  }
}

export async function getHandshakeMessages(
  handshakeId: string,
  userId: string
): Promise<ChatMessage[]> {
  const supabase = createClient()

  try {
    // Verify user has access to this handshake
    // CRITICAL: Use array select to distinguish "no rows" from "fetch error"
    const { data: memberships, error: memberError } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)

    // CRITICAL FIX: If fetch failed, return empty (don't throw misleading error)
    if (memberError) {
      console.error('[Chat] Partnership fetch failed:', memberError)
      return []
    }

    if (!memberships || memberships.length === 0) {
      console.error('[Chat] User has no partnership (0 rows)')
      return []
    }

    // Get messages - NOTE: schema uses sender_partnership + content (not sender_user + body)
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        id,
        handshake_id,
        sender_partnership,
        content,
        created_at
      `)
      .eq('handshake_id', handshakeId)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Get user's partnership to determine which messages are own
    const userPartnershipId = memberships[0].partnership_id

    // Get partnership display names for sender info
    const processedMessages = await Promise.all((messages || []).map(async (msg) => {
      // Get partnership display name
      const { data: partnership } = await supabase
        .from('partnerships')
        .select('display_name')
        .eq('id', msg.sender_partnership)
        .single()

      return {
        id: msg.id,
        handshake_id: msg.handshake_id,
        sender_user: '', // Not stored in new schema
        sender_name: partnership?.display_name || 'Unknown',
        sender_partnership_id: msg.sender_partnership,
        body: msg.content, // Map content -> body
        created_at: msg.created_at,
        is_own_message: msg.sender_partnership === userPartnershipId
      } as ChatMessage
    }))

    return processedMessages
  } catch (error) {
    console.error('Error fetching messages:', error)
    return []
  }
}

export async function sendMessage(
  handshakeId: string,
  userId: string,
  body: string
): Promise<{ message?: ChatMessage; error?: string }> {
  const supabase = createClient()

  console.log('[sendMessage] Starting:', { handshakeId, userId, bodyLength: body.length })

  try {
    // Validate message
    if (!body.trim()) {
      console.log('[sendMessage] Validation failed: empty message')
      return { error: 'Message cannot be empty' }
    }

    if (body.length > 2000) {
      console.log('[sendMessage] Validation failed: too long')
      return { error: 'Message too long (max 2000 characters)' }
    }

    // Get user's partnership ID first (schema uses sender_partnership)
    const { data: membership } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)
      .single()

    if (!membership) {
      return { error: 'User has no partnership' }
    }

    // Send message - NOTE: schema uses sender_partnership + content (not sender_user + body)
    console.log('[sendMessage] Inserting into messages table...')
    const { data: newMessage, error } = await supabase
      .from('messages')
      .insert({
        handshake_id: handshakeId,
        sender_partnership: membership.partnership_id,
        content: body.trim()
      })
      .select()
      .single()

    console.log('[sendMessage] Insert result:', { newMessage, error })

    if (error) throw error

    // Get sender info
    const { data: partnership } = await supabase
      .from('partnerships')
      .select('display_name')
      .eq('id', membership.partnership_id)
      .single()

    const chatMessage: ChatMessage = {
      id: newMessage.id,
      handshake_id: newMessage.handshake_id,
      sender_user: userId,
      sender_name: partnership?.display_name || 'Unknown',
      sender_partnership_id: newMessage.sender_partnership,
      body: newMessage.content, // Map content -> body
      created_at: newMessage.created_at,
      is_own_message: true
    }

    return { message: chatMessage }
  } catch (error) {
    console.error('Error sending message:', error)
    return { error: 'Failed to send message' }
  }
}

export async function togglePhotoGrant(
  handshakeId: string,
  userId: string,
  granted: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  try {
    // Verify user owns one of the partnerships in this handshake
    const { data: handshake } = await supabase
      .from('handshakes')
      .select('a_partnership, b_partnership')
      .eq('id', handshakeId)
      .single()

    if (!handshake) {
      return { success: false, error: 'Handshake not found' }
    }

    // CRITICAL: Use array select to distinguish "no rows" from "fetch error"
    const { data: memberships, error: memberError } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)

    // CRITICAL FIX: If fetch failed, return error (don't assume no partnership)
    if (memberError) {
      console.error('[Chat] Partnership fetch failed:', memberError)
      return { success: false, error: 'Failed to verify partnership' }
    }

    if (!memberships || memberships.length === 0) {
      return { success: false, error: 'User has no partnership' }
    }

    const userPartnershipId = memberships[0].partnership_id
    const isPartOfHandshake =
      handshake.a_partnership === userPartnershipId ||
      handshake.b_partnership === userPartnershipId

    if (!isPartOfHandshake) {
      return { success: false, error: 'Unauthorized' }
    }

    // Upsert photo grant
    const { error } = await supabase
      .from('photo_grants')
      .upsert({
        handshake_id: handshakeId,
        granted
      }, {
        onConflict: 'handshake_id'
      })

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error toggling photo grant:', error)
    return { success: false, error: 'Failed to update photo grant' }
  }
}

// Mark messages as read
export async function markMessagesAsRead(
  handshakeId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  try {
    // Upsert the read status with current timestamp
    const { error } = await supabase
      .from('message_reads')
      .upsert({
        handshake_id: handshakeId,
        user_id: userId,
        last_read_at: new Date().toISOString()
      }, {
        onConflict: 'handshake_id,user_id'
      })

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error marking messages as read:', error)
    return { success: false, error: 'Failed to mark messages as read' }
  }
}

// =============================================================================
// UNREAD COUNT HELPERS
// =============================================================================

export interface UnreadCounts {
  total: number
  byHandshake: Record<string, number>
}

/**
 * Get unread message counts for a user across all their matched handshakes.
 * Uses existing message_reads table with last_read_at timestamp.
 */
export async function getUnreadMessageCounts(userId: string): Promise<UnreadCounts> {
  const supabase = createClient()

  try {
    // Get user's partnership(s)
    const { data: memberships, error: memberError } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)

    if (memberError || !memberships || memberships.length === 0) {
      return { total: 0, byHandshake: {} }
    }

    const userPartnershipIds = memberships.map(m => m.partnership_id)

    // Get all matched handshakes involving user's partnerships
    // Build OR condition for all user's partnerships
    const orConditions = userPartnershipIds
      .map(pid => `a_partnership.eq.${pid},b_partnership.eq.${pid}`)
      .join(',')

    const { data: handshakes, error: handshakeError } = await supabase
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
      console.error('[getUnreadMessageCounts] Handshake fetch error:', handshakeError)
      return { total: 0, byHandshake: {} }
    }

    // Get all read statuses for this user
    const handshakeIds = handshakes.map(h => h.id)
    const { data: readStatuses } = await supabase
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
      const messages = handshake.messages as any[] || []
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
    console.error('[getUnreadMessageCounts] Error:', error)
    return { total: 0, byHandshake: {} }
  }
}

// Subscribe to new messages for a handshake
export function subscribeToMessages(
  handshakeId: string,
  onMessage: (message: ChatMessage) => void
) {
  const supabase = createClient()

  const channel = supabase
    .channel(`messages:${handshakeId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `handshake_id=eq.${handshakeId}`
      },
      async (payload) => {
        console.log('New message received:', payload)

        // Get sender partnership info (schema uses sender_partnership, not sender_user)
        const { data: partnership } = await supabase
          .from('partnerships')
          .select('display_name')
          .eq('id', payload.new.sender_partnership)
          .single()

        const message: ChatMessage = {
          id: payload.new.id,
          handshake_id: payload.new.handshake_id,
          sender_user: '', // Not stored in new schema
          sender_name: partnership?.display_name || 'Unknown',
          sender_partnership_id: payload.new.sender_partnership,
          body: payload.new.content, // Map content -> body
          created_at: payload.new.created_at,
          is_own_message: false // Will be determined by the component
        }

        onMessage(message)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}