import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Sparkles } from 'lucide-react'

interface MatchCardSimpleProps {
  match: {
    partnership: {
      id: string
      display_name: string | null
      short_bio: string | null
      identity: string
      city: string
      age: number
    }
    score: number
    tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze'
  }
  onClick?: () => void
}

const TIER_COLORS = {
  Platinum: 'bg-gradient-to-br from-haevn-teal-500 to-haevn-teal-700 text-white',
  Gold: 'bg-gradient-to-br from-haevn-orange-400 to-haevn-orange-600 text-white',
  Silver: 'bg-gradient-to-br from-haevn-gray-300 to-haevn-gray-500 text-white',
  Bronze: 'bg-gradient-to-br from-haevn-orange-700 to-haevn-orange-900 text-white',
}

const TIER_BADGE_COLORS = {
  Platinum: 'bg-haevn-teal-50 text-haevn-teal-800 border-haevn-teal-200',
  Gold: 'bg-haevn-orange-50 text-haevn-orange-800 border-haevn-orange-200',
  Silver: 'bg-haevn-gray-100 text-haevn-gray-700 border-haevn-gray-300',
  Bronze: 'bg-haevn-orange-100 text-haevn-orange-900 border-haevn-orange-300',
}

export function MatchCardSimple({ match, onClick }: MatchCardSimpleProps) {
  const { partnership, score, tier } = match
  const initials = partnership.display_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??'

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 overflow-hidden rounded-2xl border-2 border-haevn-gray-300 hover:border-haevn-orange-400"
      onClick={onClick}
    >
      {/* Tier indicator bar */}
      <div className={`h-2 ${TIER_COLORS[tier]}`} />

      <CardContent className="p-6">
        {/* Avatar & Name */}
        <div className="flex items-start gap-4 mb-4">
          {/* Avatar circle */}
          <div className={`w-16 h-16 rounded-full ${TIER_COLORS[tier]} flex items-center justify-center text-h4 flex-shrink-0`}>
            {initials}
          </div>

          {/* Name and identity */}
          <div className="flex-1 min-w-0">
            <h3 className="text-h4 text-haevn-gray-900 truncate">
              {partnership.display_name || 'Anonymous'}
            </h3>
            <p className="text-body-sm text-haevn-gray-600 capitalize">
              {partnership.identity} • {partnership.age}
            </p>
          </div>
        </div>

        {/* Bio */}
        {partnership.short_bio && (
          <p className="text-body-sm text-haevn-gray-700 mb-4 line-clamp-2">
            {partnership.short_bio}
          </p>
        )}

        {/* Location */}
        <div className="flex items-center gap-1 text-body-sm text-haevn-gray-600 mb-4">
          <MapPin className="h-4 w-4" />
          <span>{partnership.city}</span>
        </div>

        {/* Score and Tier */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-haevn-orange-500" />
            <span className="text-h4 text-haevn-orange-600">{score}%</span>
            <span className="text-body-sm text-haevn-gray-600">Match</span>
          </div>
          <Badge
            variant="outline"
            className={TIER_BADGE_COLORS[tier]}
          >
            {tier}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
