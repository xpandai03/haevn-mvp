'use client'

import { useEffect, useState } from 'react'
import { getPartnershipInfo, type PartnershipMember } from '@/lib/actions/partnership-management'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface SurveyProgressData {
  partnershipCompletion: number
  allPartnersReviewed: boolean
  members: PartnershipMember[]
}

export default function DualSurveyProgress() {
  const [surveyData, setSurveyData] = useState<SurveyProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSurveyProgress() {
      const result = await getPartnershipInfo()
      if (result.success && result.partnership) {
        setSurveyData({
          partnershipCompletion: result.partnership.survey_completion,
          allPartnersReviewed: result.partnership.all_partners_reviewed,
          members: result.partnership.members
        })
      } else {
        setError(result.error || 'Failed to load survey progress')
      }
      setLoading(false)
    }
    loadSurveyProgress()
  }, [])

  if (loading) {
    return (
      <Card className="rounded-3xl border-haevn-navy/10">
        <CardHeader>
          <CardTitle className="text-haevn-navy flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Survey Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-haevn-charcoal opacity-70">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  if (error || !surveyData) {
    return (
      <Card className="rounded-3xl border-haevn-navy/10">
        <CardHeader>
          <CardTitle className="text-haevn-navy flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Survey Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">{error || 'No survey data found'}</div>
        </CardContent>
      </Card>
    )
  }

  const { partnershipCompletion, allPartnersReviewed, members } = surveyData
  const isComplete = partnershipCompletion === 100 && allPartnersReviewed

  return (
    <Card className="rounded-3xl border-haevn-navy/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-haevn-navy flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Survey Progress
          </CardTitle>
          {isComplete ? (
            <Badge className="bg-green-100 text-green-700 rounded-full">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          ) : (
            <Badge className="bg-yellow-100 text-yellow-700 rounded-full">
              <AlertCircle className="h-3 w-3 mr-1" />
              In Progress
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Partnership Survey (Combined) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4
              className="text-haevn-navy"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500,
                fontSize: '14px'
              }}
            >
              Partnership Survey
            </h4>
            <span
              className="text-haevn-charcoal"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 600,
                fontSize: '16px'
              }}
            >
              {partnershipCompletion}%
            </span>
          </div>
          <Progress value={partnershipCompletion} className="h-3 bg-gray-200">
            <div
              className="h-full bg-haevn-teal transition-all rounded-full"
              style={{ width: `${partnershipCompletion}%` }}
            />
          </Progress>
          <p
            className="text-haevn-charcoal opacity-70"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              fontSize: '13px'
            }}
          >
            This is your shared partnership survey that all partners collaborate on. Your matches
            are based on these combined responses.
          </p>
        </div>

        {/* Individual Partner Review Status */}
        <div className="space-y-3">
          <h4
            className="text-haevn-navy"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 500,
              fontSize: '14px'
            }}
          >
            Partner Review Status
          </h4>
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between p-3 bg-haevn-lightgray rounded-xl"
              >
                <div className="flex items-center gap-3">
                  {member.survey_reviewed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                  <div>
                    <div
                      className="text-haevn-navy"
                      style={{
                        fontFamily: 'Roboto, Helvetica, sans-serif',
                        fontWeight: 500,
                        fontSize: '14px'
                      }}
                    >
                      {member.full_name}
                    </div>
                    <div
                      className="text-haevn-charcoal opacity-70"
                      style={{
                        fontFamily: 'Roboto, Helvetica, sans-serif',
                        fontWeight: 300,
                        fontSize: '12px'
                      }}
                    >
                      {member.survey_reviewed
                        ? `Reviewed on ${new Date(member.survey_reviewed_at!).toLocaleDateString()}`
                        : 'Waiting for review'}
                    </div>
                  </div>
                </div>
                {member.survey_reviewed ? (
                  <Badge className="bg-green-100 text-green-700 rounded-full">Approved</Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-700 rounded-full">Pending</Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Info about dual survey model */}
        <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
          <h5
            className="text-blue-900 mb-1"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 500,
              fontSize: '13px'
            }}
          >
            How it works
          </h5>
          <p
            className="text-blue-800 text-sm"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 400,
              lineHeight: '140%'
            }}
          >
            Your partnership has one shared survey that represents your collective preferences. All
            partners can view and edit the survey, and each partner must review and approve the
            responses before you can start matching.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {partnershipCompletion < 100 && (
            <Link href="/onboarding/survey" className="flex-1">
              <Button className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full">
                Continue Survey
              </Button>
            </Link>
          )}
          {partnershipCompletion === 100 && !allPartnersReviewed && (
            <Link href="/onboarding/review-survey" className="flex-1">
              <Button className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full">
                Review Survey
              </Button>
            </Link>
          )}
          {isComplete && (
            <Link href="/onboarding/survey" className="flex-1">
              <Button
                variant="outline"
                className="w-full rounded-full border-haevn-navy text-haevn-navy"
              >
                View/Edit Survey
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
