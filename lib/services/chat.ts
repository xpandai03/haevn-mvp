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
    // First get user's partnership
    const { data: membership } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)
      .single()

    if (!membership) {
      return []
    }

    const userPartnershipId = membership.partnership_id

    // Get all MATCHED handshakes involving this partnership (chat only unlocks after match)
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
          body,
          created_at,
          sender_user
        ),
        photo_grants(
          granted
        )
      `)
      .or(`a_partnership.eq.${userPartnershipId},b_partnership.eq.${userPartnershipId}`)
      .eq('state', 'matched')
      .order('matched_at', { ascending: false })

    if (error) {
      console.error('Error fetching handshakes:', error)
      throw error
    }

    // Process handshakes to add last message and calculate unread count
    const processedHandshakes = await Promise.all(handshakes?.map(async handshake => {
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
        .single()

      // Count unread messages
      let unreadCount = 0
      if (messages && messages.length > 0) {
        const lastReadAt = readStatus?.last_read_at ? new Date(readStatus.last_read_at) : new Date(0)
        unreadCount = messages.filter(msg =>
          msg.sender_user !== userId &&
          new Date(msg.created_at) > lastReadAt
        ).length
      }

      return {
        ...handshake,
        last_message: lastMessage,
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
    const { data: membership } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)
      .single()

    if (!membership) {
      throw new Error('User has no partnership')
    }

    // Get messages with sender info
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        id,
        handshake_id,
        sender_user,
        body,
        created_at,
        profiles!messages_sender_user_fkey(
          full_name
        )
      `)
      .eq('handshake_id', handshakeId)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Get partnership info for each sender
    const processedMessages = await Promise.all((messages || []).map(async (msg) => {
      const { data: senderMembership } = await supabase
        .from('partnership_members')
        .select('partnership_id')
        .eq('user_id', msg.sender_user)
        .single()

      return {
        id: msg.id,
        handshake_id: msg.handshake_id,
        sender_user: msg.sender_user,
        sender_name: msg.profiles?.full_name || 'Unknown',
        sender_partnership_id: senderMembership?.partnership_id,
        body: msg.body,
        created_at: msg.created_at,
        is_own_message: msg.sender_user === userId
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

  try {
    // Validate message
    if (!body.trim()) {
      return { error: 'Message cannot be empty' }
    }

    if (body.length > 2000) {
      return { error: 'Message too long (max 2000 characters)' }
    }

    // Send message
    const { data: newMessage, error } = await supabase
      .from('messages')
      .insert({
        handshake_id: handshakeId,
        sender_user: userId,
        body: body.trim()
      })
      .select()
      .single()

    if (error) throw error

    // Get sender info
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', userId)
      .single()

    const { data: membership } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)
      .single()

    const chatMessage: ChatMessage = {
      id: newMessage.id,
      handshake_id: newMessage.handshake_id,
      sender_user: newMessage.sender_user,
      sender_name: profile?.full_name || 'Unknown',
      sender_partnership_id: membership?.partnership_id,
      body: newMessage.body,
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

    const { data: membership } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)
      .single()

    if (!membership) {
      return { success: false, error: 'User has no partnership' }
    }

    const userPartnershipId = membership.partnership_id
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

        // Get sender info
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', payload.new.sender_user)
          .single()

        const { data: membership } = await supabase
          .from('partnership_members')
          .select('partnership_id')
          .eq('user_id', payload.new.sender_user)
          .single()

        const message: ChatMessage = {
          id: payload.new.id,
          handshake_id: payload.new.handshake_id,
          sender_user: payload.new.sender_user,
          sender_name: profile?.full_name || 'Unknown',
          sender_partnership_id: membership?.partnership_id,
          body: payload.new.body,
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