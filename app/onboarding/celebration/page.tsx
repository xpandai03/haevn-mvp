'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { useAuth } from '@/lib/auth/context'
import { getOnboardingFlowController } from '@/lib/onboarding/flow'
import { CheckCircle2, Sparkles, Users, Calendar, BookOpen } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import confetti from 'canvas-confetti'

export default function CelebrationPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const flowController = getOnboardingFlowController()

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Trigger confetti animation
    const duration = 3000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)
      // Since particles fall down, start a bit higher than random
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      })
    }, 250)

    return () => clearInterval(interval)
  }, [user, router])

  const handleContinue = async () => {
    if (!user) return

    try {
      // Mark this step as complete
      await flowController.markStepComplete(user.id, 8)

      // Navigate to membership selection
      router.push('/onboarding/membership')
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
    <OnboardingLayout currentStep={8} showProgressBar={false}>
      <div className="max-w-2xl mx-auto">
        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <CheckCircle2 className="h-16 w-16 text-primary" />
                <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-2 -right-2" />
              </div>
            </div>
            <CardTitle className="text-3xl">You're In!</CardTitle>
            <CardDescription className="text-base mt-2">
              <span className="text-lg font-semibold text-foreground block mb-2">
                Welcome to HAEVN
              </span>
              You've completed onboarding. Your profile, verification, and survey are all set.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* What's Unlocked */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <h3 className="font-semibold mb-3">What happens next:</h3>
              <p className="text-sm text-muted-foreground mb-3">
                We'll introduce you to matches based on your survey and orientation. You can
                explore your Dashboard to see connections, update your profile, and discover your
                community.
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm">Access to compatible matches</span>
                  <Badge variant="secondary" className="text-xs">After membership</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm">Community events</span>
                  <Badge variant="outline" className="text-xs">Phase 2</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span className="text-sm">Resources & guides</span>
                  <Badge variant="outline" className="text-xs">Phase 2</Badge>
                </div>
              </div>
            </div>

            {/* Success Message */}
            <div className="text-center space-y-2 py-4">
              <p className="text-sm text-muted-foreground">
                You've taken the first step toward meaningful connections.
              </p>
              <p className="text-sm font-medium">
                Let's choose your membership plan to unlock everything HAEVN has to offer.
              </p>
            </div>

            <Button
              onClick={handleContinue}
              className="w-full"
              size="lg"
            >
              Continue → Choose Your Plan
            </Button>
          </CardContent>
        </Card>
      </div>
    </OnboardingLayout>
  )
}