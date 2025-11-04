'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import { fetchInviteDetails } from '@/lib/actions/partnership-review'
import { acceptPartnershipInvite } from '@/lib/actions/partnership-invites'
import { Loader2, AlertCircle, CheckCircle2, Users } from 'lucide-react'

export default function AcceptInvitePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [inviteData, setInviteData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadInviteData = async () => {
      if (authLoading) return

      if (!user) {
        router.push('/auth/login')
        return
      }

      // Get invite code from localStorage
      const code = localStorage.getItem('haevn_invite_code')

      if (!code) {
        console.log('[AcceptInvite] No invite code found, redirecting to expectations')
        router.push('/onboarding/expectations')
        return
      }

      console.log('[AcceptInvite] Loading invite details for code:', code)

      // Fetch invite details
      const result = await fetchInviteDetails(code)

      if (!result.success || !result.data) {
        setError(result.error || 'Invalid invite code')
        setLoading(false)
        return
      }

      console.log('[AcceptInvite] Invite data loaded:', result.data)
      setInviteData(result.data)
      setLoading(false)
    }

    loadInviteData()
  }, [user, authLoading, router])

  const handleAcceptInvite = async () => {
    setAccepting(true)
    setError(null)

    const code = localStorage.getItem('haevn_invite_code')

    if (!code) {
      setError('Invite code not found')
      setAccepting(false)
      return
    }

    console.log('[AcceptInvite] Accepting invite with code:', code)

    const result = await acceptPartnershipInvite(code)

    if (!result.success) {
      console.error('[AcceptInvite] Failed to accept invite:', result.error)
      setError(result.error || 'Failed to join partnership')
      setAccepting(false)
      return
    }

    console.log('[AcceptInvite] Invite accepted successfully')

    // Clear invite code from localStorage
    localStorage.removeItem('haevn_invite_code')

    toast({
      title: 'Partnership joined!',
      description: 'You are now connected with your partner.',
    })

    // Redirect to review survey
    router.push('/onboarding/review-survey')
  }

  const handleDecline = () => {
    localStorage.removeItem('haevn_invite_code')
    toast({
      title: 'Invite declined',
      description: 'You can continue with solo onboarding.',
    })
    router.push('/onboarding/expectations')
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray">
        <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
      </div>
    )
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-haevn-lightgray">
        <div className="w-full max-w-md">
          <Alert variant="destructive" className="rounded-xl mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>

          <Button
            onClick={() => router.push('/onboarding/expectations')}
            className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full"
            size="lg"
          >
            Continue Without Invite
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-haevn-lightgray">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-haevn-teal/10 p-4 rounded-full">
              <Users className="h-12 w-12 text-haevn-teal" />
            </div>
          </div>
          <h1
            className="text-haevn-navy mb-3"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700,
              fontSize: '32px',
              lineHeight: '100%',
              letterSpacing: '-0.015em',
            }}
          >
            Join Partnership
          </h1>
          <p
            className="text-haevn-charcoal"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              fontSize: '16px',
              lineHeight: '120%',
            }}
          >
            You've been invited to join a partnership on HAEVN
          </p>
        </div>

        {/* Invite Details Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm mb-6">
          <div className="space-y-4">
            <div>
              <label className="text-haevn-charcoal text-sm font-medium">
                Invited by
              </label>
              <p className="text-haevn-navy text-lg font-semibold">
                {inviteData?.inviterName}
              </p>
              <p className="text-haevn-charcoal text-sm">
                {inviteData?.inviterEmail}
              </p>
            </div>

            <div className="border-t border-haevn-lightgray pt-4">
              <label className="text-haevn-charcoal text-sm font-medium">
                Location
              </label>
              <p className="text-haevn-navy">
                {inviteData?.city}
              </p>
            </div>

            <div className="border-t border-haevn-lightgray pt-4">
              <label className="text-haevn-charcoal text-sm font-medium">
                Survey Status
              </label>
              <div className="flex items-center gap-2 mt-1">
                {inviteData?.surveyComplete ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-haevn-navy">
                      Complete (100%)
                    </span>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-5 w-5 text-haevn-charcoal" />
                    <span className="text-haevn-charcoal">
                      {inviteData?.surveyCompletionPct}% complete
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-haevn-lightgray pt-4">
              <label className="text-haevn-charcoal text-sm font-medium">
                Membership Tier
              </label>
              <p className="text-haevn-navy capitalize">
                {inviteData?.membershipTier}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {error && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleAcceptInvite}
            disabled={accepting}
            className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full"
            size="lg"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 500,
              fontSize: '18px'
            }}
          >
            {accepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining Partnership...
              </>
            ) : (
              'Join Partnership & Review Survey'
            )}
          </Button>

          <Button
            onClick={handleDecline}
            disabled={accepting}
            variant="outline"
            className="w-full rounded-full border-haevn-navy text-haevn-navy"
            size="lg"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 500,
              fontSize: '16px'
            }}
          >
            Decline & Continue Solo
          </Button>
        </div>

        <p
          className="text-center text-haevn-charcoal text-xs mt-6"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 300,
          }}
        >
          By joining this partnership, you'll share a profile and survey responses with your partner.
        </p>
      </div>
    </div>
  )
}
