import Link from 'next/link'
import { User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { OnboardingProgress } from './OnboardingProgress'

interface ProfileSummaryCardCompactProps {
  user: { id: string; email: string }
  profile: { fullName: string; photoUrl?: string } | null
  onboardingCompletion: number
  membershipTier?: 'free' | 'plus'
  stats?: {
    matches: number
    messages: number
    connections: number
  }
}

export function ProfileSummaryCardCompact({
  user,
  profile,
  onboardingCompletion,
  membershipTier = 'free',
  stats = { matches: 0, messages: 0, connections: 0 }
}: ProfileSummaryCardCompactProps) {
  const displayName = profile?.fullName || 'User'
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const isComplete = onboardingCompletion >= 100

  return (
    <Card className="rounded-2xl border-haevn-navy/10 shadow-sm overflow-hidden">
      <CardContent className="p-4">
        {/* Profile Header */}
        <div className="flex items-center gap-3 mb-4">
          {/* Avatar */}
          <Avatar className="h-14 w-14 border-2 border-haevn-teal/20">
            {profile?.photoUrl ? (
              <AvatarImage src={profile.photoUrl} alt={displayName} />
            ) : null}
            <AvatarFallback className="bg-haevn-lightgray text-haevn-navy text-base font-semibold">
              {initials || <User className="h-5 w-5" />}
            </AvatarFallback>
          </Avatar>

          {/* Name & Badge */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2
                className="text-lg font-bold text-haevn-navy truncate"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 700
                }}
              >
                {displayName}
              </h2>
              <Badge
                variant={membershipTier === 'plus' ? 'default' : 'secondary'}
                className={`rounded-full text-xs px-2 py-0 ${
                  membershipTier === 'plus'
                    ? 'bg-haevn-teal text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {membershipTier === 'plus' ? 'PLUS' : 'FREE'}
              </Badge>
            </div>

            {/* Onboarding Progress */}
            {!isComplete && (
              <div className="mt-1.5">
                <OnboardingProgress
                  percentage={onboardingCompletion}
                  size="sm"
                  showPercentage={true}
                  label="Onboarding"
                />
              </div>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-haevn-navy/5">
          <Link href="/dashboard/matches" className="text-center py-2 hover:bg-haevn-lightgray rounded-lg transition-colors">
            <p
              className="text-xl font-bold text-haevn-navy"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              {stats.matches}
            </p>
            <p
              className="text-xs text-haevn-charcoal/70"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              Matches
            </p>
          </Link>

          <Link href="/messages" className="text-center py-2 hover:bg-haevn-lightgray rounded-lg transition-colors">
            <p
              className="text-xl font-bold text-haevn-navy"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              {stats.messages}
            </p>
            <p
              className="text-xs text-haevn-charcoal/70"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              Messages
            </p>
          </Link>

          <Link href="/dashboard/connections" className="text-center py-2 hover:bg-haevn-lightgray rounded-lg transition-colors">
            <p
              className="text-xl font-bold text-haevn-navy"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              {stats.connections}
            </p>
            <p
              className="text-xs text-haevn-charcoal/70"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              Connections
            </p>
          </Link>
        </div>

        {/* Continue Onboarding CTA */}
        {!isComplete && (
          <div className="mt-3 pt-3 border-t border-haevn-navy/5">
            <Link
              href="/onboarding/survey"
              className="flex items-center justify-center w-full py-2 bg-haevn-teal text-white rounded-xl text-sm font-medium hover:bg-haevn-teal/90 transition-colors"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              Continue Onboarding
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
