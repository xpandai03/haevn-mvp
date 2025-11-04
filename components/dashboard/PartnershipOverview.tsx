'use client'

import { useEffect, useState } from 'react'
import { getPartnershipInfo, type PartnershipInfo } from '@/lib/actions/partnership-management'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, CheckCircle2, Clock, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function PartnershipOverview() {
  const [partnershipInfo, setPartnershipInfo] = useState<PartnershipInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadPartnership() {
      const result = await getPartnershipInfo()
      if (result.success && result.partnership) {
        setPartnershipInfo(result.partnership)
      } else {
        setError(result.error || 'Failed to load partnership')
      }
      setLoading(false)
    }
    loadPartnership()
  }, [])

  if (loading) {
    return (
      <Card className="rounded-3xl border-haevn-navy/10">
        <CardHeader>
          <CardTitle className="text-haevn-navy flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Partnership
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-haevn-charcoal opacity-70">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  if (error || !partnershipInfo) {
    return (
      <Card className="rounded-3xl border-haevn-navy/10">
        <CardHeader>
          <CardTitle className="text-haevn-navy flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Partnership
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">{error || 'No partnership found'}</div>
        </CardContent>
      </Card>
    )
  }

  const { members, pending_invites, tier, all_partners_reviewed, survey_completion } = partnershipInfo

  return (
    <Card className="rounded-3xl border-haevn-navy/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-haevn-navy flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Partnership
          </CardTitle>
          <Badge
            variant={tier === 'premium' ? 'default' : 'secondary'}
            className={cn(
              'rounded-full',
              tier === 'premium' ? 'bg-haevn-teal text-white' : 'bg-gray-200 text-gray-700'
            )}
          >
            {tier === 'premium' ? 'Premium' : 'Free'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Partnership Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span
              className="text-haevn-charcoal"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500,
                fontSize: '14px'
              }}
            >
              Partnership Status
            </span>
            {all_partners_reviewed ? (
              <Badge className="bg-green-100 text-green-700 rounded-full">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                All Partners Reviewed
              </Badge>
            ) : (
              <Badge className="bg-yellow-100 text-yellow-700 rounded-full">
                <Clock className="h-3 w-3 mr-1" />
                Pending Review
              </Badge>
            )}
          </div>
          <div className="text-sm text-haevn-charcoal opacity-70">
            Survey: {survey_completion}% complete
          </div>
        </div>

        {/* Partners List */}
        <div className="space-y-3">
          <h4
            className="text-haevn-navy"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 500,
              fontSize: '14px'
            }}
          >
            Partners ({members.length})
          </h4>
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between p-3 bg-haevn-lightgray rounded-xl"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-haevn-navy"
                      style={{
                        fontFamily: 'Roboto, Helvetica, sans-serif',
                        fontWeight: 500,
                        fontSize: '14px'
                      }}
                    >
                      {member.full_name}
                    </span>
                    <Badge
                      variant="outline"
                      className="rounded-full text-xs border-haevn-navy/30"
                    >
                      {member.role === 'owner' ? 'Owner' : 'Member'}
                    </Badge>
                  </div>
                  <div
                    className="text-haevn-charcoal opacity-70"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 300,
                      fontSize: '12px'
                    }}
                  >
                    {member.email}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.survey_reviewed ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs">Reviewed</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-yellow-600">
                      <Clock className="h-4 w-4" />
                      <span className="text-xs">Pending</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Invites */}
        {pending_invites.length > 0 && (
          <div className="space-y-3">
            <h4
              className="text-haevn-navy flex items-center gap-2"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500,
                fontSize: '14px'
              }}
            >
              <UserPlus className="h-4 w-4" />
              Pending Invites ({pending_invites.length})
            </h4>
            <div className="space-y-2">
              {pending_invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl border border-yellow-200"
                >
                  <div className="flex-1">
                    <div
                      className="text-haevn-navy"
                      style={{
                        fontFamily: 'Roboto, Helvetica, sans-serif',
                        fontWeight: 500,
                        fontSize: '14px'
                      }}
                    >
                      {invite.to_email}
                    </div>
                    <div
                      className="text-haevn-charcoal opacity-70"
                      style={{
                        fontFamily: 'Roboto, Helvetica, sans-serif',
                        fontWeight: 300,
                        fontSize: '12px'
                      }}
                    >
                      Code: {invite.invite_code}
                    </div>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-700 rounded-full">
                    Pending
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Message for 3+ Partners */}
        {members.length >= 3 && (
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
            <p
              className="text-blue-800 text-sm"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 400
              }}
            >
              🎉 Your partnership has {members.length} members! All partners have equal access to
              matches, connections, and settings.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
