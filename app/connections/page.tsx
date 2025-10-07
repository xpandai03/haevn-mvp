'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { getConnections } from '@/lib/actions/handshakes'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, MessageCircle, Users } from 'lucide-react'
import { HaevnLogo } from '@/components/HaevnLogo'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { MapPin, Heart } from 'lucide-react'

interface ConnectionData {
  id: string
  partnership: {
    id: string
    display_name: string | null
    short_bio: string | null
    city: string
    age: number
    identity: string
  }
  message?: string
  score?: number
  matched_at?: string
}

export default function ConnectionsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [connections, setConnections] = useState<ConnectionData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    async function loadConnections() {
      if (!user) return

      try {
        setLoading(true)
        const connectionsData = await getConnections()
        setConnections(connectionsData)
      } catch (err: any) {
        console.error('Error loading connections:', err)
        setError(err.message || 'Failed to load connections')
      } finally {
        setLoading(false)
      }
    }

    loadConnections()
  }, [user])

  const getInitials = (name: string | null) => {
    if (!name) return '??'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Recently'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return `${Math.floor(diffDays / 30)} months ago`
  }

  const handleStartChat = (connectionId: string) => {
    router.push(`/chat/${connectionId}`)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#008080]" />
          <p className="text-[#252627]/60" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            Loading your connections...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 border-2 border-[#252627]/10">
          <h2 className="text-h2 text-red-600 mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
            Error Loading Connections
          </h2>
          <p className="text-body text-[#252627]/70 mb-4" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            {error}
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="w-full bg-gradient-to-r from-[#E29E0C] to-[#D88A0A]"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#E8E6E3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="text-[#252627] hover:text-[#008080]"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </Button>
            <HaevnLogo size="sm" />
          </div>

          <div>
            <h1 className="text-h1 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
              Your Connections
            </h1>
            <p className="text-body text-[#252627]/70" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
              {connections.length} {connections.length === 1 ? 'partnership' : 'partnerships'} you've connected with
            </p>
          </div>
        </div>

        {/* Connections Grid */}
        {connections.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl p-12 border-2 border-dashed border-[#252627]/20">
              <Users className="h-16 w-16 mx-auto text-[#252627]/20 mb-4" />
              <h3 className="text-h3 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
                No connections yet
              </h3>
              <p className="text-body text-[#252627]/60 mb-4" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                Start by browsing matches and sending handshake requests!
              </p>
              <Button
                onClick={() => router.push('/matches')}
                className="bg-gradient-to-r from-[#E29E0C] to-[#D88A0A] hover:from-[#D88A0A] hover:to-[#C77A09] text-white"
                style={{ fontFamily: 'Roboto', fontWeight: 500 }}
              >
                Browse Matches
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {connections.map((connection) => (
              <Card
                key={connection.id}
                className="hover:shadow-lg transition-all duration-200 border-[#252627]/10"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4">
                    {/* Header with Avatar */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-16 w-16 border-2 border-[#008080]">
                        <AvatarImage src={''} />
                        <AvatarFallback className="bg-[#E8E6E3] text-[#252627] text-xl font-bold">
                          {getInitials(connection.partnership.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-[#252627] mb-1" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
                          {connection.partnership.display_name || 'Anonymous'}
                        </h3>
                        <div className="flex items-center gap-1 text-sm text-[#252627]/60">
                          <MapPin className="h-3 w-3" />
                          <span>{connection.partnership.city}</span>
                          <span className="mx-1">•</span>
                          <span>{connection.partnership.age}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
                    {connection.partnership.short_bio && (
                      <p className="text-sm text-[#252627]/70 line-clamp-3" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                        {connection.partnership.short_bio}
                      </p>
                    )}

                    {/* Identity and Match Score */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-[#008080]/10 text-[#008080] border-[#008080]/30">
                        {connection.partnership.identity}
                      </Badge>
                      {connection.score && (
                        <div className="flex items-center gap-1 text-xs text-[#252627]/50">
                          <Heart className="h-3 w-3" />
                          <span>{connection.score}% match</span>
                        </div>
                      )}
                    </div>

                    {/* Connection Date */}
                    <p className="text-xs text-[#252627]/50" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                      Connected {formatDate(connection.matched_at)}
                    </p>

                    {/* Action Button */}
                    <Button
                      onClick={() => handleStartChat(connection.id)}
                      className="w-full bg-gradient-to-r from-[#008080] to-[#006666] hover:from-[#006666] hover:to-[#005555] text-white"
                      style={{ fontFamily: 'Roboto', fontWeight: 500 }}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Start Conversation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}