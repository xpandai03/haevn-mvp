'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, MessageCircle, Users, Sparkles, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '@/lib/auth/context'
import { getMyConversations, type ConversationItem } from '@/lib/actions/connections'
import { getUserMembershipTier } from '@/lib/actions/dashboard'
import { useToast } from '@/hooks/use-toast'

export default function ChatPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadConversations() {
      if (authLoading) return

      if (!user) {
        router.push('/auth/login')
        return
      }

      try {
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

        // Load conversations using server action (admin client)
        const convos = await getMyConversations()
        setConversations(convos)
      } catch (err) {
        console.error('[ChatPage] Error loading conversations:', err)
      } finally {
        setLoading(false)
      }
    }

    loadConversations()
  }, [user, authLoading, router, toast])

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Messages</h1>
            <p className="text-muted-foreground">
              {conversations.length > 0
                ? `${conversations.length} ${conversations.length === 1 ? 'conversation' : 'conversations'}`
                : 'Chat with your matches'}
            </p>
          </div>
        </div>

        {conversations.length === 0 ? (
          <Card>
            <CardHeader>
              <div className="flex flex-col items-center text-center py-8">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="mb-2">No conversations yet</CardTitle>
                <CardDescription className="max-w-sm">
                  When you connect with another partnership, you'll be able to start chatting here
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="text-center pb-8">
              <Button onClick={() => router.push('/discovery')}>
                <Users className="h-4 w-4 mr-2" />
                Browse Profiles
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ScrollArea className="h-[calc(100vh-12rem)]">
              {conversations.map((conversation, index) => {
                const initials = conversation.displayName
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)

                return (
                  <div key={conversation.handshakeId}>
                    <button
                      className="w-full text-left hover:bg-muted/50 transition-colors p-4"
                      onClick={() => router.push(`/chat/${conversation.handshakeId}`)}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12">
                          {conversation.photoUrl ? (
                            <AvatarImage src={conversation.photoUrl} alt={conversation.displayName} />
                          ) : (
                            <AvatarFallback>{initials}</AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-semibold truncate">
                              {conversation.displayName}
                            </h3>
                            <div className="flex items-center gap-2">
                              {conversation.lastMessage && (
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), {
                                    addSuffix: false
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conversation.lastMessage
                              ? `${conversation.lastMessage.isOwn ? 'You: ' : ''}${conversation.lastMessage.body}`
                              : 'Start a conversation'}
                          </p>
                          {conversation.unreadCount > 0 && (
                            <Badge variant="default" className="mt-1 bg-orange-500">
                              {conversation.unreadCount} new
                            </Badge>
                          )}
                        </div>
                        <MessageCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </button>
                    {index < conversations.length - 1 && <Separator />}
                  </div>
                )
              })}
            </ScrollArea>
          </Card>
        )}
      </div>
    </div>
  )
}
