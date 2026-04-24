'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getComputedMatchCards, type ComputedMatchCard } from '@/lib/actions/computedMatchCards'
import { canSendHandshake, sendHandshakeRequest } from '@/lib/actions/handshakes'
import { sendNudge } from '@/lib/actions/nudges'
import { MatchProfileView } from '@/components/MatchProfileView'
import { useToast } from '@/hooks/use-toast'

interface MatchesSectionProps {
  totalMatches?: number
  currentIndex?: number
  membershipTier?: 'free' | 'plus'
}

/** Adapt a ComputedMatchCard to the shape MatchProfileView expects */
function toProfileViewMatch(match: ComputedMatchCard) {
  return {
    partnership: {
      id: match.partnership.id,
      display_name: match.partnership.display_name,
      short_bio: match.partnership.short_bio,
      identity: match.partnership.identity,
      city: match.partnership.city,
      age: match.partnership.age,
      discretion_level: 'standard',
      photo_url: match.partnership.photo_url,
    },
    score: match.score,
    tier: match.tier,
    breakdown: { sections: match.breakdown },
  }
}

export function MatchesSection({
  membershipTier = 'free'
}: MatchesSectionProps) {
  const { toast } = useToast()
  const [matches, setMatches] = useState<ComputedMatchCard[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState<ComputedMatchCard | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [actionStates, setActionStates] = useState<Record<string, 'pending' | 'nudged'>>({})

  // Fetch matches from computed_matches table
  useEffect(() => {
    async function fetchMatches() {
      try {
        const data = await getComputedMatchCards('Bronze', 5)
        setMatches(data)
      } catch (err) {
        console.error('Failed to fetch matches:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchMatches()
  }, [])

  const handleCardClick = (match: ComputedMatchCard) => {
    setSelectedMatch(match)
    setProfileOpen(true)
  }

  const handleConnect = async (partnershipId: string) => {
    // Free users cannot send connection requests — show upgrade modal
    if (membershipTier === 'free') {
      setShowUpgradeModal(true)
      return
    }

    // Determine target's membership tier from selectedMatch
    const targetTier = selectedMatch?.partnership.membership_tier ?? 'free'

    if (targetTier === 'plus') {
      // PLUS → PLUS: send handshake
      try {
        const { canSend, reason } = await canSendHandshake(partnershipId)
        if (!canSend) {
          toast({ title: 'Cannot Connect', description: reason || 'Cannot send connection request', variant: 'destructive' })
          return
        }

        const result = await sendHandshakeRequest(partnershipId, '')
        if (result.success) {
          toast({ title: 'Request Sent', description: 'Connection request sent' })
          setActionStates(prev => ({ ...prev, [partnershipId]: 'pending' }))
          setProfileOpen(false)
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to send request', variant: 'destructive' })
        }
      } catch (err) {
        console.error('Error sending handshake:', err)
        toast({ title: 'Error', description: 'Failed to send connection request', variant: 'destructive' })
      }
    } else {
      // PLUS → FREE: send nudge
      try {
        const result = await sendNudge(partnershipId)
        if (result.success) {
          toast({ title: 'Nudge Sent', description: 'They\'ll be notified of your interest' })
          setActionStates(prev => ({ ...prev, [partnershipId]: 'nudged' }))
          setProfileOpen(false)
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to send nudge', variant: 'destructive' })
        }
      } catch (err) {
        console.error('Error sending nudge:', err)
        toast({ title: 'Error', description: 'Failed to send nudge', variant: 'destructive' })
      }
    }
  }

  const handlePass = () => {
    setProfileOpen(false)
  }

  // Get initials from name
  const getInitials = (name: string | null) => {
    if (!name) return '??'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <section className="space-y-3">
      {/* Section Header */}
      <div className="flex items-baseline justify-between px-1">
        <div>
          <p className="text-[10px] tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
            Match Monday
          </p>
          <h3 className="font-heading text-lg text-[color:var(--haevn-navy)] mt-0.5">
            {loading || matches.length === 0
              ? 'Your matches'
              : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`}
          </h3>
        </div>
        <Link
          href="/dashboard/matches"
          className="text-sm text-[color:var(--haevn-muted-fg)] hover:text-[color:var(--haevn-teal)] transition-colors"
        >
          View all →
        </Link>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="relative">
        <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <div className="flex gap-3" style={{ minWidth: 'min-content' }}>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-36 h-44 bg-white border border-[color:var(--haevn-border)] animate-pulse"
                />
              ))
            ) : matches.length > 0 ? (
              matches.map((match) => {
                const actionState = actionStates[match.partnership.id]
                return (
                  <button
                    key={match.partnership.id}
                    onClick={() => handleCardClick(match)}
                    className="flex-shrink-0 w-36 h-44 bg-white border border-[color:var(--haevn-border)] flex flex-col items-center justify-center gap-2 hover:border-[color:var(--haevn-teal)]/40 transition-colors cursor-pointer relative px-3"
                  >
                    {actionState && (
                      <span
                        className={`absolute top-2 right-2 text-[10px] tracking-[0.12em] uppercase px-1.5 py-0.5 ${
                          actionState === 'pending'
                            ? 'bg-[rgba(226,158,12,0.1)] text-[color:var(--haevn-gold)]'
                            : 'bg-[rgba(0,128,128,0.1)] text-[color:var(--haevn-teal)]'
                        }`}
                      >
                        {actionState === 'pending' ? 'Pending' : 'Nudged'}
                      </span>
                    )}
                    <div className="w-14 h-14 keep-rounded bg-[color:var(--haevn-navy)] flex items-center justify-center text-white text-lg font-medium">
                      {getInitials(match.partnership.display_name)}
                    </div>
                    <span className="text-xs font-medium text-[color:var(--haevn-navy)] text-center px-1 truncate w-full">
                      {match.partnership.display_name || 'Anonymous'}
                    </span>
                    <span className="font-heading text-sm text-[color:var(--haevn-gold)] tabular-nums">
                      {match.score}% match
                    </span>
                  </button>
                )
              })
            ) : (
              <div className="w-full py-8 text-center">
                <p className="text-sm text-[color:var(--haevn-charcoal)]">
                  No matches yet
                </p>
                <p className="text-xs text-[color:var(--haevn-muted-fg)] mt-1">
                  New matches release every Monday at 8 AM ET
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Match Profile View - Full Screen */}
      <MatchProfileView
        match={selectedMatch ? toProfileViewMatch(selectedMatch) : null}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onConnect={handleConnect}
        onPass={handlePass}
        targetMembershipTier={selectedMatch?.partnership.membership_tier}
      />

      {/* Upgrade Modal for Free Users */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 mx-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Upgrade to Connect
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Sending connection requests is a premium feature. Upgrade your membership to start connecting with your matches.
            </p>
            <button
              className="w-full h-11 bg-[#1B9A9A] hover:bg-[#178787] text-white font-semibold rounded-full mb-3 transition-colors"
              onClick={() => setShowUpgradeModal(false)}
            >
              Upgrade Now
            </button>
            <button
              className="w-full h-11 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
              onClick={() => setShowUpgradeModal(false)}
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
