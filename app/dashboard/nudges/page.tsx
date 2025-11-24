'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProfileCard } from '@/components/dashboard/ProfileCard'
import { getReceivedNudges, Nudge } from '@/lib/actions/nudges'
import { useAuth } from '@/lib/auth/context'
import { getUserMembershipTier } from '@/lib/actions/dashboard'

export default function NudgesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [membershipTier, setMembershipTier] = useState<'free' | 'plus'>('free')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load nudges
  useEffect(() => {
    async function loadNudges() {
      if (authLoading || !user) return

      try {
        setLoading(true)
        const [nudgesData, tierData] = await Promise.all([
          getReceivedNudges(),
          getUserMembershipTier()
        ])
        setNudges(nudgesData)
        setMembershipTier(tierData)
        console.log('[Nudges] Loaded', nudgesData.length, 'nudges')
      } catch (err: any) {
        console.error('[Nudges] Error:', err)
        setError(err.message || 'Failed to load nudges')
      } finally {
        setLoading(false)
      }
    }

    loadNudges()
  }, [user, authLoading])

  const handleProfileClick = (id: string) => {
    router.push(`/profiles/${id}`)
  }

  const handleBack = () => {
    router.push('/dashboard')
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
          <p className="text-haevn-charcoal">Loading nudges...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-sm">
          <h2 className="text-2xl font-bold text-haevn-navy mb-4">Error Loading Nudges</h2>
          <p className="text-haevn-charcoal mb-6">{error}</p>
          <Button onClick={() => window.location.reload()} className="w-full bg-haevn-teal">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-haevn-lightgray">
      {/* Header */}
      <header className="bg-white border-b border-haevn-gray-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            {/* Back Button and Title */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="text-haevn-charcoal hover:text-haevn-teal"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-bold text-haevn-navy"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 700,
                    lineHeight: '110%',
                    letterSpacing: '-0.015em'
                  }}
                >
                  Nudges
                </h1>
                <p
                  className="text-sm text-haevn-charcoal/60"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 300
                  }}
                >
                  {nudges.length} {nudges.length === 1 ? 'nudge' : 'nudges'}
                </p>
              </div>
            </div>

            {/* Filter Button (Future Enhancement) */}
            <Button
              variant="outline"
              size="sm"
              disabled
              className="text-haevn-charcoal"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Filters</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {nudges.length === 0 ? (
          // Empty State
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <div className="max-w-md mx-auto">
              <h2
                className="text-2xl font-bold text-haevn-navy mb-4"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 700
                }}
              >
                {membershipTier === 'plus' ? 'No nudges yet' : 'Nudges are a HAEVN+ feature'}
              </h2>
              <p
                className="text-haevn-charcoal mb-6"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  lineHeight: '120%'
                }}
              >
                {membershipTier === 'plus'
                  ? "You haven't received any nudges yet. When someone nudges you, they'll appear here."
                  : "Upgrade to HAEVN+ to send and receive nudges. Nudges are a lightweight way to express interest in profiles."
                }
              </p>
              <Button
                onClick={() => router.push(membershipTier === 'plus' ? '/dashboard/matches' : '/pricing')}
                className="bg-haevn-teal hover:opacity-90 text-white"
              >
                {membershipTier === 'plus' ? 'View Matches' : 'Upgrade to HAEVN+'}
              </Button>
            </div>
          </div>
        ) : (
          // Nudges List
          <div className="space-y-4">
            {nudges.map((nudge) => (
              <div key={nudge.id} className="w-full">
                <ProfileCard
                  profile={{
                    id: nudge.senderPartnershipId,
                    photo: nudge.photo,
                    username: nudge.username,
                    city: nudge.city,
                    compatibilityPercentage: nudge.compatibilityPercentage,
                    topFactor: nudge.topFactor
                  }}
                  variant="nudge"
                  onClick={handleProfileClick}
                  nudgedAt={nudge.nudgedAt}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
