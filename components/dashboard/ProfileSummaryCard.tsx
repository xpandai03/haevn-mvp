'use client'

import { User } from '@supabase/supabase-js'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { User as UserIcon, Heart, MessageCircle, Users, Eye } from 'lucide-react'
import Link from 'next/link'

export interface ProfileSummaryStats {
  matchesCount: number
  newMessagesCount: number
  connectionsCount: number
  profileViews: number
}

export interface ProfileSummaryCardProps {
  user: User
  stats: ProfileSummaryStats
  membershipTier: 'free' | 'plus'
  profilePhotoUrl?: string
}

/**
 * Profile Summary Card - Top dashboard card showing user info and stats
 * Matches Phase 3 spec section 3: Profile Summary Card
 */
export function ProfileSummaryCard({
  user,
  stats,
  membershipTier,
  profilePhotoUrl
}: ProfileSummaryCardProps) {
  const username = user.user_metadata?.full_name || 'User'
  const firstName = username.split(' ')[0]

  // Stats configuration for grid display
  const statItems = [
    {
      label: 'Matches',
      value: stats.matchesCount,
      icon: Heart,
      href: '/dashboard/matches',
      color: 'text-haevn-teal'
    },
    {
      label: 'Messages',
      value: stats.newMessagesCount,
      icon: MessageCircle,
      href: '/messages',
      color: 'text-haevn-orange',
      badge: stats.newMessagesCount > 0 ? 'New' : null
    },
    {
      label: 'Connections',
      value: stats.connectionsCount,
      icon: Users,
      href: '/dashboard/connections',
      color: 'text-haevn-navy'
    },
    {
      label: 'Profile Views',
      value: stats.profileViews,
      icon: Eye,
      href: null, // Not clickable
      color: 'text-haevn-gray-600'
    }
  ]

  return (
    <Card className="w-full bg-white rounded-3xl shadow-sm border border-haevn-gray-200 p-6 sm:p-8">
      {/* Top Section: Avatar, Name, Badge */}
      <div className="flex items-start gap-4 mb-6">
        {/* Avatar */}
        <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-haevn-teal">
          {profilePhotoUrl ? (
            <AvatarImage src={profilePhotoUrl} alt={username} />
          ) : (
            <AvatarFallback className="bg-haevn-teal/10">
              <UserIcon className="h-8 w-8 sm:h-10 sm:w-10 text-haevn-teal" />
            </AvatarFallback>
          )}
        </Avatar>

        {/* Name and Badge */}
        <div className="flex-1 min-w-0">
          <h2
            className="text-2xl sm:text-3xl font-bold text-haevn-navy truncate"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700,
              lineHeight: '110%',
              letterSpacing: '-0.015em'
            }}
          >
            {firstName}
          </h2>
          <Badge
            variant={membershipTier === 'plus' ? 'default' : 'secondary'}
            className={`mt-2 ${
              membershipTier === 'plus'
                ? 'bg-haevn-orange text-white'
                : 'bg-haevn-gray-200 text-haevn-charcoal'
            }`}
          >
            {membershipTier === 'plus' ? 'HAEVN+' : 'FREE'}
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statItems.map((stat, index) => {
          const StatWrapper = stat.href
            ? ({ children }: { children: React.ReactNode }) => (
                <Link
                  href={stat.href!}
                  className="block transition-all hover:scale-105 active:scale-95"
                >
                  {children}
                </Link>
              )
            : ({ children }: { children: React.ReactNode }) => <div>{children}</div>

          return (
            <StatWrapper key={stat.label}>
              <div className="flex flex-col items-center text-center p-3 rounded-xl bg-haevn-gray-50 hover:bg-haevn-gray-100 transition-colors">
                <div className="relative">
                  <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color} mb-2`} />
                  {stat.badge && (
                    <div className="absolute -top-1 -right-1 h-2 w-2 bg-haevn-orange rounded-full" />
                  )}
                </div>
                <div
                  className="text-2xl sm:text-3xl font-bold text-haevn-navy"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 700
                  }}
                >
                  {stat.value}
                </div>
                <div
                  className="text-xs sm:text-sm text-haevn-charcoal mt-1"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 300
                  }}
                >
                  {stat.label}
                </div>
              </div>
            </StatWrapper>
          )
        })}
      </div>
    </Card>
  )
}
