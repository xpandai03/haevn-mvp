'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { useAuth } from '@/lib/auth/context'
import { getClientOnboardingFlowController } from '@/lib/onboarding/flow'
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type VerificationStatus = 'checking' | 'approved' | 'declined' | 'pending' | 'error'

function VerificationReturnContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const flowController = getClientOnboardingFlowController()
  const supabase = createClient()

  const [status, setStatus] = useState<VerificationStatus>('checking')
  const [attempts, setAttempts] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Get session ID from URL query params or localStorage
    const urlSessionId = searchParams?.get('session_id')
    const storedSessionId = localStorage.getItem('veriff_session_id')
    const veriffSessionId = urlSessionId || storedSessionId

    if (veriffSessionId) {
      setSessionId(veriffSessionId)
    } else {
      console.warn('[Return] No session ID found')
    }
  }, [user, searchParams, router])

  useEffect(() => {
    if (!user || !sessionId) return

    const checkVerificationStatus = async () => {
      try {
        console.log('[Return] Checking verification status, attempt:', attempts + 1)

        // Check profile verification status in Supabase
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('verified, verification_status')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('[Return] Error fetching profile:', error)
          throw error
        }

        console.log('[Return] Profile status:', profile)

        if (profile.verified === true) {
          // Verification approved!
          setStatus('approved')
          localStorage.removeItem('veriff_session_id')

          // Mark onboarding step as complete
          await flowController.markStepComplete(user.id, 5)

          // Wait 2 seconds then navigate to survey
          setTimeout(() => {
            router.push('/onboarding/survey-intro')
          }, 2000)
        } else if (profile.verification_status === 'declined') {
          // Verification declined
          setStatus('declined')
          localStorage.removeItem('veriff_session_id')
        } else if (attempts < 20) {
          // Still processing - poll again
          setAttempts(attempts + 1)
          setTimeout(checkVerificationStatus, 3000) // Poll every 3 seconds
        } else {
          // Max attempts reached - show pending status
          setStatus('pending')
        }
      } catch (error) {
        console.error('[Return] Error checking status:', error)
        setStatus('error')
        toast({
          title: 'Error',
          description: 'Failed to check verification status. Please try again.',
          variant: 'destructive'
        })
      }
    }

    // Start checking after 2 seconds (give webhook time to process)
    const timer = setTimeout(checkVerificationStatus, 2000)

    return () => clearTimeout(timer)
  }, [user, sessionId, attempts, supabase, flowController, router, toast])

  const handleContinue = async () => {
    if (!user) return

    try {
      // Mark step as complete (even if verification pending)
      await flowController.markStepComplete(user.id, 5)
      router.push('/onboarding/survey-intro')
    } catch (error) {
      console.error('[Return] Error continuing:', error)
      toast({
        title: 'Error',
        description: 'Failed to continue. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const handleRetry = () => {
    router.push('/onboarding/verification')
  }

  return (
    <OnboardingLayout currentStep={5}>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            {status === 'checking' && (
              <>
                <div className="flex justify-center mb-4">
                  <Loader2 className="h-12 w-12 text-haevn-teal animate-spin" />
                </div>
                <CardTitle className="text-2xl">Checking verification status...</CardTitle>
                <CardDescription className="text-base">
                  This usually takes just a few moments. Please wait.
                </CardDescription>
              </>
            )}

            {status === 'approved' && (
              <>
                <div className="flex justify-center mb-4">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                <CardTitle className="text-2xl text-green-700">
                  Verification Successful!
                </CardTitle>
                <CardDescription className="text-base">
                  Your identity has been verified. Redirecting to survey...
                </CardDescription>
              </>
            )}

            {status === 'declined' && (
              <>
                <div className="flex justify-center mb-4">
                  <XCircle className="h-12 w-12 text-red-500" />
                </div>
                <CardTitle className="text-2xl text-red-700">
                  Verification Unsuccessful
                </CardTitle>
                <CardDescription className="text-base">
                  We were unable to verify your identity. Please try again or contact support.
                </CardDescription>
              </>
            )}

            {status === 'pending' && (
              <>
                <div className="flex justify-center mb-4">
                  <AlertCircle className="h-12 w-12 text-amber-500" />
                </div>
                <CardTitle className="text-2xl text-amber-700">
                  Verification Pending
                </CardTitle>
                <CardDescription className="text-base">
                  Your verification is still being processed. You'll be notified once it's complete.
                </CardDescription>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="flex justify-center mb-4">
                  <XCircle className="h-12 w-12 text-red-500" />
                </div>
                <CardTitle className="text-2xl text-red-700">
                  Error Checking Status
                </CardTitle>
                <CardDescription className="text-base">
                  Something went wrong. Please try again or contact support.
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {status === 'checking' && (
              <div className="text-center text-sm text-muted-foreground">
                <p className="mb-2">Checking with Veriff...</p>
                <p>Attempt {attempts + 1} of 20</p>
              </div>
            )}

            {(status === 'declined' || status === 'error') && (
              <div className="space-y-3">
                <Button
                  onClick={handleRetry}
                  className="w-full bg-haevn-teal hover:opacity-90"
                  size="lg"
                >
                  Try Verification Again
                </Button>
                <Button
                  onClick={handleContinue}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Continue Without Verification
                </Button>
              </div>
            )}

            {status === 'pending' && (
              <div className="space-y-3">
                <p className="text-sm text-center text-muted-foreground mb-4">
                  You can continue with the survey while we process your verification.
                  You'll receive an email once it's complete.
                </p>
                <Button
                  onClick={handleContinue}
                  className="w-full bg-haevn-teal hover:opacity-90"
                  size="lg"
                >
                  Continue to Survey
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </OnboardingLayout>
  )
}

// Wrap with Suspense to fix Next.js 15 useSearchParams requirement
export default function VerificationReturnPage() {
  return (
    <Suspense fallback={
      <OnboardingLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
        </div>
      </OnboardingLayout>
    }>
      <VerificationReturnContent />
    </Suspense>
  )
}
