'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPartnershipProfileById, type PartnershipProfileData } from '@/lib/actions/partnership-simple'
import { useAuth } from '@/lib/auth/context'
import { sendNudge } from '@/lib/actions/nudges'
import { getUserMembershipTier } from '@/lib/actions/dashboard'
import { getHandshakeIdForPartnerships, getMyPartnershipId } from '@/lib/actions/connections'
import { useToast } from '@/hooks/use-toast'
import { ProfileContent } from '@/components/profiles/ProfileContent'

/**
 * Profile View
 *
 * CRITICAL: This page uses the EXACT same data contract and rendering component
 * as ProfilePreviewModal. When User A views User B, they see the same profile
 * that User B sees in "View Match Profile".
 *
 * Data flow:
 * - getPartnershipProfileById() → PartnershipProfileData → ProfileContent
 *
 * This is identical to:
 * - getMyPartnershipProfile() → PartnershipProfileData → ProfileContent
 *
 * CONNECTION HANDLING:
 * - If handshakeId is passed via URL params (from Connections list), messaging is allowed
 * - FALLBACK: If no URL param, we check for connection server-side via getHandshakeIdForPartnerships()
 * - This ensures Message button works from ANY entry point (direct URL, Connections list, chat header, etc.)
 */
export default function ProfileViewPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const partnershipId = params.id as string

  // Get handshakeId from URL params - this is passed from Connections list
  // If present, the user is viewing a connected profile and messaging is allowed
  const handshakeId = searchParams.get('handshakeId')

  const [profile, setProfile] = useState<PartnershipProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [membershipTier, setMembershipTier] = useState<'free' | 'plus'>('free')
  const [nudging, setNudging] = useState(false)
  const [viewerPartnershipId, setViewerPartnershipId] = useState<string | null>(null)
  const [resolvingHandshake, setResolvingHandshake] = useState(false)

  // Load profile data using the SAME data contract as ProfilePreviewModal
  useEffect(() => {
    async function loadProfile() {
      if (authLoading || !user) return

      try {
        setLoading(true)

        // Load profile, membership tier, and viewer's partnership ID in parallel
        const [profileResult, tierData, myPartnershipId] = await Promise.all([
          getPartnershipProfileById(partnershipId),
          getUserMembershipTier(),
          getMyPartnershipId()
        ])

        setViewerPartnershipId(myPartnershipId)

        if (profileResult.error || !profileResult.data) {
          setError(profileResult.error || 'Profile not found')
          return
        }

        setProfile(profileResult.data)
        setMembershipTier(tierData)

        console.log('[ProfileView] Loaded profile:', profileResult.data.display_name, 'handshakeId:', handshakeId)
      } catch (err: any) {
        console.error('[ProfileView] Error:', err)
        setError(err.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [partnershipId, user, authLoading, handshakeId])

  const handleBack = () => {
    router.back()
  }

  // Action handlers
  const handleMessage = async () => {
    if (membershipTier !== 'plus') {
      toast({
        title: 'HAEVN+ Required',
        description: 'Upgrade to HAEVN+ to message profiles',
        variant: 'destructive'
      })
      router.push('/onboarding/membership')
      return
    }

    // Try URL param first (fast path from Connections list)
    let resolvedHandshakeId = handshakeId

    // Fallback: server-side lookup if URL param missing
    if (!resolvedHandshakeId && viewerPartnershipId && partnershipId) {
      setResolvingHandshake(true)
      try {
        resolvedHandshakeId = await getHandshakeIdForPartnerships(
          viewerPartnershipId,
          partnershipId
        )
      } catch (error) {
        console.error('[ProfileView] Failed to resolve handshake:', error)
      } finally {
        setResolvingHandshake(false)
      }
    }

    if (resolvedHandshakeId) {
      router.push(`/chat/${resolvedHandshakeId}`)
    } else {
      toast({
        title: 'Not Connected',
        description: 'You need to connect with this profile first',
        variant: 'destructive'
      })
    }
  }

  const handleNudge = async () => {
    if (!user || !profile) return

    if (membershipTier !== 'plus') {
      toast({
        title: 'HAEVN+ Required',
        description: 'Upgrade to HAEVN+ to send nudges',
        variant: 'destructive'
      })
      router.push('/pricing')
      return
    }

    try {
      setNudging(true)
      const result = await sendNudge(partnershipId)

      if (result.success) {
        toast({
          title: 'Nudge Sent!',
          description: `You nudged ${profile.display_name}`
        })
      } else {
        toast({
          title: 'Failed to Send Nudge',
          description: result.error || 'Please try again',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send nudge',
        variant: 'destructive'
      })
    } finally {
      setNudging(false)
    }
  }

  const handleBlock = () => {
    toast({
      title: 'Block Feature',
      description: 'Block functionality coming soon'
    })
  }

  const handleReport = () => {
    toast({
      title: 'Report Feature',
      description: 'Report functionality coming soon'
    })
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
          <p className="text-haevn-charcoal">Loading profile...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-sm">
          <h2 className="text-2xl font-bold text-haevn-navy mb-4">Profile Not Found</h2>
          <p className="text-haevn-charcoal mb-6">{error || 'This profile could not be loaded.'}</p>
          <Button onClick={handleBack} className="w-full bg-haevn-teal">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  // Free user gating
  if (membershipTier !== 'plus') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-sm text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-haevn-teal/10 flex items-center justify-center">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold text-haevn-navy mb-4">
            Upgrade to View Profile
          </h2>
          <p className="text-haevn-charcoal mb-6">
            Full profiles, messaging, and connections are available to HAEVN+ members.
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/onboarding/membership')}
              className="w-full bg-haevn-teal hover:bg-haevn-teal/90"
            >
              Upgrade to HAEVN+
            </Button>
            <Button
              variant="outline"
              onClick={handleBack}
              className="w-full"
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-haevn-lightgray">
      {/* Header */}
      <header className="bg-white border-b border-haevn-gray-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-haevn-charcoal hover:text-haevn-teal"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="ml-3 font-medium text-haevn-navy">
            {profile.display_name || 'Profile'}
          </span>
        </div>
      </header>

      {/* Main Content - Uses shared ProfileContent component */}
      <main className="max-w-md mx-auto">
        {/* Profile Content - EXACT same component as ProfilePreviewModal */}
        <ProfileContent profile={profile} isOwnProfile={false} />

        {/* Action Buttons */}
        <div className="px-4 pb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="bg-haevn-teal hover:opacity-90 text-white"
                onClick={handleMessage}
                disabled={resolvingHandshake}
              >
                {resolvingHandshake ? 'Loading...' : 'Message'}
              </Button>
              <Button
                variant="outline"
                className="text-haevn-charcoal"
                onClick={handleNudge}
                disabled={nudging}
              >
                {nudging ? 'Sending...' : 'Nudge'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Button
                variant="outline"
                className="text-haevn-charcoal hover:text-red-600 hover:border-red-600"
                onClick={handleBlock}
              >
                Block
              </Button>
              <Button
                variant="outline"
                className="text-haevn-charcoal hover:text-red-600 hover:border-red-600"
                onClick={handleReport}
              >
                Report
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
