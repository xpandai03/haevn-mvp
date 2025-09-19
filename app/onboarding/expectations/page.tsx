'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OnboardingLayout, EducationCard } from '@/components/onboarding/OnboardingLayout'
import { useAuth } from '@/lib/auth/context'
import { getOnboardingFlowController } from '@/lib/onboarding/flow'
import { Clock, Save, Shield } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function ExpectationsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const flowController = getOnboardingFlowController()

  useEffect(() => {
    // Redirect if not authenticated
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, router])

  const handleContinue = async () => {
    if (!user) return

    try {
      // Mark this step as complete
      await flowController.markStepComplete(user.id, 2)

      // Navigate to next step
      router.push('/onboarding/welcome')
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
    <OnboardingLayout currentStep={2} showBackButton={false}>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Before we continue</CardTitle>
            <CardDescription className="text-base">
              Let's set some expectations about what comes next
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <EducationCard
              icon={<Clock className="h-5 w-5 text-primary" />}
              title="It takes about 10-15 minutes"
              description="That's how long the full setup usually takes."
            />

            <EducationCard
              icon={<Save className="h-5 w-5 text-primary" />}
              title="You can come back anytime"
              description="Your progress saves automatically. Finish at your own pace."
            />

            <EducationCard
              icon={<Shield className="h-5 w-5 text-primary" />}
              title="Every step matters"
              description="Completing the process is required for introductions. This is how we keep HAEVN safe and intentional."
            />

            <div className="pt-6">
              <Button
                onClick={handleContinue}
                className="w-full"
                size="lg"
              >
                I'm Ready — Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </OnboardingLayout>
  )
}