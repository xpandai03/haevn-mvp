'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, Send, ImagePlus, MapPin, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth/context'
import { getConnectionById, sendMessageAction, getMessagesForHandshake, getMyPartnershipIdForHandshake, type ConnectionResult, type ChatMessage } from '@/lib/actions/connections'
import { subscribeToMessages, markMessagesAsRead } from '@/lib/services/chat'
import { getUserMembershipTier } from '@/lib/actions/dashboard'
import { useToast } from '@/hooks/use-toast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { format, isToday, isYesterday } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { MeetupChatCard } from '@/components/chat/MeetupChatCard'
import {
  encodeMeetupSuggestionMessage,
  parseMeetupSuggestionMessage,
} from '@/lib/chat/meetupMessage'

/** Hardcoded midpoint-style suggestion until real geo + venue data ships. */
const PLACEHOLDER_CHAT_MEETUP_BASE = {
  venue_name: 'Blue Bottle Coffee',
  venue_type: 'Coffee',
  note: 'Based on your shared preference for coffee dates',
  emoji: '☕',
}

/**
 * Build a meetup suggestion with per-user halfway distances. Distances are
 * placeholder estimates (split around a ~2.3mi midpoint) until real geo ships.
 */
function buildMeetupSuggestion(matchDisplayName: string) {
  const name = (matchDisplayName || 'them').split(' ')[0] || 'them'
  return {
    ...PLACEHOLDER_CHAT_MEETUP_BASE,
    distance: `You: ~1.0 mi · ${name}: ~1.3 mi`,
    subtitle: 'Roughly halfway between the two of you',
  }
}

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
  const [uploading, setUploading] = useState(false)
  const [showMeetupSuggestion, setShowMeetupSuggestion] = useState(false)
  const [icebreakers, setIcebreakers] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [myPartnershipId, setMyPartnershipId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

        // Empty thread → fetch AI conversation starters (best effort)
        if (msgs.length === 0) {
          fetch('/api/ai/icebreakers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ handshakeId: connectionData.handshakeId }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (Array.isArray(d?.lines)) setIcebreakers(d.lines.slice(0, 3))
            })
            .catch(() => {})
        }

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

  const handleShareMeetupSuggestion = async () => {
    if (!connection || sending) return
    setSending(true)
    const payload = buildMeetupSuggestion(connection.partnership.display_name || '')
    const body = encodeMeetupSuggestionMessage(payload)
    const result = await sendMessageAction(connection.handshakeId, body)
    if (result.error) {
      toast({
        title: 'Could not share',
        description: result.error,
        variant: 'destructive',
      })
    } else if (result.message) {
      setMessages((prev) => [...prev, result.message!])
      setShowMeetupSuggestion(false)
    }
    setSending(false)
  }

  // Handle image upload and send
  const handleImageSelect = async (file: File) => {
    if (!user || !connection) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file',
        variant: 'destructive'
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Image must be less than 5MB',
        variant: 'destructive'
      })
      return
    }

    setUploading(true)

    try {
      const supabase = createClient()

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${connection.handshakeId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      // Upload to chat-media bucket
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(fileName, file)

      if (uploadError) {
        console.error('[Chat] Upload failed:', uploadError)
        toast({
          title: 'Upload failed',
          description: 'Could not upload image. Please try again.',
          variant: 'destructive'
        })
        return
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(fileName)

      // Send as image message
      const result = await sendMessageAction(connection.handshakeId, '', publicUrl)

      if (result.error) {
        console.error('[Chat] Send image failed:', result.error)
        toast({
          title: 'Failed to send',
          description: result.error,
          variant: 'destructive'
        })
      } else if (result.message) {
        setMessages(prev => [...prev, result.message!])
      }
    } catch (err) {
      console.error('[Chat] Image upload error:', err)
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Navigate to profile from chat header
  const handleViewProfile = () => {
    if (!connection) return
    // Navigate to unified profile view with handshakeId for messaging
    router.push(`/profiles/${connection.partnership.id}?handshakeId=${connection.handshakeId}`)
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
      <div className="flex min-h-[60vh] flex-1 items-center justify-center bg-[color:var(--haevn-dash-surface-alt)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[color:var(--haevn-teal)]" />
          <p className="text-sm text-[color:var(--haevn-muted-fg)]">Loading chat…</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !connection) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center bg-[color:var(--haevn-dash-surface-alt)] p-4">
        <div className="dash-card w-full max-w-md p-8 text-center">
          <h2 className="font-heading text-xl text-[color:var(--haevn-navy)]">
            {error || 'Connection not found'}
          </h2>
          <p className="mt-2 text-sm text-[color:var(--haevn-muted-fg)]">
            This conversation may no longer be available.
          </p>
          <Button
            type="button"
            onClick={() => router.push('/messages')}
            className="haevn-btn-teal mt-6 w-full"
          >
            Back to messages
          </Button>
        </div>
      </div>
    )
  }

  const { partnership } = connection
  const meetupPreview = buildMeetupSuggestion(partnership.display_name || '')
  const matchFirstName =
    (partnership.display_name || 'your match').split(' ')[0] || 'your match'

  // Get initials for avatar fallback
  const initials = partnership.display_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??'

  return (
    <div className="flex h-[calc(100dvh-132px)] min-h-0 flex-col bg-[color:var(--haevn-dash-surface-alt)] md:h-[calc(100dvh-36px)]">
      <header className="flex h-14 shrink-0 items-center border-b border-[color:var(--haevn-border)] bg-white px-4">
        <button
          type="button"
          onClick={() => router.push('/messages')}
          className="flex items-center gap-1 text-sm font-medium text-[color:var(--haevn-navy)] transition-colors hover:text-[color:var(--haevn-teal)]"
          aria-label="Back to messages"
        >
          <ArrowLeft className="h-5 w-5 shrink-0" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={handleViewProfile}
          className="flex min-w-0 flex-1 items-center justify-center gap-3 px-2 transition-opacity hover:opacity-80"
        >
          <Avatar className="h-9 w-9 shrink-0 border border-[color:var(--haevn-border)] keep-rounded">
            {partnership.photo_url ? (
              <AvatarImage src={partnership.photo_url} alt={partnership.display_name || 'Connection'} />
            ) : (
              <AvatarFallback className="bg-[color:var(--haevn-dash-surface-alt)] font-heading text-xs font-semibold text-[color:var(--haevn-navy)] keep-rounded">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
          <span className="truncate font-heading text-sm font-semibold text-[color:var(--haevn-navy)]">
            {partnership.display_name || 'Anonymous'}
          </span>
        </button>
        <div className="w-9 shrink-0" aria-hidden />
      </header>

      {/* Messages Area */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-2 py-12 text-center">
            <Avatar className="mb-4 h-14 w-14 border border-[color:var(--haevn-border)] keep-rounded">
              {partnership.photo_url ? (
                <AvatarImage src={partnership.photo_url} alt={matchFirstName} />
              ) : (
                <AvatarFallback className="bg-[color:var(--haevn-dash-surface-alt)] font-heading text-lg font-semibold text-[color:var(--haevn-navy)] keep-rounded">
                  {initials}
                </AvatarFallback>
              )}
            </Avatar>
            <p className="font-heading text-lg font-semibold text-[color:var(--haevn-navy)]">
              You matched with {matchFirstName}
            </p>
            <p className="mt-1 max-w-xs text-sm text-[color:var(--haevn-muted-fg)]">
              Start the conversation — say something intentional.
            </p>

            {icebreakers.length > 0 && (
              <div className="mt-8 w-full max-w-sm text-left">
                <p className="mb-3 flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--haevn-muted-fg)]">
                  <Sparkles className="h-3 w-3 text-[color:var(--haevn-gold)]" />
                  Suggested opening lines
                </p>
                <div className="flex flex-col gap-2">
                  {icebreakers.map((line, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setNewMessage(line)}
                      className="rounded-[var(--radius)] border border-[color:var(--haevn-border)] bg-white px-4 py-3 text-left text-[13px] leading-relaxed text-[color:var(--haevn-charcoal)] transition-colors hover:border-[color:var(--haevn-teal)]/40 hover:bg-[#FFFCF5]"
                    >
                      {line}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-center text-[11px] italic text-[color:var(--haevn-muted-fg)]">
                  Based on your alignment with {matchFirstName}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isOwn = message.is_own_message
              const meetup = message.body
                ? parseMeetupSuggestionMessage(message.body)
                : null
              const hasImage = !!message.image_url
              const hasPlainText = !!message.body && !meetup

              if (meetup) {
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] border px-4 py-3 rounded-[var(--radius)] ${
                        isOwn
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-[color:var(--haevn-border)] bg-white text-[color:var(--haevn-charcoal)]'
                      }`}
                    >
                      <MeetupChatCard data={meetup} />
                      <p
                        className={`mt-2 text-xs ${
                          isOwn ? 'text-amber-900/60' : 'text-[color:var(--haevn-charcoal)]/45'
                        }`}
                      >
                        {formatMessageTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[78%] rounded-[var(--radius)] border ${
                      hasImage && !hasPlainText ? 'p-1' : 'px-4 py-2.5'
                    } ${
                      isOwn
                        ? 'border-transparent bg-haevn-navy text-white'
                        : 'border-[color:var(--haevn-border)] bg-white text-[color:var(--haevn-charcoal)]'
                    }`}
                  >
                    {hasImage && (
                      <div className={hasPlainText ? 'mb-2' : ''}>
                        <Image
                          src={message.image_url!}
                          alt="Shared image"
                          width={300}
                          height={200}
                          className="max-h-[300px] w-full max-w-full object-cover rounded-[var(--radius)]"
                        />
                      </div>
                    )}
                    {hasPlainText && (
                      <p className="text-sm leading-relaxed break-words">{message.body}</p>
                    )}
                    <p
                      className={`mt-1 text-xs ${hasImage && !hasPlainText ? 'px-3 pb-2' : ''} ${
                        isOwn ? 'text-white/75' : 'text-[color:var(--haevn-charcoal)]/45'
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
      <div className="shrink-0 border-t border-[color:var(--haevn-border)] bg-white px-4 pb-6 pt-3">
        {showMeetupSuggestion && (
          <div className="mb-3 rounded-[var(--radius)] border border-[color:var(--haevn-border)] bg-[#F9F5EB] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgba(0,128,128,0.1)]">
                <MapPin className="h-5 w-5 text-[color:var(--haevn-teal)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-sm font-semibold text-[color:var(--haevn-navy)]">
                  {meetupPreview.emoji} {meetupPreview.venue_name}
                </p>
                <p className="mt-0.5 text-xs text-[color:var(--haevn-charcoal)]/70">
                  {meetupPreview.venue_type} · {meetupPreview.distance}
                </p>
                <p className="mt-0.5 text-[11px] italic text-[color:var(--haevn-charcoal)]/45">
                  {meetupPreview.subtitle}
                </p>
                <p className="mt-1 text-xs text-[color:var(--haevn-charcoal)]/50">
                  {meetupPreview.note}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                className="flex-1 bg-[color:var(--haevn-teal)] text-white hover:bg-[color:var(--haevn-teal-hover)]"
                disabled={sending || uploading}
                onClick={() => void handleShareMeetupSuggestion()}
              >
                Share in Chat
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="shrink-0 text-[color:var(--haevn-charcoal)]/70"
                onClick={() => setShowMeetupSuggestion(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2"
        >
          {/* Image picker button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending}
            className="h-10 w-10 text-haevn-charcoal hover:text-haevn-teal"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowMeetupSuggestion((v) => !v)}
            disabled={uploading || sending}
            className="h-10 w-10 text-haevn-charcoal/50 hover:text-haevn-teal"
            aria-label="Suggest meetup location"
            title="Suggest meetup location"
          >
            <MapPin className="h-5 w-5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageSelect(file)
            }}
          />

          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={sending || uploading}
            maxLength={2000}
            className="flex-1 rounded-[var(--radius)] border-[color:var(--haevn-border)] bg-white focus-visible:border-[color:var(--haevn-teal)] focus-visible:ring-[color:var(--haevn-teal)]"
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || sending || uploading}
            className="h-10 w-10 shrink-0 rounded-[var(--radius)] bg-[color:var(--haevn-teal)] p-0 text-white hover:bg-[color:var(--haevn-teal)]/90"
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
