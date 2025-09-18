'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Send, ArrowLeft, Image as ImageIcon, Lock, Unlock, Loader2 } from 'lucide-react'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import type { ChatMessage, HandshakeWithPartnerships } from '@/lib/services/chat'
import { sendMessage, getHandshakeMessages, subscribeToMessages, togglePhotoGrant, markMessagesAsRead } from '@/lib/services/chat'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth/context'

interface ChatConversationProps {
  handshake: HandshakeWithPartnerships
  currentPartnershipId: string
  onBack: () => void
}

export function ChatConversation({
  handshake,
  currentPartnershipId,
  onBack
}: ChatConversationProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [photoGranted, setPhotoGranted] = useState(handshake.photo_grant?.granted || false)
  const [updatingGrant, setUpdatingGrant] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Determine which partnership is the other one
  const otherPartnership = handshake.a_partnership.id === currentPartnershipId
    ? handshake.b_partnership
    : handshake.a_partnership

  const currentPartnership = handshake.a_partnership.id === currentPartnershipId
    ? handshake.a_partnership
    : handshake.b_partnership

  // Load messages and mark as read
  useEffect(() => {
    async function loadMessages() {
      if (!user) return

      setLoading(true)
      const msgs = await getHandshakeMessages(handshake.id, user.id)
      setMessages(msgs)
      setLoading(false)

      // Mark messages as read
      await markMessagesAsRead(handshake.id, user.id)

      // Scroll to bottom after messages load
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }

    loadMessages()
  }, [handshake.id, user])

  // Subscribe to new messages
  useEffect(() => {
    if (!user) return

    const unsubscribe = subscribeToMessages(handshake.id, (newMsg) => {
      // Update is_own_message flag
      newMsg.is_own_message = newMsg.sender_user === user.id

      setMessages(prev => [...prev, newMsg])

      // Scroll to bottom for new messages
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    })

    return () => {
      unsubscribe()
    }
  }, [handshake.id, user])

  const handleSend = async () => {
    if (!newMessage.trim() || sending || !user) return

    setSending(true)
    const messageText = newMessage.trim()
    setNewMessage('')

    const { message, error } = await sendMessage(handshake.id, user.id, messageText)

    if (error) {
      toast({
        title: 'Failed to send message',
        description: error,
        variant: 'destructive'
      })
      setNewMessage(messageText) // Restore message on error
    } else if (message) {
      setMessages(prev => [...prev, message])
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }

    setSending(false)
  }

  const handlePhotoGrantToggle = async (granted: boolean) => {
    if (!user || updatingGrant) return

    setUpdatingGrant(true)
    const { success, error } = await togglePhotoGrant(handshake.id, user.id, granted)

    if (success) {
      setPhotoGranted(granted)
      toast({
        title: granted ? 'Photos shared' : 'Photos hidden',
        description: granted
          ? `${otherPartnership.display_name} can now see your private photos`
          : `${otherPartnership.display_name} can no longer see your private photos`
      })
    } else {
      toast({
        title: 'Failed to update photo access',
        description: error,
        variant: 'destructive'
      })
    }

    setUpdatingGrant(false)
  }

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr)

    if (isToday(date)) {
      return format(date, 'h:mm a')
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'h:mm a')}`
    } else {
      return format(date, 'MMM d, h:mm a')
    }
  }

  const formatDateDivider = (dateStr: string) => {
    const date = new Date(dateStr)

    if (isToday(date)) {
      return 'Today'
    } else if (isYesterday(date)) {
      return 'Yesterday'
    } else {
      return format(date, 'MMMM d, yyyy')
    }
  }

  // Group messages by date
  const messagesByDate = messages.reduce((groups: Record<string, ChatMessage[]>, message) => {
    const date = new Date(message.created_at).toDateString()
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(message)
    return groups
  }, {})

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <Card className="rounded-b-none border-b">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {otherPartnership.display_name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{otherPartnership.display_name}</h3>
                <p className="text-sm text-muted-foreground">
                  Matched {formatDistanceToNow(new Date(handshake.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="photo-grant"
                  checked={photoGranted}
                  onCheckedChange={handlePhotoGrantToggle}
                  disabled={updatingGrant}
                />
                <Label htmlFor="photo-grant" className="flex items-center gap-1 cursor-pointer">
                  {photoGranted ? (
                    <>
                      <Unlock className="h-3 w-3" />
                      <span className="text-xs">Photos shared</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-3 w-3" />
                      <span className="text-xs">Photos hidden</span>
                    </>
                  )}
                </Label>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 bg-muted/20">
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Say hello to {otherPartnership.display_name}!
              </p>
            </div>
          ) : (
            Object.entries(messagesByDate).map(([date, dateMessages]) => (
              <div key={date} className="space-y-4">
                {/* Date divider */}
                <div className="flex items-center gap-2 my-4">
                  <Separator className="flex-1" />
                  <Badge variant="outline" className="text-xs">
                    {formatDateDivider(dateMessages[0].created_at)}
                  </Badge>
                  <Separator className="flex-1" />
                </div>

                {/* Messages for this date */}
                {dateMessages.map((message, index) => {
                  const isOwnMessage = message.is_own_message
                  const showAvatar = index === 0 ||
                    dateMessages[index - 1]?.sender_user !== message.sender_user

                  return (
                    <div
                      key={message.id}
                      className={`flex gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isOwnMessage && showAvatar && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {message.sender_name?.substring(0, 2).toUpperCase() || 'UN'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {!isOwnMessage && !showAvatar && (
                        <div className="w-8" />
                      )}
                      <div
                        className={`group flex flex-col max-w-[70%] ${
                          isOwnMessage ? 'items-end' : 'items-start'
                        }`}
                      >
                        {!isOwnMessage && showAvatar && (
                          <span className="text-xs text-muted-foreground mb-1">
                            {message.sender_name}
                          </span>
                        )}
                        <div
                          className={`rounded-lg px-3 py-2 ${
                            isOwnMessage
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card border'
                          }`}
                        >
                          <p className="text-sm break-words">{message.body}</p>
                        </div>
                        <span className="text-xs text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {formatMessageTime(message.created_at)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <Card className="rounded-t-none border-t">
        <CardContent className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex gap-2"
          >
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={sending}
              maxLength={2000}
              className="flex-1"
            />
            <Button type="submit" disabled={!newMessage.trim() || sending}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          {newMessage.length > 1900 && (
            <p className="text-xs text-muted-foreground mt-1">
              {2000 - newMessage.length} characters remaining
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}