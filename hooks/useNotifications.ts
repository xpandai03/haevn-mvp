'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Notification {
  id: string
  type: 'message' | 'handshake' | 'photo_grant'
  title: string
  body: string
  created_at: string
  read: boolean
  metadata?: Record<string, any>
}

export function useNotifications() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return

    let messageChannel: RealtimeChannel | null = null
    let handshakeChannel: RealtimeChannel | null = null

    async function setupSubscriptions() {
      // Get user's partnership
      const { data: membership } = await supabase
        .from('partnership_members')
        .select('partnership_id')
        .eq('user_id', user!.id)
        .single()

      if (!membership) return

      // Subscribe to new messages in user's handshakes
      const { data: handshakes } = await supabase
        .from('handshakes')
        .select('id')
        .or(`a_partnership.eq.${membership.partnership_id},b_partnership.eq.${membership.partnership_id}`)

      if (handshakes && handshakes.length > 0) {
        const handshakeIds = handshakes.map(h => h.id)

        // Subscribe to messages in all handshakes
        messageChannel = supabase
          .channel(`user-messages:${user!.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `handshake_id=in.(${handshakeIds.join(',')})`,
            },
            async (payload) => {
              // Skip if message is from current user
              if (payload.new.sender_user === user!.id) return

              // Get sender info
              const { data: sender } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('user_id', payload.new.sender_user)
                .single()

              // Get handshake info
              const { data: handshake } = await supabase
                .from('handshakes')
                .select(`
                  a_partnership:partnerships!handshakes_a_partnership_fkey(
                    id,
                    display_name
                  ),
                  b_partnership:partnerships!handshakes_b_partnership_fkey(
                    id,
                    display_name
                  )
                `)
                .eq('id', payload.new.handshake_id)
                .single()

              if (!handshake) return

              // Determine sender partnership name
              const { data: senderMembership } = await supabase
                .from('partnership_members')
                .select('partnership_id')
                .eq('user_id', payload.new.sender_user)
                .single()

              const senderPartnership = senderMembership?.partnership_id === handshake.a_partnership.id
                ? handshake.a_partnership
                : handshake.b_partnership

              // Create notification
              const notification: Notification = {
                id: payload.new.id,
                type: 'message',
                title: `New message from ${senderPartnership.display_name}`,
                body: payload.new.body,
                created_at: payload.new.created_at,
                read: false,
                metadata: {
                  handshake_id: payload.new.handshake_id,
                  sender_user: payload.new.sender_user
                }
              }

              // Add to notifications
              setNotifications(prev => [notification, ...prev])
              setUnreadCount(prev => prev + 1)

              // Show toast notification
              toast({
                title: notification.title,
                description: notification.body.length > 50
                  ? notification.body.substring(0, 50) + '...'
                  : notification.body,
              })
            }
          )
          .subscribe()
      }

      // Subscribe to new handshakes
      handshakeChannel = supabase
        .channel(`user-handshakes:${user!.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'handshakes',
            filter: `or(a_partnership.eq.${membership.partnership_id},b_partnership.eq.${membership.partnership_id})`,
          },
          async (payload) => {
            // Get partner info
            const { data: handshake } = await supabase
              .from('handshakes')
              .select(`
                a_partnership:partnerships!handshakes_a_partnership_fkey(
                  id,
                  display_name
                ),
                b_partnership:partnerships!handshakes_b_partnership_fkey(
                  id,
                  display_name
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (!handshake) return

            const partnerPartnership = handshake.a_partnership.id === membership.partnership_id
              ? handshake.b_partnership
              : handshake.a_partnership

            // Create notification
            const notification: Notification = {
              id: payload.new.id,
              type: 'handshake',
              title: 'New match!',
              body: `You matched with ${partnerPartnership.display_name}`,
              created_at: payload.new.created_at,
              read: false,
              metadata: {
                handshake_id: payload.new.id
              }
            }

            // Add to notifications
            setNotifications(prev => [notification, ...prev])
            setUnreadCount(prev => prev + 1)

            // Show toast notification
            toast({
              title: notification.title,
              description: notification.body,
            })
          }
        )
        .subscribe()
    }

    setupSubscriptions()

    // Cleanup
    return () => {
      if (messageChannel) {
        supabase.removeChannel(messageChannel)
      }
      if (handshakeChannel) {
        supabase.removeChannel(handshakeChannel)
      }
    }
  }, [user, supabase, toast])

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    )
    setUnreadCount(0)
  }

  const clearNotifications = () => {
    setNotifications([])
    setUnreadCount(0)
  }

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications
  }
}