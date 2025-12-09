import Link from 'next/link'
import { Users, UserPlus, Heart, Mail } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PartnerList } from './PartnerList'
import type { RelationshipStatusCardProps } from '@/lib/types/dashboard'

const relationshipTypeLabels: Record<string, string> = {
  solo: 'Solo',
  couple: 'Couple',
  pod: 'Pod'
}

interface RelationshipStatusCardFullProps extends RelationshipStatusCardProps {
  currentUserId: string
}

export function RelationshipStatusCard({
  partnership,
  partners,
  pendingInvites,
  currentUserId
}: RelationshipStatusCardFullProps) {
  // No relationship state
  if (!partnership) {
    return (
      <Card className="rounded-3xl border-haevn-navy/10 shadow-sm">
        <CardHeader>
          <CardTitle
            className="text-haevn-navy flex items-center gap-2"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700
            }}
          >
            <Heart className="h-5 w-5 text-haevn-teal" />
            Your Relationship
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-6">
            <Users className="h-12 w-12 text-haevn-charcoal/30 mx-auto mb-3" />
            <h3
              className="text-lg font-semibold text-haevn-navy mb-1"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 600
              }}
            >
              Create or Join a Relationship
            </h3>
            <p
              className="text-sm text-haevn-charcoal/70 mb-4"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 400
              }}
            >
              Start your HAEVN journey by setting up your relationship
            </p>
            <Link href="/onboarding/identity">
              <Button className="bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-xl">
                <UserPlus className="h-4 w-4 mr-2" />
                Get Started
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Has relationship
  const typeLabel = relationshipTypeLabels[partnership.type] || 'Relationship'

  return (
    <Card className="rounded-3xl border-haevn-navy/10 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle
            className="text-haevn-navy flex items-center gap-2"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700
            }}
          >
            <Heart className="h-5 w-5 text-haevn-teal" />
            Your Relationship
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-full border-haevn-teal text-haevn-teal"
            >
              {typeLabel}
            </Badge>
            <Badge
              variant={partnership.tier === 'premium' ? 'default' : 'secondary'}
              className={
                partnership.tier === 'premium'
                  ? 'bg-haevn-teal text-white rounded-full'
                  : 'bg-gray-200 text-gray-700 rounded-full'
              }
            >
              {partnership.tier === 'premium' ? 'Premium' : 'Free'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Partners Section */}
        <div>
          <h4
            className="text-haevn-navy mb-3 flex items-center gap-2"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 500,
              fontSize: '14px'
            }}
          >
            <Users className="h-4 w-4" />
            Partners ({partners.length})
          </h4>
          <PartnerList partners={partners} currentUserId={currentUserId} />
        </div>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div>
            <h4
              className="text-haevn-navy mb-3 flex items-center gap-2"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500,
                fontSize: '14px'
              }}
            >
              <Mail className="h-4 w-4" />
              Pending Invites ({pendingInvites.length})
            </h4>
            <div className="space-y-2">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl border border-yellow-200"
                >
                  <div>
                    <p
                      className="text-haevn-navy font-medium text-sm"
                      style={{
                        fontFamily: 'Roboto, Helvetica, sans-serif',
                        fontWeight: 500
                      }}
                    >
                      {invite.email}
                    </p>
                    <p
                      className="text-haevn-charcoal/60 text-xs"
                      style={{
                        fontFamily: 'Roboto, Helvetica, sans-serif',
                        fontWeight: 300
                      }}
                    >
                      Code: {invite.inviteCode}
                    </p>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-700 rounded-full border-yellow-200">
                    Pending
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invite Partner Button - only show if relationship type supports more partners */}
        {(partnership.type === 'couple' && partners.length < 2) ||
        (partnership.type === 'pod') ? (
          <div className="pt-2">
            <Link href="/dashboard/invite">
              <Button
                variant="outline"
                className="w-full border-haevn-teal text-haevn-teal hover:bg-haevn-teal/5 rounded-xl"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Partner
              </Button>
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
