'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { User, MapPin, MessageCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export type ProfileCardVariant = 'match' | 'connection' | 'nudge'

export interface ProfileCardData {
  id: string
  photo?: string
  username: string
  city?: string
  distance?: number
  compatibilityPercentage: number
  topFactor: string
}

export interface ProfileCardProps {
  profile: ProfileCardData
  variant: ProfileCardVariant
  onClick: (id: string) => void
  // Variant-specific props
  latestMessage?: string // For connections
  unreadCount?: number // For connections
  nudgedAt?: Date // For nudges
}

/**
 * ProfileCard - Reusable card component for Matches, Connections, and Nudges
 * Matches Phase 3 spec section 5: Card Design
 */
export function ProfileCard({
  profile,
  variant,
  onClick,
  latestMessage,
  unreadCount,
  nudgedAt
}: ProfileCardProps) {
  // Calculate nudge age text
  const getNudgeAgeText = (date: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${Math.floor(diffHours)} hours ago`
    if (diffDays <= 7) return `${Math.floor(diffDays)} days ago`
    return 'A week ago'
  }

  return (
    <Card
      onClick={() => onClick(profile.id)}
      className="flex-shrink-0 w-[85vw] sm:w-[320px] cursor-pointer rounded-2xl bg-white border border-haevn-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-5"
    >
      {/* Top Section: Photo and Basic Info */}
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar */}
        <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-haevn-teal flex-shrink-0">
          {profile.photo ? (
            <AvatarImage src={profile.photo} alt={profile.username} />
          ) : (
            <AvatarFallback className="bg-haevn-teal/10">
              <User className="h-8 w-8 sm:h-10 sm:w-10 text-haevn-teal" />
            </AvatarFallback>
          )}
        </Avatar>

        {/* Name and Location */}
        <div className="flex-1 min-w-0">
          <h3
            className="text-lg sm:text-xl font-bold text-haevn-navy truncate mb-1"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700,
              lineHeight: '110%'
            }}
          >
            {profile.username}
          </h3>

          {/* Location */}
          {(profile.city || profile.distance !== undefined) && (
            <div className="flex items-center gap-1 text-haevn-charcoal">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span
                className="text-sm truncate"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300
                }}
              >
                {profile.distance !== undefined
                  ? `${profile.distance} mi away`
                  : profile.city}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Compatibility Section */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-2">
          <div
            className="text-4xl sm:text-5xl font-bold text-haevn-teal"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700
            }}
          >
            {profile.compatibilityPercentage}%
          </div>
          <span
            className="text-sm text-haevn-charcoal"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300
            }}
          >
            match
          </span>
        </div>

        {/* Top Factor */}
        <p
          className="text-sm text-haevn-charcoal leading-relaxed"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 400,
            lineHeight: '120%'
          }}
        >
          {profile.topFactor}
        </p>
      </div>

      {/* Variant-Specific Bottom Section */}
      {variant === 'connection' && latestMessage && (
        <div className="mt-4 pt-4 border-t border-haevn-gray-200">
          <div className="flex items-start gap-2">
            <MessageCircle className="h-4 w-4 text-haevn-charcoal flex-shrink-0 mt-0.5" />
            <p
              className="text-sm text-haevn-charcoal line-clamp-2 flex-1"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 300
              }}
            >
              {latestMessage}
            </p>
            {unreadCount && unreadCount > 0 && (
              <Badge
                variant="default"
                className="bg-haevn-orange text-white flex-shrink-0"
              >
                {unreadCount}
              </Badge>
            )}
          </div>
        </div>
      )}

      {variant === 'nudge' && nudgedAt && (
        <div className="mt-4 pt-4 border-t border-haevn-gray-200">
          <p
            className="text-sm text-haevn-charcoal"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 400
            }}
          >
            Nudged {getNudgeAgeText(nudgedAt)}
          </p>
          <p
            className="text-xs text-haevn-charcoal/60 mt-1"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300
            }}
          >
            Reply → Upgrade to respond
          </p>
        </div>
      )}

      {variant === 'match' && (
        // No extra content for basic match cards
        <></>
      )}
    </Card>
  )
}
