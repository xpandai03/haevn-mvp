'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, Loader2, MoreVertical, MessageCircle, MapPin, Users, User, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth/context'
import { getConnectionById, type ConnectionResult } from '@/lib/actions/connections'
import { getUserMembershipTier } from '@/lib/actions/dashboard'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'

// Profile type labels
const PROFILE_TYPE_LABELS: Record<string, string> = {
  solo: 'Solo',
  couple: 'Couple',
  pod: 'Pod',
}

export default function ConnectionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const connectionId = params.id as string
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [connection, setConnection] = useState<ConnectionResult | null>(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [membershipTier, setMembershipTier] = useState<'free' | 'plus'>('free')

  // Load connection details (all data comes from server action, bypasses RLS)
  useEffect(() => {
    async function loadConnection() {
      if (authLoading || !user || !connectionId) return

      try {
        setLoading(true)

        // Check membership tier
        const tier = await getUserMembershipTier()
        setMembershipTier(tier)

        const connectionData = await getConnectionById(connectionId)

        if (!connectionData) {
          setError('Connection not found')
          return
        }

        setConnection(connectionData)
      } catch (err: any) {
        console.error('[ConnectionDetail] Error:', err)
        setError(err.message || 'Failed to load connection')
      } finally {
        setLoading(false)
      }
    }

    loadConnection()
  }, [user, authLoading, connectionId])

  // Handle message action
  const handleMessage = () => {
    if (!connection) return

    // Check membership before allowing message
    if (membershipTier !== 'plus') {
      toast({
        title: 'Upgrade Required',
        description: 'Upgrade to HAEVN+ to message connections',
        variant: 'destructive'
      })
      router.push('/onboarding/membership')
      return
    }

    router.push(`/chat/${connection.partnership.id}`)
  }

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
          <p className="text-haevn-charcoal">Loading connection details...</p>
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
            This connection may no longer be available or there was an error loading the details.
          </p>
          <Button onClick={() => router.push('/connections')} className="bg-haevn-teal">
            Back to Connections
          </Button>
        </div>
      </div>
    )
  }

  const { partnership, compatibility, matchedAt } = connection
  const photos = partnership.photos || []

  // Get initials for avatar fallback
  const initials = (partnership.display_name || '')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??'

  // Format connection date
  const connectedAgo = formatDistanceToNow(new Date(matchedAt), { addSuffix: true })

  // Get structure type label
  const structureType = partnership.structure?.type || partnership.profile_type || 'solo'
  const structureLabel = PROFILE_TYPE_LABELS[structureType] || 'Solo'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-haevn-teal h-12 flex items-center justify-between px-4 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="text-white text-sm font-medium flex items-center gap-1 hover:opacity-80"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-white font-medium text-sm">Connected Profile</span>
        <button className="text-white hover:opacity-80">
          <MoreVertical className="w-5 h-5" />
        </button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Photo Gallery */}
        {photos.length > 0 ? (
          <div className="relative bg-black">
            <div className="aspect-[4/3] relative">
              <Image
                src={photos[activePhotoIndex]?.photo_url || ''}
                alt={partnership.display_name || 'Profile photo'}
                fill
                className="object-cover"
                priority
              />
            </div>
            {/* Photo dots indicator */}
            {photos.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                {photos.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActivePhotoIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === activePhotoIndex
                        ? 'bg-white w-4'
                        : 'bg-white/50 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
            )}
            {/* Photo navigation arrows */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setActivePhotoIndex(i => (i > 0 ? i - 1 : photos.length - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white"
                >
                  ‹
                </button>
                <button
                  onClick={() => setActivePhotoIndex(i => (i < photos.length - 1 ? i + 1 : 0))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white"
                >
                  ›
                </button>
              </>
            )}
          </div>
        ) : (
          /* No photos placeholder */
          <div className="aspect-[4/3] bg-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-3xl font-bold text-gray-500">{initials}</span>
              </div>
              <p className="text-sm">No photos yet</p>
            </div>
          </div>
        )}

        {/* Profile Content */}
        <div className="px-5 py-5 space-y-5">
          {/* Name & Basic Info Card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1
                  className="text-2xl font-bold text-haevn-navy"
                  style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 700 }}
                >
                  {partnership.display_name || 'Anonymous'}
                </h1>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                  {structureType === 'couple' || structureType === 'pod' ? (
                    <Users className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  <span>{structureLabel}</span>
                  {partnership.age && partnership.age > 0 && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span>{partnership.age}</span>
                    </>
                  )}
                </div>
              </div>
              {/* Compatibility Badge */}
              {compatibility.overallScore > 0 && (
                <div className="flex items-center gap-1.5 bg-haevn-teal/10 px-3 py-1.5 rounded-full">
                  <Heart className="w-4 h-4 text-haevn-teal" />
                  <span className="text-sm font-semibold text-haevn-teal">
                    {compatibility.overallScore}%
                  </span>
                </div>
              )}
            </div>

            {/* Location */}
            {partnership.city && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <MapPin className="w-4 h-4" />
                <span>{partnership.city}</span>
              </div>
            )}

            {/* Connected date */}
            <p className="text-xs text-gray-400 mt-2">
              Connected {connectedAgo}
            </p>
          </div>

          {/* About Section */}
          {(partnership.short_bio || partnership.long_bio) && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2
                className="text-base font-semibold text-haevn-navy mb-3"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 600 }}
              >
                About
              </h2>
              {partnership.short_bio && (
                <p
                  className="text-sm text-gray-700 leading-relaxed"
                  style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
                >
                  {partnership.short_bio}
                </p>
              )}
              {partnership.long_bio && (
                <p
                  className="text-sm text-gray-600 leading-relaxed mt-3"
                  style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
                >
                  {partnership.long_bio}
                </p>
              )}
            </div>
          )}

          {/* Intentions Section */}
          {partnership.intentions && partnership.intentions.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2
                className="text-base font-semibold text-haevn-navy mb-3"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 600 }}
              >
                Looking For
              </h2>
              <div className="flex flex-wrap gap-2">
                {partnership.intentions.map(intention => (
                  <Badge
                    key={intention}
                    variant="secondary"
                    className="bg-haevn-teal/10 text-haevn-teal hover:bg-haevn-teal/10 cursor-default"
                  >
                    {intention}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Lifestyle Section */}
          {partnership.lifestyle_tags && partnership.lifestyle_tags.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2
                className="text-base font-semibold text-haevn-navy mb-3"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 600 }}
              >
                Lifestyle & Interests
              </h2>
              <div className="flex flex-wrap gap-2">
                {partnership.lifestyle_tags.map(tag => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="border-gray-300 text-gray-600 hover:bg-transparent cursor-default"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Spacer for bottom button */}
          <div className="h-4" />
        </div>
      </div>

      {/* Fixed Bottom Action - Message Button */}
      <div className="px-5 pb-6 pt-3 bg-white border-t border-gray-200 flex-shrink-0">
        <Button
          className="w-full h-12 text-base font-semibold bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-full flex items-center justify-center gap-2"
          onClick={handleMessage}
        >
          <MessageCircle className="h-5 w-5" />
          MESSAGE
        </Button>
      </div>
    </div>
  )
}
