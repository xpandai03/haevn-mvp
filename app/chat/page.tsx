'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, MessageCircle, Users, Sparkles, Lock, Unlock, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '@/lib/auth/context'
import { useProfile } from '@/hooks/useProfile'
import { getUserHandshakes } from '@/lib/services/chat'
import { ensureUserPartnership } from '@/lib/services/partnership'
import { ChatConversation } from '@/components/ChatConversation'
import { useToast } from '@/hooks/use-toast'
import type { HandshakeWithPartnerships } from '@/lib/services/chat'

export default function ChatPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { profile } = useProfile()
  const { toast } = useToast()
  const [handshakes, setHandshakes] = useState<HandshakeWithPartnerships[]>([])
  const [selectedHandshake, setSelectedHandshake] = useState<HandshakeWithPartnerships | null>(null)
  const [loading, setLoading] = useState(true)
  const [partnershipId, setPartnershipId] = useState<string | null>(null)

  useEffect(() => {
    async function loadHandshakes() {
      if (!user) {
        router.push('/auth/login')
        return
      }

      if (!profile) {
        return // Wait for profile to load
      }

      // Enforce gating rules
      if (!profile.survey_complete) {
        toast({
          title: 'Complete your survey first',
          description: 'You must complete your survey before accessing chat',
          variant: 'destructive'
        })
        router.push('/onboarding/survey')
        return
      }

      // Ensure user has a partnership
      const { partnership } = await ensureUserPartnership(user.id)
      if (!partnership) {
        toast({
          title: 'Error',
          description: 'Failed to load partnership data',
          variant: 'destructive'
        })
        return
      }

      setPartnershipId(partnership.id)

      // Check membership
      const membershipTier = partnership.membership_tier || 'free'
      if (membershipTier === 'free') {
        toast({
          title: 'Upgrade Required',
          description: 'Upgrade to HAEVN+ to access chat',
          variant: 'destructive'
        })
        router.push('/onboarding/membership')
        return
      }

      // Load handshakes
      const userHandshakes = await getUserHandshakes(user.id)
      setHandshakes(userHandshakes)
      setLoading(false)
    }

    loadHandshakes()
  }, [user, profile, router, toast])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    )
  }

  // Show conversation if one is selected
  if (selectedHandshake && partnershipId) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto">
          <ChatConversation
            handshake={selectedHandshake}
            currentPartnershipId={partnershipId}
            onBack={() => setSelectedHandshake(null)}
          />
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
              {handshakes.length > 0
                ? `${handshakes.length} ${handshakes.length === 1 ? 'match' : 'matches'}`
                : 'Chat with your matches'}
            </p>
          </div>
        </div>

        {handshakes.length === 0 ? (
          <Card>
            <CardHeader>
              <div className="flex flex-col items-center text-center py-8">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="mb-2">No matches yet</CardTitle>
                <CardDescription className="max-w-sm">
                  When you and another partnership both like each other, you'll be able to start chatting here
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
              {handshakes.map((handshake, index) => {
                const otherPartnership = handshake.a_partnership.id === partnershipId
                  ? handshake.b_partnership
                  : handshake.a_partnership

                const hasUnread = handshake.unread_count > 0

                return (
                  <div key={handshake.id}>
                    <button
                      className="w-full text-left hover:bg-muted/50 transition-colors p-4"
                      onClick={() => setSelectedHandshake(handshake)}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>
                            {otherPartnership.display_name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-semibold truncate">
                              {otherPartnership.display_name}
                            </h3>
                            <div className="flex items-center gap-2">
                              {handshake.photo_grant?.granted && (
                                <Unlock className="h-3 w-3 text-muted-foreground" />
                              )}
                              {handshake.last_message && (
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(handshake.last_message.created_at), {
                                    addSuffix: false
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {handshake.last_message
                              ? handshake.last_message.body
                              : 'Start a conversation'}
                          </p>
                          {hasUnread && (
                            <Badge variant="default" className="mt-1">
                              {handshake.unread_count} new
                            </Badge>
                          )}
                        </div>
                        <MessageCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </button>
                    {index < handshakes.length - 1 && <Separator />}
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