'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProfileCard } from '@/components/dashboard/ProfileCard'
import { getComputedMatchCards, type ComputedMatchCard } from '@/lib/actions/computedMatchCards'
import { useAuth } from '@/lib/auth/context'
import FullPageLoader from '@/components/ui/full-page-loader'

/** Derive a "top factor" label from the highest-scoring category */
function getTopFactor(breakdown: Record<string, { score: number }>): string {
  const labels: Record<string, string> = {
    goals_expectations: 'Goals & Expectations',
    structure_fit: 'Structure Fit',
    boundaries_comfort: 'Boundaries & Comfort',
    sexual_energy: 'Sexual Energy',
    openness_curiosity: 'Lifestyle Alignment',
  }
  const entries = Object.entries(breakdown)
  if (entries.length === 0) return 'Compatible match'
  const [bestKey] = entries.reduce((a, b) => (b[1].score > a[1].score ? b : a), entries[0])
  return `Top factor: ${labels[bestKey] || bestKey}`
}

export default function MatchesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [matches, setMatches] = useState<ComputedMatchCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load matches from computed_matches table
  useEffect(() => {
    async function loadMatches() {
      if (authLoading || !user) return

      try {
        setLoading(true)
        const matchData = await getComputedMatchCards('Bronze')
        setMatches(matchData)
        console.log('[Matches] Loaded', matchData.length, 'computed matches')
      } catch (err: any) {
        console.error('[Matches] Error:', err)
        setError(err.message || 'Failed to load matches')
      } finally {
        setLoading(false)
      }
    }

    loadMatches()
  }, [user, authLoading])

  const handleProfileClick = (id: string) => {
    router.push(`/profiles/${id}`)
  }

  const handleBack = () => {
    router.push('/dashboard')
  }

  // Loading state
  if (loading) {
    return <FullPageLoader />
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-sm">
          <h2 className="text-2xl font-bold text-haevn-navy mb-4">Error Loading Matches</h2>
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
                  Matches
                </h1>
                <p
                  className="text-sm text-haevn-charcoal/60"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 300
                  }}
                >
                  {matches.length} {matches.length === 1 ? 'match' : 'matches'}
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
        {matches.length === 0 ? (
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
                No matches yet
              </h2>
              <p
                className="text-haevn-charcoal mb-6"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  lineHeight: '120%'
                }}
              >
                Complete your survey to find compatible connections. HAEVN uses your responses to match you with people who align with your values, intentions, and relationship style.
              </p>
              <Button
                onClick={() => router.push('/onboarding/survey')}
                className="bg-haevn-teal hover:opacity-90 text-white"
              >
                Complete Survey
              </Button>
            </div>
          </div>
        ) : (
          // Matches List
          <div className="space-y-4">
            {matches.map((match) => (
              <div key={match.partnership.id} className="w-full">
                <ProfileCard
                  profile={{
                    id: match.partnership.id,
                    photo: match.partnership.photo_url || undefined,
                    username: match.partnership.display_name || 'User',
                    city: match.partnership.city,
                    compatibilityPercentage: match.score,
                    topFactor: getTopFactor(match.breakdown)
                  }}
                  variant="match"
                  onClick={handleProfileClick}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
