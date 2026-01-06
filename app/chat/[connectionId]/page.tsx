'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth/context'
import { getConnectionById, sendMessageAction, getMessagesForHandshake, getMyPartnershipIdForHandshake, type ConnectionResult, type ChatMessage } from '@/lib/actions/connections'
import { subscribeToMessages, markMessagesAsRead } from '@/lib/services/chat'
import { getUserMembershipTier } from '@/lib/actions/dashboard'
import { useToast } from '@/hooks/use-toast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { format, isToday, isYesterday } from 'date-fns'

export default function ChatWithConnectionPage() {
  const router = useRouter()
  const params = useParams()
  const connectionId = params.connectionId as string
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [connection, setConnection] = useState<ConnectionResult | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myPartnershipId, setMyPartnershipId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load connection details and messages
  useEffect(() => {
    async function loadConnection() {
      if (authLoading || !user || !connectionId) return

      try {
        setLoading(true)

        // Check membership tier first
        const membershipTier = await getUserMembershipTier()
        if (membershipTier !== 'plus') {
          toast({
            title: 'Upgrade Required',
            description: 'Upgrade to HAEVN+ to access chat',
            variant: 'destructive'
          })
          router.push('/onboarding/membership')
          return
        }

        const connectionData = await getConnectionById(connectionId)

        if (!connectionData) {
          setError('Connection not found')
          return
        }

        setConnection(connectionData)

        // Get current user's partnership ID for this handshake (for real-time comparison)
        const partnershipId = await getMyPartnershipIdForHandshake(connectionData.handshakeId)
        setMyPartnershipId(partnershipId)

        // Load messages using server action (admin client to bypass RLS)
        const msgs = await getMessagesForHandshake(connectionData.handshakeId)
        setMessages(msgs)

        // Mark messages as read
        await markMessagesAsRead(connectionData.handshakeId, user.id)

      } catch (err: any) {
        console.error('[ChatWithConnection] Error:', err)
        setError(err.message || 'Failed to load connection')
      } finally {
        setLoading(false)
      }
    }

    loadConnection()
  }, [user, authLoading, connectionId, router, toast])

  // Subscribe to new messages
  useEffect(() => {
    if (!user || !connection || !myPartnershipId) return

    const unsubscribe = subscribeToMessages(connection.handshakeId, (newMsg) => {
      // Use partnership ID comparison (not user.id) since schema uses sender_partnership
      newMsg.is_own_message = newMsg.sender_partnership_id === myPartnershipId
      setMessages(prev => [...prev, newMsg])

      // Mark as read
      markMessagesAsRead(connection.handshakeId, user.id)
    })

    return () => unsubscribe()
  }, [connection, user, myPartnershipId])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!newMessage.trim() || sending || !user || !connection) {
      return
    }

    setSending(true)
    const messageText = newMessage.trim()
    setNewMessage('')

    // Use server action (admin client) to bypass RLS
    const result = await sendMessageAction(connection.handshakeId, messageText)

    if (result.error) {
      console.error('[Chat] Send failed:', result.error)
      setNewMessage(messageText) // Restore on error
    } else if (result.message) {
      setMessages(prev => [...prev, result.message!])
    }

    setSending(false)
  }

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr)
    if (isToday(date)) return format(date, 'h:mm a')
    if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`
    return format(date, 'MMM d, h:mm a')
  }

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
          <p className="text-haevn-charcoal">Loading chat...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !connection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-sm text-center">
          <h2 className="text-2xl font-bold text-haevn-navy mb-4">
            {error || 'Connection Not Found'}
          </h2>
          <p className="text-haevn-charcoal mb-6">
            This connection may no longer be available.
          </p>
          <Button onClick={() => router.push('/connections')} className="bg-haevn-teal">
            Back to Connections
          </Button>
        </div>
      </div>
    )
  }

  const { partnership } = connection

  // Get initials for avatar fallback
  const initials = partnership.display_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??'

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-haevn-teal h-14 flex items-center justify-between px-4 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="text-white text-sm font-medium flex items-center gap-1 hover:opacity-80"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 border-2 border-white/50">
            {partnership.photo_url ? (
              <AvatarImage src={partnership.photo_url} alt={partnership.display_name || 'Connection'} />
            ) : (
              <AvatarFallback className="bg-haevn-navy text-white text-xs font-bold">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
          <span
            className="text-white font-medium"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
          >
            {partnership.display_name || 'Anonymous'}
          </span>
        </div>
        <div className="w-5" /> {/* Spacer for centering */}
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-haevn-teal/10 rounded-full p-4 mb-4">
              <Send className="h-8 w-8 text-haevn-teal" />
            </div>
            <p className="text-haevn-charcoal font-medium mb-1">No messages yet</p>
            <p className="text-haevn-charcoal/60 text-sm">
              Say hello to {partnership.display_name || 'your match'}!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isOwn = message.is_own_message

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      isOwn
                        ? 'bg-haevn-teal text-white rounded-br-md'
                        : 'bg-white border border-gray-200 text-haevn-charcoal rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm break-words">{message.body}</p>
                    <p
                      className={`text-xs mt-1 ${
                        isOwn ? 'text-white/70' : 'text-gray-400'
                      }`}
                    >
                      {formatMessageTime(message.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="px-4 pb-6 pt-3 bg-white border-t border-gray-200 flex-shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
            maxLength={2000}
            className="flex-1 rounded-full border-gray-300 focus:border-haevn-teal focus:ring-haevn-teal"
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="rounded-full bg-haevn-teal hover:bg-haevn-teal/90 h-10 w-10 p-0"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
