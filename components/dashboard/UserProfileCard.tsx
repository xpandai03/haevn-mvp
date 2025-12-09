import Link from 'next/link'
import { User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { OnboardingProgress } from './OnboardingProgress'
import type { UserProfileCardProps } from '@/lib/types/dashboard'

export function UserProfileCard({
  user,
  profile,
  onboardingCompletion
}: UserProfileCardProps) {
  const displayName = profile?.fullName || 'User'
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const isComplete = onboardingCompletion >= 100

  return (
    <Card className="rounded-3xl border-haevn-navy/10 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar className="h-16 w-16 border-2 border-haevn-teal/20">
            {profile?.photoUrl ? (
              <AvatarImage src={profile.photoUrl} alt={displayName} />
            ) : null}
            <AvatarFallback className="bg-haevn-lightgray text-haevn-navy text-lg font-semibold">
              {initials || <User className="h-6 w-6" />}
            </AvatarFallback>
          </Avatar>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <h2
              className="text-xl font-bold text-haevn-navy truncate"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 700
              }}
            >
              {displayName}
            </h2>
            <p
              className="text-sm text-haevn-charcoal/70 truncate"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 400
              }}
            >
              {user.email}
            </p>
          </div>
        </div>

        {/* Onboarding Progress */}
        <div className="mt-6">
          <OnboardingProgress
            percentage={onboardingCompletion}
            label="Onboarding"
            size="md"
          />
        </div>

        {/* Continue Onboarding Button */}
        {!isComplete && (
          <div className="mt-4">
            <Link href="/onboarding/survey">
              <Button
                className="w-full bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-xl"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500
                }}
              >
                Continue Onboarding
              </Button>
            </Link>
          </div>
        )}

        {isComplete && (
          <div className="mt-4 flex items-center justify-center gap-2 text-green-600">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span
              className="text-sm font-medium"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500
              }}
            >
              Onboarding Complete
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
