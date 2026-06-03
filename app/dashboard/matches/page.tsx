'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { ProfileCard } from '@/components/dashboard/ProfileCard'
import {
  getComputedMatchCards,
  type ComputedMatchCard,
} from '@/lib/actions/computedMatchCards'
import { getHiddenMatches, hideMatch } from '@/lib/actions/hiddenMatches'
import { sendHandshakeRequest } from '@/lib/actions/handshakes'
import { sendNudge, getReceivedNudges } from '@/lib/actions/nudges'
import {
  getCheckedInMatchIds,
  submitCheckin,
  type CheckinResponse,
} from '@/lib/actions/checkins'
import { getUserMembershipTier } from '@/lib/actions/dashboard'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
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

/**
 * Match intro prose for the card. Prefers the AI-generated connection summary;
 * falls back to a templated 2-sentence blurb built from the score + top factor.
 */
function buildIntro(match: ComputedMatchCard): string {
  const summary = match.partnership.connection_summary?.trim()
  if (summary) return summary
  const name = match.partnership.first_name || 'They'
  const factor = getTopFactor(match.breakdown).replace(/^Top factor:\s*/i, '')
  return `${name} shares your strengths around ${factor.toLowerCase()}. With ${match.score}% alignment across key dimensions, this could be a meaningful connection.`
}

/** "Where you might differ" line, derived from the lowest-scoring dimension. */
function buildContrast(
  breakdown: Record<string, { score: number }>
): string | undefined {
  const labels: Record<string, string> = {
    goals_expectations: 'goals and expectations',
    structure_fit: 'relationship structure',
    boundaries_comfort: 'boundaries and comfort',
    sexual_energy: 'physical chemistry',
    openness_curiosity: 'lifestyle and openness',
  }
  const entries = Object.entries(breakdown)
  if (entries.length === 0) return undefined
  const [lowKey] = entries.reduce(
    (min, b) => (b[1].score < min[1].score ? b : min),
    entries[0]
  )
  return `you may approach ${labels[lowKey] || lowKey} differently`
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
  // Category scores from the engine are 0–100 (see parseBreakdown in computedMatchCards)
  return Object.entries(breakdown)
    .filter(([, v]) => v.score >= 70)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 3)
    .map(([k]) => labels[k] || k)
}

