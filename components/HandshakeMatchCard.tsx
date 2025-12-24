import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TierBadge } from '@/components/TierBadge'
import { MapPin, Heart } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface HandshakeMatchCardProps {
  match: {
    partnership: {
      id: string
      display_name: string | null
      short_bio: string | null
      identity: string
      city: string
      age: number
      discretion_level: string
    }
    score: number
    tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze'
  }
  onSendHandshake: (matchId: string) => void
  onViewDetails: (match: any) => void
  isPending?: boolean
}

export function HandshakeMatchCard({ match, onSendHandshake, onViewDetails, isPending }: HandshakeMatchCardProps) {
  const { partnership, tier, score } = match

  // Get initials from display name
  const getInitials = (name: string | null) => {
    if (!name) return '??'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Truncate bio
  const truncateBio = (bio: string | null, maxLength: number = 100) => {
    if (!bio) return 'No bio available'
    if (bio.length <= maxLength) return bio
    return bio.substring(0, maxLength) + '...'
  }

  return (
    <Card
      className="group hover:shadow-lg transition-all duration-200 border-[#252627]/10 cursor-pointer"
      onClick={() => onViewDetails(match)}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header with Avatar and Tier */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 border-2 border-[#E29E0C]">
                <AvatarImage src={''} /> {/* Anonymized - no photo until handshake */}
                <AvatarFallback className="bg-[#E8E6E3] text-[#252627] text-lg font-bold">
                  {getInitials(partnership.display_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
                  {partnership.display_name || 'Anonymous'}
                </h3>
                <div className="flex items-center gap-1 text-sm text-[#252627]/60">
                  <MapPin className="h-3 w-3" />
                  <span>{partnership.city}</span>
                  <span className="mx-1">•</span>
                  <span>{partnership.age}</span>
                </div>
              </div>
            </div>
            <TierBadge tier={tier} />
          </div>

          {/* Bio */}
          <p className="text-sm text-[#252627]/70 line-clamp-2" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            {truncateBio(partnership.short_bio)}
          </p>

          {/* Identity Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-[#008080]/10 text-[#008080] border-[#008080]/30">
              {partnership.identity}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-[#252627]/50">
              <Heart className="h-3 w-3" />
              <span>{score}% match</span>
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={(e) => {
              e.stopPropagation()
              onSendHandshake(partnership.id)
            }}
            disabled={isPending}
            className="w-full bg-gradient-to-r from-[#E29E0C] to-[#D88A0A] hover:from-[#D88A0A] hover:to-[#C77A09] text-white"
            style={{ fontFamily: 'Roboto', fontWeight: 500 }}
          >
            {isPending ? 'Request Sent' : 'Send Connection Request'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
