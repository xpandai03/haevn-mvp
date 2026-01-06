'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PartnershipLookup } from './PartnershipLookup'
import { PartnershipCard } from './PartnershipCard'
import { MatchesList } from './MatchesList'

interface MatchingControlCenterProps {
  userEmail: string
}

export interface PartnershipData {
  id: string
  display_name: string | null
  profile_state: string | null
  membership_tier: string | null
  profile_type: string | null
  city: string | null
  age: number | null
  structure: any
  survey_completion: number
  user_email: string | null
}

export interface ComputedMatchData {
  id: string
  other_partnership_id: string
  other_display_name: string | null
  other_membership_tier: string | null
  score: number
  tier: string
  breakdown: any
  computed_at: string
  social_state: {
    status: 'not_contacted' | 'nudge_sent' | 'nudge_received' | 'pending' | 'connected' | 'free_blocked'
    handshake_id?: string
    nudge_id?: string
  }
}

export function MatchingControlCenter({ userEmail }: MatchingControlCenterProps) {
  const [selectedPartnership, setSelectedPartnership] = useState<PartnershipData | null>(null)
  const [matches, setMatches] = useState<ComputedMatchData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePartnershipSelect = (partnership: PartnershipData, computedMatches: ComputedMatchData[]) => {
    setSelectedPartnership(partnership)
    setMatches(computedMatches)
    setError(null)
  }

  const handleError = (message: string) => {
    setError(message)
    setSelectedPartnership(null)
    setMatches([])
  }

  const handleClear = () => {
    setSelectedPartnership(null)
    setMatches([])
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Lookup Panel */}
      <Card className="border-purple-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-purple-900">Partnership Lookup</CardTitle>
        </CardHeader>
        <CardContent>
          <PartnershipLookup
            onSelect={handlePartnershipSelect}
            onError={handleError}
            onClear={handleClear}
            loading={loading}
            setLoading={setLoading}
          />
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Results Area */}
      {selectedPartnership && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Partnership Info - Left Column */}
          <div className="lg:col-span-1">
            <PartnershipCard partnership={selectedPartnership} />
          </div>

          {/* Matches List - Right Column */}
          <div className="lg:col-span-2">
            <Card className="border-purple-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-purple-900">
                    Computed Matches ({matches.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <MatchesList
                  matches={matches}
                  lookupPartnershipId={selectedPartnership.id}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedPartnership && !error && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">Enter an email or partnership ID to begin</p>
          <p className="text-sm">This tool shows system-generated matches and their social state</p>
        </div>
      )}
    </div>
  )
}
