'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { getMatches, MatchResult } from '@/lib/actions/matching'
import { canSendHandshake, sendHandshakeRequest } from '@/lib/actions/handshakes'
import { MatchProfileView } from '@/components/MatchProfileView'
import { HAEVNHeader } from '@/components/dashboard/HAEVNHeader'
import FullPageLoader from '@/components/ui/full-page-loader'

export default function MatchesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    async function loadMatches() {
      if (!user || authLoading) return

      try {
        setLoading(true)
        const matchData = await getMatches('Bronze')
        setMatches(matchData)
        console.log('[Matches] Loaded', matchData.length, 'matches')
      } catch (err: any) {
        console.error('[Matches] Error:', err)
        setError(err.message || 'Failed to load matches')
      } finally {
        setLoading(false)
      }
    }

    loadMatches()
  }, [user, authLoading])

  const handleCardClick = (match: MatchResult) => {
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

  if (authLoading || loading) {
    return <FullPageLoader />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <HAEVNHeader />
        <main className="max-w-md mx-auto px-4 py-4">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
            <h2
              className="text-xl font-bold text-haevn-navy mb-2"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              Error Loading Matches
            </h2>
            <p
              className="text-gray-600 mb-4"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}
            >
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-haevn-teal text-white rounded-full font-medium hover:opacity-90 transition-opacity"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HAEVNHeader />

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1
              className="text-xl font-bold text-haevn-navy"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              Your Matches
            </h1>
            <p
              className="text-sm text-gray-500"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}
            >
              {matches.length} compatible {matches.length === 1 ? 'partnership' : 'partnerships'}
            </p>
          </div>
        </div>

        {/* Matches Grid */}
        {matches.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
            <h3
              className="text-lg font-bold text-haevn-navy mb-2"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              No matches yet
            </h3>
            <p
              className="text-gray-600 mb-4"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}
            >
              Complete your survey to find compatible connections.
            </p>
            <button
              onClick={() => router.push('/onboarding/survey')}
              className="px-6 py-2 bg-haevn-teal text-white rounded-full font-medium hover:opacity-90 transition-opacity"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              Complete Survey
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {matches.map((match) => (
              <button
                key={match.partnership.id}
                onClick={() => handleCardClick(match)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-3 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer"
              >
                {/* Avatar with initials */}
                <div className="w-16 h-16 rounded-full bg-haevn-navy flex items-center justify-center text-white text-xl font-bold">
                  {getInitials(match.partnership.display_name)}
                </div>

                {/* Name */}
                <span
                  className="text-sm font-medium text-haevn-navy text-center truncate w-full"
                  style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
                >
                  {match.partnership.display_name || 'Anonymous'}
                </span>

                {/* City */}
                <span
                  className="text-xs text-gray-500"
                  style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}
                >
                  {match.partnership.city || 'Unknown'}
                </span>

                {/* Match percentage */}
                <span
                  className="text-lg font-bold text-haevn-teal"
                  style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
                >
                  {match.score}%
                  <span className="text-xs font-normal text-gray-500 ml-1">match</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Match Profile View - Full Screen Modal */}
      <MatchProfileView
        match={selectedMatch}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onConnect={handleConnect}
        onPass={handlePass}
      />
    </div>
  )
}
