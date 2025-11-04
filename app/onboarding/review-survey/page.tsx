'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import {
  getCurrentUserPartnershipId,
  getPartnershipSurvey,
  markSurveyReviewed,
  hasUserReviewedSurvey
} from '@/lib/actions/partnership-review'
import { Loader2, AlertCircle, CheckCircle2, FileText, Edit2 } from 'lucide-react'

export default function ReviewSurveyPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [surveyData, setSurveyData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approved, setApproved] = useState(false)
  const [partnershipId, setPartnershipId] = useState<string | null>(null)

  useEffect(() => {
    const loadSurveyData = async () => {
      if (authLoading) return

      if (!user) {
        router.push('/auth/login')
        return
      }

      console.log('[ReviewSurvey] Loading partnership survey data')

      // Check if user has already reviewed
      const reviewStatus = await hasUserReviewedSurvey()

      if (reviewStatus.reviewed) {
        console.log('[ReviewSurvey] User has already reviewed survey, redirecting to dashboard')
        toast({
          title: 'Survey already reviewed',
          description: 'Taking you to the dashboard.',
        })
        router.push('/dashboard')
        return
      }

      // Get user's partnership
      const partnershipResult = await getCurrentUserPartnershipId()

      if (!partnershipResult.success || !partnershipResult.partnershipId) {
        setError('No partnership found. Please contact support.')
        setLoading(false)
        return
      }

      setPartnershipId(partnershipResult.partnershipId)
      console.log('[ReviewSurvey] Partnership ID:', partnershipResult.partnershipId)

      // Load survey data
      console.log('[CLIENT-REVIEW] Fetching partnership survey for:', partnershipResult.partnershipId)
      const surveyResult = await getPartnershipSurvey(partnershipResult.partnershipId)

      if (!surveyResult.success || !surveyResult.data) {
        console.warn('[CLIENT-REVIEW] Failed to load survey:', surveyResult.error)
        setError(surveyResult.error || 'Failed to load survey data')
        setLoading(false)
        return
      }

      console.log('[CLIENT-REVIEW] Survey loaded successfully:', {
        answerCount: Object.keys(surveyResult.data.answers).length,
        completionPct: surveyResult.data.completionPct
      })

      console.log('[ReviewSurvey] Survey data loaded:', {
        answerCount: Object.keys(surveyResult.data.answers).length,
        completionPct: surveyResult.data.completionPct
      })

      setSurveyData(surveyResult.data)
      setLoading(false)
    }

    loadSurveyData()
  }, [user, authLoading, router])

  const handleApproveAndContinue = async () => {
    if (!approved) {
      toast({
        title: 'Please confirm',
        description: 'You must check the approval box to continue.',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    setError(null)

    console.log('[ReviewSurvey] Marking survey as reviewed')

    const result = await markSurveyReviewed()

    if (!result.success) {
      console.error('[ReviewSurvey] Failed to mark survey as reviewed:', result.error)
      setError(result.error || 'Failed to save review status')
      setSaving(false)
      return
    }

    console.log('[ReviewSurvey] Survey marked as reviewed successfully')

    toast({
      title: 'Survey approved!',
      description: 'Welcome to your shared dashboard.',
    })

    router.push('/dashboard')
  }

  const handleEditSurvey = () => {
    console.log('[ReviewSurvey] Redirecting to survey editor')
    router.push('/onboarding/survey')
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray">
        <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
      </div>
    )
  }

  if (error && !surveyData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-haevn-lightgray">
        <div className="w-full max-w-md">
          <Alert variant="destructive" className="rounded-xl mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>

          <Button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full"
            size="lg"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const completionPct = surveyData?.completionPct || 0
  const answerCount = surveyData?.answers ? Object.keys(surveyData.answers).length : 0

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-6 bg-haevn-lightgray">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-haevn-teal/10 p-3 rounded-full">
              <FileText className="h-8 w-8 text-haevn-teal" />
            </div>
            <div>
              <h1
                className="text-haevn-navy"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 700,
                  fontSize: '28px',
                  lineHeight: '100%',
                  letterSpacing: '-0.015em',
                }}
              >
                Review Partnership Survey
              </h1>
              <p
                className="text-haevn-charcoal mt-1"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  fontSize: '14px',
                }}
              >
                Review and approve your partner's responses
              </p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-haevn-charcoal text-sm font-medium">
                Survey Completion
              </span>
              <span className="text-haevn-navy text-lg font-semibold">
                {completionPct}%
              </span>
            </div>
            <div className="w-full bg-haevn-lightgray rounded-full h-2.5">
              <div
                className="bg-haevn-teal h-2.5 rounded-full transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <p className="text-haevn-charcoal text-xs mt-2">
              {answerCount} questions answered
            </p>
          </div>
        </div>

        {/* Survey Status Cards */}
        {completionPct < 100 ? (
          <Alert className="rounded-xl mb-6 border-amber-500 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-900">
              <strong>Survey Incomplete:</strong> Your partner hasn't finished the survey yet ({completionPct}% complete).
              You can wait for them to finish, or you can help complete it together.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="rounded-xl mb-6 border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900">
              <strong>Survey Complete:</strong> All questions have been answered. Review the responses below.
            </AlertDescription>
          </Alert>
        )}

        {/* Survey Answers Display */}
        <div className="bg-white rounded-3xl p-8 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-haevn-navy text-xl font-semibold">
              Survey Responses
            </h2>
            <Button
              onClick={handleEditSurvey}
              variant="outline"
              size="sm"
              className="rounded-full border-haevn-teal text-haevn-teal"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Survey
            </Button>
          </div>

          {answerCount === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-haevn-charcoal/30 mx-auto mb-4" />
              <p className="text-haevn-charcoal">
                No survey responses yet. Your partner hasn't started the survey.
              </p>
              <Button
                onClick={handleEditSurvey}
                className="mt-4 bg-haevn-teal hover:opacity-90 text-white rounded-full"
              >
                Start Survey Together
              </Button>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {Object.entries(surveyData?.answers || {}).map(([questionId, answer]) => (
                <div key={questionId} className="border-b border-haevn-lightgray pb-4 last:border-0">
                  <p className="text-haevn-charcoal text-sm font-medium mb-1">
                    {questionId}
                  </p>
                  <p className="text-haevn-navy">
                    {Array.isArray(answer)
                      ? answer.join(', ')
                      : typeof answer === 'object'
                      ? JSON.stringify(answer)
                      : String(answer)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approval Section */}
        <div className="bg-white rounded-3xl p-8 shadow-sm mb-6">
          <div className="flex items-start gap-3 mb-6">
            <Checkbox
              id="approve"
              checked={approved}
              onCheckedChange={(checked) => setApproved(checked as boolean)}
              className="mt-1"
            />
            <label
              htmlFor="approve"
              className="text-haevn-navy text-sm font-medium cursor-pointer"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
              }}
            >
              I have reviewed these survey responses and approve them. I understand that these responses
              represent our shared partnership and will be used for matching.
            </label>
          </div>

          {error && (
            <Alert variant="destructive" className="rounded-xl mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleApproveAndContinue}
            disabled={!approved || saving || completionPct < 100}
            className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full disabled:opacity-50"
            size="lg"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 500,
              fontSize: '18px'
            }}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : completionPct < 100 ? (
              'Complete Survey First'
            ) : (
              'Approve & Continue to Dashboard'
            )}
          </Button>
        </div>

        <p
          className="text-center text-haevn-charcoal text-xs"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 300,
          }}
        >
          You can edit survey responses at any time from your dashboard settings.
        </p>
      </div>
    </div>
  )
}
