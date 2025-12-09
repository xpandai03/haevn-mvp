'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { getMatches, MatchResult } from '@/lib/actions/matching'
import { canSendHandshake } from '@/lib/actions/handshakes'
import { HandshakeMatchCard } from '@/components/HandshakeMatchCard'
import { SendHandshakeModal } from '@/components/SendHandshakeModal'
import { MatchProfileView } from '@/components/MatchProfileView'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, Filter } from 'lucide-react'
import { HaevnLogo } from '@/components/HaevnLogo'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function MatchesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [filteredMatches, setFilteredMatches] = useState<MatchResult[]>([])
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [minTier, setMinTier] = useState<'Platinum' | 'Gold' | 'Silver' | 'Bronze'>('Bronze')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingHandshakes, setPendingHandshakes] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    async function loadMatches() {
      if (!user) return

      try {
        setLoading(true)
        const matchData = await getMatches(minTier)
        setMatches(matchData)
        setFilteredMatches(matchData)
      } catch (err: any) {
        console.error('Error loading matches:', err)
        setError(err.message || 'Failed to load matches')
      } finally {
        setLoading(false)
      }
    }

    loadMatches()
  }, [user, minTier])

  const handleSendHandshake = async (matchId: string) => {
    // Check if can send
    const { canSend, reason } = await canSendHandshake(matchId)

    if (!canSend) {
      alert(reason || 'Cannot send handshake')
      return
    }

    // Find match to get score
    const match = matches.find(m => m.partnership.id === matchId)

    // Open modal
    setSelectedMatch(match || null)
    setModalOpen(true)
  }

  const handleHandshakeSuccess = () => {
    // Add to pending set
    if (selectedMatch) {
      setPendingHandshakes(prev => new Set(prev).add(selectedMatch.partnership.id))
    }
  }

  const handleViewDetails = (match: MatchResult) => {
    setSelectedMatch(match)
    setDetailsOpen(true)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#008080]" />
          <p className="text-[#252627]/60" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            Finding your matches...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 border-2 border-[#252627]/10">
          <h2 className="text-h2 text-red-600 mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
            Error Loading Matches
          </h2>
          <p className="text-body text-[#252627]/70 mb-4" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            {error}
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="w-full bg-gradient-to-r from-[#E29E0C] to-[#D88A0A]"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#E8E6E3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="text-[#252627] hover:text-[#008080]"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </Button>
            <HaevnLogo size="sm" />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-h1 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
                Your Matches
              </h1>
              <p className="text-body text-[#252627]/70" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                {filteredMatches.length} compatible {filteredMatches.length === 1 ? 'partnership' : 'partnerships'} found
              </p>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#252627]/60" />
              <Select value={minTier} onValueChange={(value: any) => setMinTier(value)}>
                <SelectTrigger className="w-full sm:w-[180px] border-[#252627]/20">
                  <SelectValue placeholder="Minimum tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bronze">Bronze & up</SelectItem>
                  <SelectItem value="Silver">Silver & up</SelectItem>
                  <SelectItem value="Gold">Gold & up</SelectItem>
                  <SelectItem value="Platinum">Platinum only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Matches Grid */}
        {filteredMatches.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl p-12 border-2 border-dashed border-[#252627]/20">
              <h3 className="text-h3 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
                No matches found
              </h3>
              <p className="text-body text-[#252627]/60" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                Try adjusting your filter or check back later for new matches.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMatches.map((match) => (
              <HandshakeMatchCard
                key={match.partnership.id}
                match={match}
                onSendHandshake={handleSendHandshake}
                onViewDetails={handleViewDetails}
                isPending={pendingHandshakes.has(match.partnership.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Send Handshake Modal */}
      {selectedMatch && (
        <SendHandshakeModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          match={selectedMatch}
          onSuccess={handleHandshakeSuccess}
        />
      )}

      {/* Full-Screen Match Profile View */}
      <MatchProfileView
        match={selectedMatch}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onConnect={(partnershipId) => {
          setDetailsOpen(false)
          handleSendHandshake(partnershipId)
        }}
        onPass={() => {
          setDetailsOpen(false)
        }}
      />
    </div>
  )
}
