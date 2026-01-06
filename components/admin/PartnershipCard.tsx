'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PartnershipData } from './MatchingControlCenter'

interface PartnershipCardProps {
  partnership: PartnershipData
}

export function PartnershipCard({ partnership }: PartnershipCardProps) {
  const getTierBadgeColor = (tier: string | null) => {
    switch (tier?.toLowerCase()) {
      case 'plus':
      case 'pro':
        return 'bg-green-100 text-green-800'
      case 'select':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const getStateBadgeColor = (state: string | null) => {
    switch (state?.toLowerCase()) {
      case 'live':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <Card className="border-purple-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-purple-900">Partnership Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Display Name */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Display Name</p>
          <p className="text-lg font-semibold text-gray-900">
            {partnership.display_name || '(No name set)'}
          </p>
        </div>

        {/* Badges Row */}
        <div className="flex flex-wrap gap-2">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTierBadgeColor(partnership.membership_tier)}`}>
            {partnership.membership_tier || 'free'}
          </span>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStateBadgeColor(partnership.profile_state)}`}>
            {partnership.profile_state || 'draft'}
          </span>
          {partnership.profile_type && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
              {partnership.profile_type}
            </span>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">City</p>
            <p className="text-sm text-gray-900">{partnership.city || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Age</p>
            <p className="text-sm text-gray-900">{partnership.age || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Survey</p>
            <p className="text-sm text-gray-900">{partnership.survey_completion}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Structure</p>
            <p className="text-sm text-gray-900">
              {partnership.structure?.type || '—'}
            </p>
          </div>
        </div>

        {/* Email & ID */}
        <div className="pt-2 border-t space-y-2">
          {partnership.user_email && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Owner Email</p>
              <p className="text-sm text-gray-700 font-mono">{partnership.user_email}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Partnership ID</p>
            <p className="text-xs text-gray-500 font-mono break-all">{partnership.id}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