export default function MatchesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const [matches, setMatches] = useState<ComputedMatchCard[]>([])
  const [viewerTier, setViewerTier] = useState<'free' | 'plus'>('free')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)
  const [hiddenCount, setHiddenCount] = useState(0)
  const [nudgedYouIds, setNudgedYouIds] = useState<Set<string>>(new Set())
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set())
  const [checkInDismissed, setCheckInDismissed] = useState(false)

  useEffect(() => {
    async function loadMatches() {
      if (authLoading || !user) return
      try {
        setLoading(true)
        const [matchData, tier, hidden, checkedIn] = await Promise.all([
          getComputedMatchCards('Bronze'),
          getUserMembershipTier(),
          getHiddenMatches(),
          getCheckedInMatchIds(),
        ])
        setMatches(matchData)
        setViewerTier(tier)
        setHiddenCount(hidden.length)
        setCheckedInIds(new Set(checkedIn))

        // Free viewers: figure out which matches have nudged them (for the
        // "Nudge received" banner on locked cards).
        if (tier === 'free') {
          try {
            const received = await getReceivedNudges()
            setNudgedYouIds(
              new Set(received.map((n) => n.senderPartnershipId))
            )
          } catch {
            /* non-fatal */
          }
        }
      } catch (err: any) {
        console.error('[Matches] Error:', err)
        setError(err.message || 'Failed to load matches')
      } finally {
        setLoading(false)
      }
    }
    loadMatches()
  }, [user, authLoading])

  const handlePass = async (id: string) => {
    // Optimistic: drop from the grid and bump the hidden count immediately.
    const previous = matches
    setMatches((prev) => prev.filter((m) => m.partnership.id !== id))
    setHiddenCount((c) => c + 1)
    const result = await hideMatch(id)
    if (!result.success) {
      // Roll back on failure.
      setMatches(previous)
      setHiddenCount((c) => Math.max(0, c - 1))
      toast({
        title: 'Could not hide match',
        description: result.error || 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const setConnectionStatus = (
    id: string,
    status: 'none' | 'pending' | 'connected'
  ) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.partnership.id === id
          ? { ...m, connection: { ...m.connection, status } }
          : m
      )
    )
  }

  const handleConnect = async (id: string) => {
    setConnectionStatus(id, 'pending') // optimistic
    const result = await sendHandshakeRequest(id)
    if (result.success) {
      toast({
        title: 'Request sent',
        description: 'We let them know you’d like to connect.',
      })
    } else {
      setConnectionStatus(id, 'none')
      toast({
        title: 'Could not send request',
        description: result.error || 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleNudge = async (id: string) => {
    setConnectionStatus(id, 'pending') // reuse pending visual ("Request sent")
    const result = await sendNudge(id)
    if (result.success) {
      toast({ title: 'Nudge sent', description: 'They’ve been notified.' })
    } else {
      setConnectionStatus(id, 'none')
      toast({
        title: 'Could not nudge',
        description: result.error || 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleMessage = (handshakeId: string) => {
    router.push(`/chat/${handshakeId}`)
  }

  const handleCheckIn = async (id: string, response: CheckinResponse) => {
    setCheckedInIds((prev) => new Set(prev).add(id))
    const result = await submitCheckin(id, response)
    if (result.success) {
      toast({
        title: 'Thanks for the feedback!',
        description: 'We’ll use it to fine-tune your future matches.',
      })
    } else {
      setCheckedInIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      toast({
        title: 'Could not save feedback',
        description: result.error || 'Please try again.',
        variant: 'destructive',
      })
    }
  }

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

  const isViewerFree = viewerTier === 'free'

  const handleMatchCardClick = (id: string) => {
    // Both tiers open the bespoke match detail screen. Free users see the
    // redacted teaser there (silhouette + summaries + "Unlock this match")
    // rather than a hard gate.
    router.push(`/dashboard/matches/${id}`)
  }

  // Post-date check-in: first mutually ready-to-meet match without feedback yet.
  const checkInMatch =
    !isViewerFree && !checkInDismissed
      ? matches.find(
          (m) =>
            m.readyToMeet === 'mutual' && !checkedInIds.has(m.partnership.id)
        )
      : undefined

  const above80Count = matches.filter((m) => m.score >= 80).length

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
    <div className="w-full min-h-screen bg-[#EEECEA]">
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
        {/* Post-date check-in (mutual ready-to-meet) */}
        {checkInMatch && (
          <div className="dash-card mb-6 p-6">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--haevn-muted-fg)]">
              Post-date check-in
            </p>
            <p className="font-heading text-lg text-[color:var(--haevn-navy)]">
              You and {checkInMatch.partnership.first_name} made plans to meet
            </p>
            <p className="mb-4 mt-1 text-sm text-[color:var(--haevn-muted-fg)]">
              How did it go? Your feedback helps us improve future matches.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                type="button"
                onClick={() => handleCheckIn(checkInMatch.partnership.id, 'clicked')}
                className="flex-1 border border-emerald-200 bg-emerald-50 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                We clicked
              </button>
              <button
                type="button"
                onClick={() => handleCheckIn(checkInMatch.partnership.id, 'okay')}
                className="flex-1 border border-amber-200 bg-amber-50 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100"
              >
                It was okay
              </button>
              <button
                type="button"
                onClick={() => handleCheckIn(checkInMatch.partnership.id, 'no_match')}
                className="flex-1 border border-red-200 bg-red-50 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
              >
                Not a match
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCheckInDismissed(true)}
              className="mt-3 text-xs text-[color:var(--haevn-muted-fg)] underline underline-offset-2 hover:text-[color:var(--haevn-navy)]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* System signal banner */}
        {matches.length > 0 && (
          <div className="dash-card mb-6 p-5">
            <p className="font-heading text-base font-semibold text-[color:var(--haevn-navy)]">
              {above80Count > 0 ? (
                <>
                  You currently have{' '}
                  <span className="text-[color:var(--haevn-gold)]">
                    {above80Count}{' '}
                    {above80Count === 1 ? 'match' : 'matches'} above 80% alignment
                  </span>
                </>
              ) : (
                <>
                  You have{' '}
                  <span className="text-[color:var(--haevn-gold)]">
                    {matches.length}{' '}
                    {matches.length === 1 ? 'match' : 'matches'}
                  </span>{' '}
                  curated for you
                </>
              )}
            </p>
            <p className="mt-1 text-sm text-[color:var(--haevn-muted-fg)]">
              New matches are evaluated weekly
            </p>
            <p className="mt-2 text-sm font-medium text-[color:var(--haevn-teal)]">
              Click username to view full profile.
            </p>
          </div>
        )}

        {matches.length === 0 ? (
          <EmptyMatchesState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch">
            <AnimatePresence initial={false}>
              {visibleMatches.map((match) => (
                <motion.div
                  key={match.partnership.id}
                  className="h-full min-h-0"
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
                      firstName: match.partnership.first_name,
                      age: match.partnership.age,
                      city: match.partnership.city,
                      distance: match.partnership.distance_miles,
                      gender: match.partnership.gender,
                      sexuality: match.partnership.sexuality,
                      relationshipStructure:
                        match.partnership.relationship_structure,
                      compatibilityPercentage: match.score,
                      topFactor: getTopFactor(match.breakdown),
                      intro: buildIntro(match),
                      contrast: buildContrast(match.breakdown),
                      signals: getSignals(match.breakdown),
                    }}
                    variant="match"
                    isLocked={isViewerFree}
                    readyToMeet={
                      !isViewerFree
                        ? {
                            state: match.readyToMeet,
                            otherPartnershipId: match.partnership.id,
                          }
                        : undefined
                    }
                    connectionStatus={match.connection.status}
                    handshakeId={match.connection.handshakeId}
                    matchIsFreeTier={
                      match.partnership.membership_tier === 'free'
                    }
                    hasNudgedYou={nudgedYouIds.has(match.partnership.id)}
                    onClick={handleMatchCardClick}
                    onPass={!isViewerFree ? handlePass : undefined}
                    onConnect={!isViewerFree ? handleConnect : undefined}
                    onNudge={!isViewerFree ? handleNudge : undefined}
                    onMessage={!isViewerFree ? handleMessage : undefined}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Hidden matches link */}
        {hiddenCount > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/dashboard/hidden"
              className="inline-flex items-center gap-2 text-sm text-[color:var(--haevn-muted-fg)] transition-colors hover:text-[color:var(--haevn-teal)]"
            >
              <Eye size={14} strokeWidth={1.5} />
              {hiddenCount} hidden {hiddenCount === 1 ? 'match' : 'matches'}
            </Link>
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
