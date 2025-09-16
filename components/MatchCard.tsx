'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Heart, X, Sparkles, Lock, CheckCircle } from 'lucide-react'
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
  onUpgrade
}: MatchCardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLiking, setIsLiking] = useState(false)
  const handleLike = async () => {
    if (isLiking || membershipTier === 'free') return

    setIsLiking(true)
    try {
      const result = await likePartnership(currentPartnershipId, partnershipId)

      if (result.matched) {
        toast({
          title: '🎉 Handshake unlocked!',
          description: (
            <div className="flex flex-col gap-2">
              <p>You and {displayName} both liked each other!</p>
              {result.handshakeId && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => router.push(`/chat/${result.handshakeId}`)}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Start Conversation
                </Button>
              )}
            </div>
          ),
          duration: 5000
        })
      } else {
        toast({
          title: 'Like sent!',
          description: `If ${displayName} likes you back, you will match!`,
          duration: 3000
        })
      }

      if (onLikeComplete) {
        onLikeComplete(result.matched, result.handshakeId)
      }
    } catch (error) {
      console.error('Error sending like:', error)
      toast({
        title: 'Failed to send like',
        description: 'Please try again later.',
        variant: 'destructive'
      })
    } finally {
      setIsLiking(false)
    }
  }

  const bucketColors = {
    High: 'text-green-600 bg-green-50 border-green-200',
    Medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    Low: 'text-gray-600 bg-gray-50 border-gray-200'
  }

  const bucketBadgeVariant = {
    High: 'default' as const,
    Medium: 'secondary' as const,
    Low: 'outline' as const
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">{displayName}</CardTitle>
            {bio && <CardDescription className="mt-1">{bio}</CardDescription>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{score}%</div>
            <Badge variant={bucketBadgeVariant[bucket]} className="mt-1">
              {bucket} Match
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* No Photos Notice */}
        <div className="bg-secondary/50 rounded-lg p-8 text-center">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Photos hidden until handshake
          </p>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.map((badge, index) => (
              <Badge key={index} variant="outline">
                {badge === 'Verified' && <Sparkles className="h-3 w-3 mr-1" />}
                {badge}
              </Badge>
            ))}
          </div>
        )}

        {/* Compatibility Breakdown (placeholder for future) */}
        <div className={`border rounded-lg p-3 ${bucketColors[bucket]}`}>
          <p className="text-xs font-medium">Why {bucket} Match?</p>
          <p className="text-xs mt-1 opacity-75">
            {bucket === 'High' && 'Strong alignment in intentions and relationship style'}
            {bucket === 'Medium' && 'Some shared interests and compatible preferences'}
            {bucket === 'Low' && 'Different preferences but potential for connection'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onPass}
          >
            <X className="h-4 w-4 mr-2" />
            Pass
          </Button>

          {membershipTier === 'free' ? (
            <Button
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              onClick={onUpgrade}
            >
              <Lock className="h-4 w-4 mr-2" />
              Upgrade to Like
            </Button>
          ) : (
            <Button
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              onClick={handleLike}
              disabled={isLiking}
            >
              <Heart className="h-4 w-4 mr-2" />
              {isLiking ? 'Sending...' : 'Like'}
            </Button>
          )}
        </div>

        {membershipTier === 'free' && (
          <p className="text-xs text-center text-muted-foreground">
            Upgrade to HAEVN+ to send likes and start conversations
          </p>
        )}
      </CardContent>
    </Card>
  )
}