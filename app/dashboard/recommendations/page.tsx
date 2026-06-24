'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ProfileCard } from '@/components/dashboard/ProfileCard'
import {
  getRecommendationCards,
  type ComputedMatchCard,
} from '@/lib/actions/computedMatchCards'
import { hideMatch } from '@/lib/actions/hiddenMatches'
import { sendHandshakeRequest } from '@/lib/actions/handshakes'
import { getUserMembershipTier } from '@/lib/actions/dashboard'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import FullPageLoader from '@/components/ui/full-page-loader'

/** Top-scoring category label for the card. */
function getTopFactor(breakdown: Record<string, { score: number }>): string {
  const labels: Record<string, string> = {
    goals_expectations: 'Goals & Expectations',
    structure_fit: 'Structure Fit',
    boundaries_comfort: 'Boundaries & Comfort',
    sexual_energy: 'Sexual Energy',
    openness_curiosity: 'Lifestyle Alignment',
  }
  const entries = Object.entries(breakdown)
  if (entries.length === 0) return 'Compatible'
  const [bestKey] = entries.reduce((a, b) => (b[1].score > a[1].score ? b : a), entries[0])
  return `Top factor: ${labels[bestKey] || bestKey}`
}

/** Card intro — prefers the AI connection summary; falls back to a short blurb. */
function buildIntro(rec: ComputedMatchCard): string {
  const summary = rec.partnership.connection_summary?.trim()
  if (summary) return summary
  const name = rec.partnership.first_name || 'They'
  const factor = getTopFactor(rec.breakdown).replace(/^Top factor:\s*/i, '')
  return `${name} shares your strengths around ${factor.toLowerCase()}. At ${rec.score}% alignment, they're just below your match threshold — worth a look.`
}

function getSignals(breakdown: Record<string, { score: number }>): string[] {
  const labels: Record<string, string> = {
    goals_expectations: 'Goals',
    structure_fit: 'Structure',
    boundaries_comfort: 'Boundaries',
    sexual_energy: 'Chemistry',
    openness_curiosity: 'Lifestyle',
  }
  return Object.entries(breakdown)
    .filter(([, v]) => v.score >= 70)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 3)
    .map(([k]) => labels[k] || k)
}

export default function RecommendationsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const [recs, setRecs] = useState<ComputedMatchCard[]>([])
  const [viewerTier, setViewerTier] = useState<'free' | 'plus'>('free')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (authLoading || !user) return
      try {
        setLoading(true)
        const [recData, tier] = await Promise.all([
          getRecommendationCards(),
          getUserMembershipTier(),
        ])
        setRecs(recData)
        setViewerTier(tier)
      } catch (err: any) {
        console.error('[Recommendations] Error:', err)
        setError(err.message || 'Failed to load recommendations')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, authLoading])

  const isViewerFree = viewerTier === 'free'

  const setConnectionStatus = (
    id: string,
    status: 'none' | 'pending' | 'connected'
  ) => {
    setRecs((prev) =>
      prev.map((r) =>
        r.partnership.id === id
          ? { ...r, connection: { ...r.connection, status } }
          : r
      )
    )
  }

  const handleConnect = async (id: string) => {
    setConnectionStatus(id, 'pending') // optimistic
    const result = await sendHandshakeRequest(id)
    if (result.success) {
      toast({ title: 'Request sent', description: 'We let them know you’d like to connect.' })
    } else {
      setConnectionStatus(id, 'none')
      toast({
        title: 'Could not send request',
        description: result.error || 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handlePass = async (id: string) => {
    const previous = recs
    setRecs((prev) => prev.filter((r) => r.partnership.id !== id))
    const result = await hideMatch(id)
    if (!result.success) {
      setRecs(previous)
      toast({
        title: 'Could not pass',
        description: result.error || 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleCardClick = (id: string) => {
    // Free viewers are driven to upgrade; paid members open the detail screen.
    if (isViewerFree) {
      router.push('/onboarding/membership')
      return
    }
    router.push(`/dashboard/matches/${id}`)
  }

  if (loading) return <FullPageLoader />

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="dash-card max-w-md w-full p-10 text-left">
          <h2 className="font-heading text-2xl text-[color:var(--haevn-navy)] mb-3">
            Couldn&rsquo;t load recommendations
          </h2>
          <p className="text-sm text-[color:var(--haevn-muted-fg)] mb-6 leading-relaxed">{error}</p>
          <button onClick={() => window.location.reload()} className="haevn-btn-primary">
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen bg-[#EEECEA]">
      <header className="px-6 sm:px-10 pt-10 pb-6 border-b border-[color:var(--haevn-border)]">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
            Just below your matches
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl text-[color:var(--haevn-navy)] mt-2 leading-tight">
            Recommendations
          </h1>
          <p className="text-sm text-[color:var(--haevn-muted-fg)] mt-2">
            Near-miss profiles scoring just below your match threshold. We surface up to three
            each week — worth a second look.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 sm:px-10 py-8 sm:py-12">
        {recs.length === 0 ? (
          <EmptyRecommendationsState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch">
            <AnimatePresence initial={false}>
              {recs.map((rec) => (
                <motion.div
                  key={rec.partnership.id}
                  className="h-full min-h-0"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ProfileCard
                    profile={{
                      id: rec.partnership.id,
                      // PHOTOLESS by design — omit photo so the silhouette renders.
                      photo: undefined,
                      username: rec.partnership.display_name || 'User',
                      firstName: rec.partnership.first_name,
                      age: rec.partnership.age,
                      city: rec.partnership.city,
                      distance: rec.partnership.distance_miles,
                      gender: rec.partnership.gender,
                      sexuality: rec.partnership.sexuality,
                      relationshipStructure: rec.partnership.relationship_structure,
                      compatibilityPercentage: rec.score,
                      topFactor: getTopFactor(rec.breakdown),
                      intro: buildIntro(rec),
                      signals: getSignals(rec.breakdown),
                    }}
                    variant="match"
                    scoreLabel="Recommendation"
                    isLocked={isViewerFree}
                    connectionStatus={rec.connection.status}
                    handshakeId={rec.connection.handshakeId}
                    matchIsFreeTier={rec.partnership.membership_tier === 'free'}
                    onClick={handleCardClick}
                    onPass={!isViewerFree ? handlePass : undefined}
                    onConnect={!isViewerFree ? handleConnect : undefined}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  )
}

function EmptyRecommendationsState() {
  return (
    <div className="max-w-lg mx-auto py-16 sm:py-24 text-left">
      <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
        Nothing here yet
      </p>
      <h2 className="font-heading text-3xl sm:text-4xl text-[color:var(--haevn-navy)] mt-3 leading-tight">
        No recommendations this week.
      </h2>
      <p className="text-base text-[color:var(--haevn-muted-fg)] leading-relaxed mt-4">
        Recommendations are near-miss profiles just below your match threshold. When the network
        surfaces some for you, they&rsquo;ll appear here — refreshed on the weekly cycle alongside
        your matches.
      </p>
    </div>
  )
}
