/**
 * Connection Card Component
 *
 * Displays a connection in the connections list grid.
 * Shows photo, name, compatibility score, tier, city, and connection date.
 */

'use client'

import { formatDistanceToNow } from 'date-fns'
import { MapPin, Calendar } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { ConnectionResult } from '@/lib/connections/getConnections'
import type { CompatibilityTier } from '@/lib/matching'

// Tier badge colors
const TIER_COLORS: Record<CompatibilityTier, string> = {
  Platinum: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white',
  Gold: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white',
  Silver: 'bg-gradient-to-r from-gray-400 to-gray-500 text-white',
  Bronze: 'bg-gradient-to-r from-amber-700 to-orange-700 text-white',
}

// Profile type labels
const PROFILE_TYPE_LABELS: Record<string, string> = {
  solo: 'Solo',
  couple: 'Couple',
  pod: 'Pod',
}

// Category labels for top match display
const CATEGORY_LABELS: Record<string, string> = {
  intent: 'Intent & Goals',
  structure: 'Structure Fit',
  connection: 'Connection Style',
  chemistry: 'Sexual Chemistry',
  lifestyle: 'Lifestyle Fit',
}

interface ConnectionCardProps {
  connection: ConnectionResult
  onClick: () => void
}

export function ConnectionCard({ connection, onClick }: ConnectionCardProps) {
  const { partnership, compatibility, matchedAt } = connection

  // Generate initials for avatar fallback
  const initials = partnership.display_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??'

  // Get top scoring category
  const getTopCategory = (): string => {
    const categories = compatibility.categories.filter(c => c.included)
    if (categories.length === 0) return 'Compatible'

    const top = categories.reduce((best, cat) =>
      cat.score > best.score ? cat : best
    )
    return CATEGORY_LABELS[top.category] || 'Compatible'
  }

  // Format the connection date
  const connectedAgo = formatDistanceToNow(new Date(matchedAt), { addSuffix: true })

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-[#252627]/10 p-5 cursor-pointer hover:shadow-lg hover:border-haevn-teal/30 transition-all duration-200"
    >
      {/* Header: Avatar + Name */}
      <div className="flex items-start gap-4 mb-4">
        <Avatar className="h-16 w-16 border-2 border-haevn-teal flex-shrink-0">
          {partnership.photo_url ? (
            <AvatarImage
              src={partnership.photo_url}
              alt={partnership.display_name || 'Connection'}
            />
          ) : (
            <AvatarFallback className="bg-haevn-navy text-white text-lg font-bold">
              {initials}
            </AvatarFallback>
          )}
        </Avatar>

        <div className="flex-1 min-w-0">
          <h3
            className="text-lg font-bold text-[#252627] truncate mb-1"
            style={{ fontFamily: 'Roboto' }}
          >
            {partnership.display_name || 'Anonymous'}
          </h3>
          <div className="flex items-center gap-2 text-[#252627]/60 text-sm">
            <span className="text-haevn-teal font-medium">
              {PROFILE_TYPE_LABELS[partnership.profile_type] || 'Solo'}
            </span>
            {partnership.age > 0 && (
              <>
                <span>•</span>
                <span>{partnership.age}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Compatibility Score */}
      <div className="mb-3">
        <div className="flex items-baseline gap-2 mb-1">
          <span
            className="text-4xl font-bold text-haevn-teal"
            style={{ fontFamily: 'Roboto' }}
          >
            {compatibility.overallScore}%
          </span>
          <span className="text-sm text-[#252627]/60">match</span>
        </div>
        <Badge className={`${TIER_COLORS[compatibility.tier]} text-xs px-2 py-0.5`}>
          {compatibility.tier}
        </Badge>
      </div>

      {/* Top Factor */}
      <p
        className="text-sm text-[#252627]/70 mb-3"
        style={{ fontFamily: 'Roboto', fontWeight: 400 }}
      >
        Top match: <span className="font-medium">{getTopCategory()}</span>
      </p>

      {/* Location & Date */}
      <div className="flex items-center justify-between text-xs text-[#252627]/50">
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          <span>{partnership.city || 'Unknown'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Connected {connectedAgo}</span>
        </div>
      </div>
    </div>
  )
}
