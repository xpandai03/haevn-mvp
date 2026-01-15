'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, Loader2, MoreVertical, MessageCircle, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { getConnectionById, type ConnectionResult } from '@/lib/actions/connections'
import { getUserMembershipTier } from '@/lib/actions/dashboard'
import { useToast } from '@/hooks/use-toast'
import { ProfileContent } from '@/components/profiles/ProfileContent'
import type { PartnershipProfileData } from '@/lib/actions/partnership-simple'

/**
 * Connection Detail Page
 *
 * Uses the shared ProfileContent component for profile rendering (same as ProfilePreviewModal).
 * Adds connection-specific extras: compatibility badge, connected date, message button.
 */
export default function ConnectionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const connectionId = params.id as string
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [connection, setConnection] = useState<ConnectionResult | null>(null)
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

    // Use handshakeId for chat navigation (not partnership.id)
    router.push(`/chat/${connection.handshakeId}`)
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

  // Format connection date
  const connectedAgo = formatDistanceToNow(new Date(matchedAt), { addSuffix: true })

  // Map ConnectionResult.partnership to PartnershipProfileData for ProfileContent
  const profileData: PartnershipProfileData = {
    id: partnership.id,
    display_name: partnership.display_name,
    short_bio: partnership.short_bio,
    long_bio: partnership.long_bio,
    intentions: partnership.intentions,
    lifestyle_tags: partnership.lifestyle_tags,
    structure: partnership.structure,
    orientation: partnership.orientation,
    profile_type: partnership.profile_type,
    city: partnership.city,
    age: partnership.age,
    photos: partnership.photos.map(p => ({
      id: p.id,
      photo_url: p.photo_url,
      photo_type: 'public' as const,
      is_primary: p.is_primary
    }))
  }

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

      {/* Connection Info Banner - extras not in ProfileContent */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Connected {connectedAgo}
        </p>
        {/* Compatibility Badge */}
        {compatibility.overallScore > 0 && (
          <div className="flex items-center gap-1.5 bg-haevn-teal/10 px-3 py-1.5 rounded-full">
            <Heart className="w-4 h-4 text-haevn-teal" />
            <span className="text-sm font-semibold text-haevn-teal">
              {compatibility.overallScore}% match
            </span>
          </div>
        )}
      </div>

      {/* Scrollable Content - Uses shared ProfileContent component */}
      <div className="flex-1 overflow-y-auto">
        <ProfileContent profile={profileData} isOwnProfile={false} />
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
