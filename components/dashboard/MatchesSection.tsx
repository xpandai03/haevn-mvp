'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getComputedMatchCards, type ComputedMatchCard } from '@/lib/actions/computedMatchCards'
import { canSendHandshake, sendHandshakeRequest } from '@/lib/actions/handshakes'
import { MatchProfileView } from '@/components/MatchProfileView'

interface MatchesSectionProps {
  totalMatches: number
  currentIndex?: number
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
  totalMatches,
  currentIndex = 1
}: MatchesSectionProps) {
  const [matches, setMatches] = useState<ComputedMatchCard[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState<ComputedMatchCard | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)

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
    try {
      const { canSend, reason } = await canSendHandshake(partnershipId)
      if (!canSend) {
        alert(reason || 'Cannot send connection request')
        return
      }

      const result = await sendHandshakeRequest(partnershipId, '')
      if (result.success) {
        alert('Connection request sent!')
        setProfileOpen(false)
      } else {
        alert(result.error || 'Failed to send request')
      }
    } catch (err) {
      console.error('Error sending handshake:', err)
      alert('Failed to send connection request')
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

  const displayCount = matches.length > 0 ? matches.length : totalMatches

  return (
    <section className="space-y-2">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium text-gray-900">
          Matches ({currentIndex} of {displayCount})
        </h3>
        <Link
          href="/matches"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          View All
        </Link>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="relative">
        <div className="overflow-x-auto pb-2 -mx-4 px-4">
          <div className="flex gap-3" style={{ minWidth: 'min-content' }}>
            {loading ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-32 h-40 bg-white rounded-xl border border-gray-100 shadow-sm animate-pulse"
                />
              ))
            ) : matches.length > 0 ? (
              // Real match cards
              matches.map((match) => (
                <button
                  key={match.partnership.id}
                  onClick={() => handleCardClick(match)}
                  className="flex-shrink-0 w-32 h-40 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer"
                >
                  {/* Avatar with initials */}
                  <div className="w-14 h-14 rounded-full bg-[#0F2A4A] flex items-center justify-center text-white text-lg font-bold">
                    {getInitials(match.partnership.display_name)}
                  </div>
                  {/* Name */}
                  <span className="text-xs font-medium text-gray-700 text-center px-2 truncate w-full">
                    {match.partnership.display_name || 'Anonymous'}
                  </span>
                  {/* Match percentage */}
                  <span className="text-xs text-[#1B9A9A] font-semibold">
                    {match.score}% match
                  </span>
                </button>
              ))
            ) : totalMatches > 0 ? (
              // Placeholder cards if no real matches loaded yet
              Array.from({ length: Math.min(totalMatches, 5) }).map((_, i) => (
                <Link
                  key={i}
                  href="/matches"
                  className="flex-shrink-0 w-32 h-40 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center hover:shadow-md hover:border-gray-200 transition-all cursor-pointer"
                >
                  <span className="text-xs text-gray-400">Match {i + 1}</span>
                </Link>
              ))
            ) : (
              // Empty state
              <div className="w-full py-8 text-center">
                <p className="text-sm text-gray-400">No matches yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Scroll indicator dots */}
        {displayCount > 0 && (
          <div className="flex justify-center gap-1 mt-2">
            {Array.from({ length: Math.min(displayCount, 5) }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i === 0 ? 'bg-gray-400' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Match Profile View - Full Screen */}
      <MatchProfileView
        match={selectedMatch ? toProfileViewMatch(selectedMatch) : null}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onConnect={handleConnect}
        onPass={handlePass}
      />
    </section>
  )
}
