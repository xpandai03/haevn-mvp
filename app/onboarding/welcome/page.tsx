'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OnboardingLayout, EducationCard } from '@/components/onboarding/OnboardingLayout'
import { useAuth } from '@/lib/auth/context'
import { getOnboardingFlowController } from '@/lib/onboarding/flow'
import { ShieldCheck, Heart, Users, ClipboardCheck } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function WelcomePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const flowController = getOnboardingFlowController()

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, router])

  const handleContinue = async () => {
    if (!user) return

    try {
      // Mark this step as complete
      await flowController.markStepComplete(user.id, 3)

      // Navigate to next step
      router.push('/onboarding/identity')
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
    <OnboardingLayout currentStep={3}>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome to HAEVN</CardTitle>
            <CardDescription className="text-base">
              You've just created your account. Here's what comes next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <EducationCard
              icon={<ShieldCheck className="h-5 w-5 text-primary" />}
              title="Verification Matters"
              description="Every member is verified to keep HAEVN safe and real. You'll complete this soon."
            />

            <EducationCard
              icon={<Heart className="h-5 w-5 text-primary" />}
              title="Connection, Not Swiping"
              description="We don't do endless swipes. HAEVN uses compatibility and context to introduce you to people who actually fit your life."
            />

            <EducationCard
              icon={<Users className="h-5 w-5 text-primary" />}
              title="Designed for Modern Relationships"
              description="Couples, pods, and solo explorers are all welcome. You'll set your relationship context so matches reflect your reality."
            />

            <EducationCard
              icon={<ClipboardCheck className="h-5 w-5 text-primary" />}
              title="Introducing the Survey"
              description="Next, you'll complete HAEVN's detailed Relationship Survey. It's required, and it's how we understand your identity, intentions, and boundaries so we can make introductions that matter."
            />

            <div className="pt-6">
              <Button
                onClick={handleContinue}
                className="w-full"
                size="lg"
              >
                Got It — Let's Begin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </OnboardingLayout>
  )
}