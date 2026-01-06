'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Code } from 'lucide-react'
import type { ComputedMatchData } from './MatchingControlCenter'

interface MatchBreakdownProps {
  match: ComputedMatchData
  lookupPartnershipId: string
}

// Category info for display
const CATEGORY_INFO: Record<string, { label: string; weight: number; color: string }> = {
  intent: { label: 'Intent & Goals', weight: 30, color: 'bg-blue-500' },
  structure: { label: 'Structure Fit', weight: 25, color: 'bg-purple-500' },
  connection: { label: 'Connection Style', weight: 20, color: 'bg-pink-500' },
  chemistry: { label: 'Sexual Chemistry', weight: 15, color: 'bg-red-500' },
  lifestyle: { label: 'Lifestyle Fit', weight: 10, color: 'bg-green-500' },
}

export function MatchBreakdown({ match, lookupPartnershipId }: MatchBreakdownProps) {
  const [showRawJson, setShowRawJson] = useState(false)

  // Parse breakdown - it might be stored as JSON string or object
  let breakdown: any = null
  try {
    breakdown = typeof match.breakdown === 'string'
      ? JSON.parse(match.breakdown)
      : match.breakdown
  } catch {
    breakdown = null
  }

  // Extract categories from breakdown
  const categories = breakdown?.categories || []

  return (
    <div className="space-y-4">
      {/* Overall Score Summary */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div>
          <p className="text-sm text-gray-500">Overall Compatibility</p>
          <p className="text-2xl font-bold text-gray-900">{match.score}%</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Computed</p>
          <p className="text-sm text-gray-700">
            {new Date(match.computed_at).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Category Breakdown */}
      {categories.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Category Breakdown</p>
          {categories.map((cat: any) => {
            const info = CATEGORY_INFO[cat.category] || {
              label: cat.category,
              weight: cat.weight || 0,
              color: 'bg-gray-500',
            }
            const score = Math.round(cat.score || 0)
            const isIncluded = cat.included !== false

            return (
              <div key={cat.category} className={`${!isIncluded ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{info.label}</span>
                  <span className="text-sm font-medium">
                    {score}%
                    <span className="text-gray-400 text-xs ml-1">
                      ({Math.round(info.weight)}% weight)
                    </span>
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${info.color} transition-all`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                {!isIncluded && (
                  <p className="text-xs text-gray-400 mt-1">Not included in calculation</p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="py-4 text-center text-gray-500 text-sm">
          No category breakdown available
        </div>
      )}

      {/* Constraints Info */}
      {breakdown?.constraints && (
        <div className="pt-3 border-t">
          <p className="text-sm font-medium text-gray-700 mb-2">Constraints</p>
          <div className="flex flex-wrap gap-2">
            <span
              className={`px-2 py-1 text-xs rounded-full ${
                breakdown.constraints.passed
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {breakdown.constraints.passed ? 'All Passed' : 'Failed'}
            </span>
            {breakdown.constraints.reason && (
              <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                {breakdown.constraints.reason}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Social State Details */}
      <div className="pt-3 border-t">
        <p className="text-sm font-medium text-gray-700 mb-2">Social State Details</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500">Status</p>
            <p className="font-medium capitalize">{match.social_state.status.replace('_', ' ')}</p>
          </div>
          {match.social_state.handshake_id && (
            <div>
              <p className="text-gray-500">Handshake ID</p>
              <p className="font-mono text-xs">{match.social_state.handshake_id.slice(0, 12)}...</p>
            </div>
          )}
          {match.social_state.nudge_id && (
            <div>
              <p className="text-gray-500">Nudge ID</p>
              <p className="font-mono text-xs">{match.social_state.nudge_id.slice(0, 12)}...</p>
            </div>
          )}
          <div>
            <p className="text-gray-500">Other Tier</p>
            <p className="font-medium">{match.other_membership_tier || 'free'}</p>
          </div>
        </div>
      </div>

      {/* Partnership IDs */}
      <div className="pt-3 border-t">
        <p className="text-sm font-medium text-gray-700 mb-2">Partnership IDs</p>
        <div className="space-y-1 text-xs font-mono text-gray-500">
          <p>Lookup: {lookupPartnershipId}</p>
          <p>Match: {match.other_partnership_id}</p>
        </div>
      </div>

      {/* Raw JSON Toggle */}
      <div className="pt-3 border-t">
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          {showRawJson ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Code className="h-4 w-4" />
          Raw JSON
        </button>
        {showRawJson && (
          <pre className="mt-2 p-3 bg-gray-900 text-gray-100 text-xs rounded-lg overflow-x-auto max-h-64">
            {JSON.stringify(breakdown, null, 2) || 'No breakdown data'}
          </pre>
        )}
      </div>
    </div>
  )
}
