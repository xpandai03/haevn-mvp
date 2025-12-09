import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { AvatarUpload } from './AvatarUpload'

interface ProfileBannerCardProps {
  user: { id: string; email: string }
  profile: { fullName: string; photoUrl?: string } | null
  membershipTier?: 'free' | 'plus'
  stats?: {
    matches: number
    messages: number
    connections: number
  }
  onAvatarUpload?: (file: File) => Promise<void>
}

export function ProfileBannerCard({
  user,
  profile,
  membershipTier = 'free',
  stats = { matches: 0, messages: 0, connections: 0 },
  onAvatarUpload
}: ProfileBannerCardProps) {
  const displayName = profile?.fullName || 'User'

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm bg-white">
      {/* Top section - Avatar overlapping into navy */}
      <div className="relative">
        {/* White/transparent top area for avatar top half */}
        <div className="h-12 bg-transparent" />

        {/* Navy Gradient Section - starts at avatar midpoint */}
        <div
          className="px-6 pt-14 pb-6 rounded-t-3xl"
          style={{
            background: 'linear-gradient(135deg, #0F2A4A 0%, #1A4B6E 50%, #0F2A4A 100%)'
          }}
        >
          {/* Name + Badge - Centered, White Text */}
          <div className="text-center mb-5">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xl font-bold text-white">
                {displayName}
              </h2>
              <Badge
                className={`rounded-full text-xs px-2.5 py-0.5 font-semibold ${
                  membershipTier === 'plus'
                    ? 'bg-[#1B9A9A] text-white'
                    : 'bg-orange-500 text-white'
                }`}
              >
                {membershipTier === 'plus' ? 'PLUS' : 'FREE'}
              </Badge>
            </div>
          </div>

          {/* Stats Row - Labels ABOVE numbers */}
          <div className="grid grid-cols-3 gap-4">
            <Link
              href="/dashboard/matches"
              className="text-center py-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <p className="text-xs text-white/70 uppercase tracking-widest font-medium mb-1">
                Matches
              </p>
              <p className="text-3xl font-bold text-white">
                {stats.matches}
              </p>
            </Link>

            <Link
              href="/messages"
              className="text-center py-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <p className="text-xs text-white/70 uppercase tracking-widest font-medium mb-1">
                {membershipTier === 'plus' ? 'New Messages' : 'Messages'}
              </p>
              <p className="text-3xl font-bold text-white">
                {stats.messages}
              </p>
            </Link>

            <Link
              href="/dashboard/connections"
              className="text-center py-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <p className="text-xs text-white/70 uppercase tracking-widest font-medium mb-1">
                Connections
              </p>
              <p className="text-3xl font-bold text-white">
                {stats.connections}
              </p>
            </Link>
          </div>
        </div>

        {/* Avatar - Positioned to overlap top edge of navy section */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2">
          <AvatarUpload
            photoUrl={profile?.photoUrl}
            displayName={displayName}
            onUpload={onAvatarUpload}
            size="lg"
            editable={!!onAvatarUpload}
          />
        </div>
      </div>
    </div>
  )
}
