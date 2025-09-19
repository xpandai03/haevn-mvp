'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OnboardingLayout, EducationCard } from '@/components/onboarding/OnboardingLayout'
import { useAuth } from '@/lib/auth/context'
import { getOnboardingFlowController } from '@/lib/onboarding/flow'
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
  const { user } = useAuth()
  const { toast } = useToast()
  const flowController = getOnboardingFlowController()
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, router])

  const handleVerify = async () => {
    // Phase 2: This will open verification flow
    toast({
      title: 'Coming Soon',
      description: 'Verification will be available in Phase 2. You can skip for now.',
    })
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
            <CardTitle className="text-2xl">Verification keeps HAEVN real</CardTitle>
            <CardDescription className="text-base">
              Help us maintain a safe, authentic community
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

            <Alert className="border-amber-200 bg-amber-50">
              <AlertDescription className="text-amber-900">
                <strong>Phase 2 Feature:</strong> Verification will be fully implemented soon.
                For now, you can skip this step and continue with your survey.
              </AlertDescription>
            </Alert>

            <div className="pt-6 space-y-3">
              <Button
                onClick={handleVerify}
                className="w-full"
                size="lg"
                variant="outline"
                disabled
              >
                Verify Me (Coming Soon)
              </Button>

              <Button
                onClick={handleSkip}
                className="w-full"
                size="lg"
              >
                Skip for now — but you'll need this before connecting
              </Button>

              <button
                onClick={() => setShowDetails(true)}
                className="w-full text-sm text-primary hover:underline"
              >
                How verification works
              </button>
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