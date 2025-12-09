import Link from 'next/link'
import { Users, UserPlus, Heart, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { PartnerInfo, PendingInviteInfo } from '@/lib/types/dashboard'

const relationshipTypeLabels: Record<string, string> = {
  solo: 'Solo',
  couple: 'Couple',
  pod: 'Pod'
}

interface RelationshipStatusCardCompactProps {
  partnership: {
    id: string
    type: 'solo' | 'couple' | 'pod'
    tier: 'free' | 'premium'
    ownerId: string
  } | null
  partners: PartnerInfo[]
  pendingInvites: PendingInviteInfo[]
  currentUserId: string
}

export function RelationshipStatusCardCompact({
  partnership,
  partners,
  pendingInvites,
  currentUserId
}: RelationshipStatusCardCompactProps) {
  // No relationship state
  if (!partnership) {
    return (
      <Card className="rounded-2xl border-haevn-navy/10 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-haevn-lightgray flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-haevn-charcoal/50" />
            </div>
            <div className="flex-1">
              <h3
                className="text-sm font-semibold text-haevn-navy"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
              >
                No Relationship Yet
              </h3>
              <p
                className="text-xs text-haevn-charcoal/70"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
              >
                Set up your relationship to get started
              </p>
            </div>
            <Link
              href="/onboarding/identity"
              className="flex items-center justify-center px-4 py-2 bg-haevn-teal text-white rounded-xl text-sm font-medium hover:bg-haevn-teal/90 transition-colors"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Setup
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Has relationship - compact view
  const typeLabel = relationshipTypeLabels[partnership.type] || 'Relationship'
  const pendingCount = pendingInvites.length

  return (
    <Card className="rounded-2xl border-haevn-navy/10 shadow-sm">
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-haevn-teal" />
            <h3
              className="text-sm font-semibold text-haevn-navy"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              Your Relationship
            </h3>
          </div>
          <Badge
            variant="outline"
            className="rounded-full text-xs border-haevn-teal text-haevn-teal"
          >
            {typeLabel}
          </Badge>
        </div>

        {/* Partners Row - Compact avatar list */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Partner Avatars */}
            <div className="flex -space-x-2">
              {partners.slice(0, 4).map((partner) => {
                const initials = partner.name
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)

                const isComplete = partner.status === 'completed'

                return (
                  <Avatar
                    key={partner.userId}
                    className={`h-8 w-8 border-2 ${
                      isComplete ? 'border-green-500' : 'border-yellow-400'
                    } bg-white`}
                  >
                    <AvatarFallback className="text-xs bg-haevn-lightgray text-haevn-navy">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                )
              })}
              {partners.length > 4 && (
                <div className="h-8 w-8 rounded-full bg-haevn-lightgray border-2 border-white flex items-center justify-center">
                  <span className="text-xs text-haevn-charcoal">+{partners.length - 4}</span>
                </div>
              )}
            </div>

            {/* Partner count text */}
            <span
              className="text-sm text-haevn-charcoal/70"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              {partners.length} partner{partners.length !== 1 ? 's' : ''}
              {pendingCount > 0 && (
                <span className="text-yellow-600 ml-1">
                  ({pendingCount} pending)
                </span>
              )}
            </span>
          </div>

          {/* Invite Button */}
          {(partnership.type === 'couple' && partners.length < 2) ||
          partnership.type === 'pod' ? (
            <Link
              href="/dashboard/invite"
              className="flex items-center gap-1 text-haevn-teal text-sm font-medium hover:underline"
            >
              <UserPlus className="h-4 w-4" />
              Invite
            </Link>
          ) : null}
        </div>

        {/* Partner Status Summary */}
        {partners.length > 0 && (
          <div className="mt-3 pt-3 border-t border-haevn-navy/5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                {/* Completed count */}
                <span className="flex items-center gap-1 text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {partners.filter(p => p.status === 'completed').length} complete
                </span>
                {/* In progress count */}
                {partners.filter(p => p.status === 'in_progress').length > 0 && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    {partners.filter(p => p.status === 'in_progress').length} in progress
                  </span>
                )}
              </div>
              <Link
                href="/dashboard/partners"
                className="flex items-center text-haevn-charcoal/60 hover:text-haevn-teal"
              >
                View all
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
