'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import type { ComputedMatchData } from './MatchingControlCenter'
import { MatchBreakdown } from './MatchBreakdown'

interface MatchesListProps {
  matches: ComputedMatchData[]
  lookupPartnershipId: string
}

export function MatchesList({ matches, lookupPartnershipId }: MatchesListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (matches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No computed matches found for this partnership.</p>
        <p className="text-sm mt-1">This could mean the matching engine hasn't run yet.</p>
      </div>
    )
  }

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'platinum':
        return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'gold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'silver':
        return 'bg-gray-200 text-gray-800 border-gray-400'
      case 'bronze':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300'
    }
  }

  const getSocialStateBadge = (state: ComputedMatchData['social_state']) => {
    switch (state.status) {
      case 'connected':
        return { color: 'bg-green-100 text-green-800', label: 'Connected' }
      case 'pending':
        return { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' }
      case 'nudge_sent':
        return { color: 'bg-orange-100 text-orange-800', label: 'Nudge Sent' }
      case 'nudge_received':
        return { color: 'bg-orange-100 text-orange-800', label: 'Nudge Received' }
      case 'free_blocked':
        return { color: 'bg-gray-100 text-gray-600', label: 'Free User' }
      default:
        return { color: 'bg-gray-50 text-gray-500', label: 'No Contact' }
    }
  }

  return (
    <div className="space-y-2">
      {/* Header Row */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b">
        <div className="col-span-1"></div>
        <div className="col-span-4">Partnership</div>
        <div className="col-span-2 text-center">Score</div>
        <div className="col-span-2 text-center">Tier</div>
        <div className="col-span-3 text-center">Social State</div>
      </div>

      {/* Match Rows */}
      {matches.map((match) => {
        const isExpanded = expandedId === match.id
        const socialBadge = getSocialStateBadge(match.social_state)

        return (
          <div key={match.id} className="border rounded-lg overflow-hidden">
            {/* Summary Row */}
            <div
              className="grid grid-cols-12 gap-2 px-3 py-3 items-center cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : match.id)}
            >
              {/* Expand Icon */}
              <div className="col-span-1">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </div>

              {/* Partnership Name */}
              <div className="col-span-4">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {match.other_display_name || '(No name)'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {match.other_partnership_id.slice(0, 8)}...
                </p>
              </div>

              {/* Score */}
              <div className="col-span-2 text-center">
                <span className="text-lg font-bold text-gray-900">{match.score}</span>
              </div>

              {/* Tier */}
              <div className="col-span-2 text-center">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getTierColor(match.tier)}`}>
                  {match.tier}
                </span>
              </div>

              {/* Social State */}
              <div className="col-span-3 text-center">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${socialBadge.color}`}>
                  {socialBadge.label}
                </span>
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="border-t bg-gray-50 p-4">
                <MatchBreakdown
                  match={match}
                  lookupPartnershipId={lookupPartnershipId}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
