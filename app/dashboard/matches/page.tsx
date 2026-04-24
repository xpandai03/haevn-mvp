'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ProfileCard } from '@/components/dashboard/ProfileCard'
import {
  getComputedMatchCards,
  type ComputedMatchCard,
} from '@/lib/actions/computedMatchCards'
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
  const [bestKey] = entries.reduce(
    (a, b) => (b[1].score > a[1].score ? b : a),
    entries[0]
  )
  return `Top factor: ${labels[bestKey] || bestKey}`
}

/** Pull up to 3 supporting signal tags from the breakdown */
function getSignals(breakdown: Record<string, { score: number }>): string[] {
  const labels: Record<string, string> = {
    goals_expectations: 'Goals',
    structure_fit: 'Structure',
    boundaries_comfort: 'Boundaries',
    sexual_energy: 'Chemistry',
    openness_curiosity: 'Lifestyle',
  }
  return Object.entries(breakdown)
    .filter(([, v]) => v.score >= 0.7)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 3)
    .map(([k]) => labels[k] || k)
}

export default function MatchesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [matches, setMatches] = useState<ComputedMatchCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)

  useEffect(() => {
    async function loadMatches() {
      if (authLoading || !user) return
      try {
        setLoading(true)
        const matchData = await getComputedMatchCards('Bronze')
        setMatches(matchData)
      } catch (err: any) {
        console.error('[Matches] Error:', err)
        setError(err.message || 'Failed to load matches')
      } finally {
        setLoading(false)
      }
    }
    loadMatches()
  }, [user, authLoading])

  // Staggered reveal — one card every 700ms on initial load
  useEffect(() => {
    if (loading || matches.length === 0) return
    if (revealedCount >= matches.length) return
    const timer = setTimeout(
      () => setRevealedCount((c) => c + 1),
      revealedCount === 0 ? 200 : 700
    )
    return () => clearTimeout(timer)
  }, [revealedCount, matches.length, loading])

  const handleProfileClick = (id: string) => {
    router.push(`/profiles/${id}`)
  }

  if (loading) return <FullPageLoader />

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="dash-card max-w-md w-full p-10 text-left">
          <h2 className="font-heading text-2xl text-[color:var(--haevn-navy)] mb-3">
            Couldn&rsquo;t load matches
          </h2>
          <p className="text-sm text-[color:var(--haevn-muted-fg)] mb-6 leading-relaxed">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="haevn-btn-primary"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const visibleMatches = matches.slice(0, revealedCount)

  return (
    <div className="w-full">
      {/* Header */}
      <header className="px-6 sm:px-10 pt-10 pb-6 border-b border-[color:var(--haevn-border)]">
        <div className="max-w-5xl mx-auto flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
              Match Monday
            </p>
            <h1 className="font-heading text-3xl sm:text-4xl text-[color:var(--haevn-navy)] mt-2 leading-tight">
              Your Matches
            </h1>
            <p className="text-sm text-[color:var(--haevn-muted-fg)] mt-2">
              {matches.length === 0
                ? 'New matches are released every Monday at 8 AM ET.'
                : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'} curated for you this week.`}
            </p>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-5xl mx-auto px-6 sm:px-10 py-8 sm:py-12">
        {matches.length === 0 ? (
          <EmptyMatchesState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            <AnimatePresence initial={false}>
              {visibleMatches.map((match) => (
                <motion.div
                  key={match.partnership.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.45,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <ProfileCard
                    profile={{
                      id: match.partnership.id,
                      photo: match.partnership.photo_url || undefined,
                      username: match.partnership.display_name || 'User',
                      city: match.partnership.city,
                      compatibilityPercentage: match.score,
                      topFactor: getTopFactor(match.breakdown),
                      signals: getSignals(match.breakdown),
                    }}
                    variant="match"
                    onClick={handleProfileClick}
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

function EmptyMatchesState() {
  return (
    <div className="max-w-lg mx-auto py-16 sm:py-24 text-left">
      <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
        Stay tuned
      </p>
      <h2 className="font-heading text-3xl sm:text-4xl text-[color:var(--haevn-navy)] mt-3 leading-tight">
        Your matches are being curated.
      </h2>
      <p className="text-base text-[color:var(--haevn-muted-fg)] leading-relaxed mt-4">
        HAEVN releases a hand-picked shortlist every Monday. We scan the
        network all week so you don&rsquo;t have to — your next batch will
        appear here when it&rsquo;s ready.
      </p>
      <div className="mt-8 pt-6 border-t border-[color:var(--haevn-border)]">
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--haevn-muted-fg)]">
          While you wait
        </p>
        <ul className="mt-3 space-y-2 text-sm text-[color:var(--haevn-charcoal)]">
          <li>— Refine your profile and add photos.</li>
          <li>— Revisit your survey answers anytime.</li>
          <li>— Your compatibility only sharpens as the network grows.</li>
        </ul>
      </div>
    </div>
  )
}
