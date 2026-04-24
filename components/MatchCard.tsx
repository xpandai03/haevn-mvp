'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, X, Sparkles, Lock } from 'lucide-react'
import { likePartnership } from '@/lib/db/likes'
import { useToast } from '@/hooks/use-toast'

interface MatchCardProps {
  partnershipId: string
  currentPartnershipId: string
  displayName: string
  bio?: string
  score: number
  bucket: 'High' | 'Medium' | 'Low'
  badges?: string[]
  onLikeComplete?: (matched: boolean, handshakeId?: string) => void
  onPass?: () => void
  membershipTier?: 'free' | 'plus' | 'select'
  onUpgrade?: () => void
}

/**
 * MatchCard — architectural reskin.
 *
 * This card is the standalone (non-dashboard) match surface. The dashboard
 * matches list uses `ProfileCard`; this file is kept for discovery flows.
 * Same props, sharper corners, Cabinet Grotesk heading, tier-gated CTA.
 */
export function MatchCard({
  partnershipId,
  currentPartnershipId,
  displayName,
  bio,
  score,
  bucket,
  badges = [],
  onLikeComplete,
  onPass,
  membershipTier = 'free',
  onUpgrade,
}: MatchCardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLiking, setIsLiking] = useState(false)
  const isLocked = membershipTier === 'free'

  const handleLike = async () => {
    if (isLiking || isLocked) return
    setIsLiking(true)
    try {
      const result = await likePartnership(currentPartnershipId, partnershipId)
      if (result.matched) {
        toast({
          title: 'Connection made',
          description: (
            <div className="flex flex-col gap-2">
              <p>You and {displayName} are now connected.</p>
              {result.handshakeId && (
                <button
                  type="button"
                  onClick={() => router.push(`/chat/${result.handshakeId}`)}
                  className="haevn-btn-teal text-sm"
                >
                  Start conversation
                </button>
              )}
            </div>
          ),
          duration: 5000,
        })
      } else {
        toast({
          title: 'Connection request sent',
          description: `If ${displayName} connects back, you will match.`,
          duration: 3000,
        })
      }
      onLikeComplete?.(result.matched, result.handshakeId)
    } catch (error) {
      console.error('Error sending connection request:', error)
      toast({
        title: 'Failed to send connection request',
        description: 'Please try again later.',
        variant: 'destructive',
      })
    } finally {
      setIsLiking(false)
    }
  }

  const bucketTone = {
    High: 'text-[color:var(--haevn-teal)]',
    Medium: 'text-[color:var(--haevn-gold)]',
    Low: 'text-[color:var(--haevn-muted-fg)]',
  }[bucket]

  return (
    <div className="dash-card w-full max-w-md mx-auto flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-6 pb-0 gap-4">
        <div className="min-w-0">
          <h3 className="font-heading text-xl text-[color:var(--haevn-navy)] leading-tight truncate">
            {displayName}
          </h3>
          {bio && (
            <p className="text-sm text-[color:var(--haevn-muted-fg)] mt-1.5 leading-relaxed line-clamp-2">
              {bio}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-heading text-2xl text-[color:var(--haevn-navy)] tabular-nums">
            {score}%
          </div>
          <div
            className={`text-[11px] tracking-[0.14em] uppercase mt-0.5 ${bucketTone}`}
          >
            {bucket} match
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Photo-hidden notice (kept from original — this card has no photo) */}
        <div className="bg-[color:var(--haevn-dash-surface-alt)] border border-[color:var(--haevn-border)] p-8 text-center">
          <Lock
            className="h-10 w-10 mx-auto text-[color:var(--haevn-muted-fg)] mb-3"
            strokeWidth={1.25}
          />
          <p className="text-sm text-[color:var(--haevn-muted-fg)]">
            Photos hidden until connection
          </p>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {badges.map((badge) => (
              <span
                key={badge}
                className="text-[11px] tracking-wide text-[color:var(--haevn-teal)] bg-[rgba(0,128,128,0.08)] border border-[rgba(0,128,128,0.15)] px-2.5 py-1 inline-flex items-center gap-1"
              >
                {badge === 'Verified' && <Sparkles className="h-3 w-3" />}
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onPass}
            className="haevn-btn-secondary flex-1"
          >
            <X className="h-4 w-4 mr-2" strokeWidth={1.75} />
            Pass
          </button>

          {isLocked ? (
            <button
              type="button"
              onClick={onUpgrade}
              className="haevn-btn-gold flex-1"
            >
              <Lock className="h-4 w-4 mr-2" strokeWidth={1.75} />
              Upgrade to connect
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLike}
              disabled={isLiking}
              className="haevn-btn-gold flex-1"
            >
              <Heart className="h-4 w-4 mr-2" strokeWidth={1.75} />
              {isLiking ? 'Sending…' : 'Connect'}
            </button>
          )}
        </div>

        {isLocked && (
          <p className="text-xs text-center text-[color:var(--haevn-muted-fg)]">
            Upgrade to HAEVN+ to connect and start conversations.
          </p>
        )}
      </div>
    </div>
  )
}
