'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OnboardingLayout, EducationCard } from '@/components/onboarding/OnboardingLayout'
import { useAuth } from '@/lib/auth/context'
import { getClientOnboardingFlowController } from '@/lib/onboarding/client-flow'
import { ShieldCheck, Camera, CreditCard } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

export default function VerificationPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const flowController = getClientOnboardingFlowController()
  const [showDetails, setShowDetails] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    if (loading) return // Wait for auth to finish loading
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  const handleStartVerification = async () => {
    if (!user) return

    setIsStarting(true)

    try {
      console.log('[Verification] Starting Veriff session...')

      // Call API to create Veriff session
      const response = await fetch('/api/verify/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to start verification')
      }

      const data = await response.json()

      console.log('[Verification] Session created:', data.sessionId)

      // Store session ID in localStorage for return page
      localStorage.setItem('veriff_session_id', data.sessionId)

      // Redirect to Veriff hosted verification
      window.location.href = data.url
    } catch (error) {
      console.error('[Verification] Error starting verification:', error)
      toast({
        title: 'Error',
        description: 'Failed to start verification. Please try again.',
        variant: 'destructive'
      })
      setIsStarting(false)
    }
  }

  const handleSkip = async () => {
    if (!user) return

    try {
      // Mark this step as skipped
      await flowController.updateOnboardingState(user.id, {
        verificationSkipped: true
      })
      await flowController.markStepComplete(user.id, 5)

      // Navigate to next step
      router.push('/onboarding/survey-intro')
    } catch (error) {
      console.error('Error updating onboarding state:', error)
      toast({
        title: 'Error',
        description: 'Failed to save progress. Please try again.',
        variant: 'destructive'
      })
    }
  }

  return (
    <OnboardingLayout currentStep={5}>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Before we begin your survey...</CardTitle>
            <CardDescription className="text-base">
              We need to verify your identity to keep HAEVN safe and authentic for everyone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <EducationCard
              icon={<ShieldCheck className="h-5 w-5 text-primary" />}
              title="Every member is verified"
              description="This protects everyone — and makes sure you meet real people, not bots."
            />

            <EducationCard
              icon={<Camera className="h-5 w-5 text-primary" />}
              title="Two quick steps"
              description="1. Take a short selfie video (liveness check). 2. Upload your ID securely."
            />

            <EducationCard
              icon={<CreditCard className="h-5 w-5 text-primary" />}
              title="Your privacy is protected"
              description="Verification is handled by a trusted third-party provider. Your ID is encrypted and never shown to other members."
            />

            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-900">
                <strong>Live Verification:</strong> Powered by Veriff, the same technology trusted by global companies. Your ID is securely verified and never stored by HAEVN.
              </AlertDescription>
            </Alert>

            <div className="pt-6 space-y-3">
              <Button
                onClick={handleStartVerification}
                className="w-full bg-haevn-teal hover:opacity-90"
                size="lg"
                disabled={isStarting}
              >
                {isStarting ? 'Opening Verification...' : 'Start Verification'}
              </Button>

              <Button
                onClick={handleSkip}
                className="w-full"
                size="lg"
                variant="outline"
              >
                Skip for Now
              </Button>

              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => setShowDetails(true)}
                  className="text-sm text-primary hover:underline"
                >
                  How verification works
                </button>
                <a
                  href="/onboarding/verification/return"
                  className="text-sm text-muted-foreground hover:underline"
                >
                  I've completed verification
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verification Details Modal */}
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>How Verification Works</DialogTitle>
              <DialogDescription>
                HAEVN uses industry-standard verification to ensure authenticity
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-3">
                <p className="text-sm">
                  1. We match your selfie video with your profile photo to confirm liveness.
                </p>
                <p className="text-sm">
                  2. We check your government-issued ID to confirm authenticity and age.
                </p>
                <p className="text-sm">
                  3. Verification is powered by a secure third-party provider used by global brands.
                </p>
                <p className="text-sm">
                  4. Your ID is encrypted and never visible to other members.
                </p>
                <p className="text-sm">
                  5. HAEVN never stores your ID or personal verification data — it is handled only by our trusted provider.
                </p>
                <p className="text-sm font-semibold">
                  6. Once verified, you'll get a badge and unlock full access to introductions.
                </p>
              </div>
              <Button onClick={() => setShowDetails(false)} className="w-full">
                Got it
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </OnboardingLayout>
  )
}