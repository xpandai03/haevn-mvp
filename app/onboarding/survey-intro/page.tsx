'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { getOnboardingFlowController } from '@/lib/onboarding/flow'
import { useToast } from '@/hooks/use-toast'

export default function SurveyIntroPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const flowController = getOnboardingFlowController()

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, router])

  const handleStart = async () => {
    if (!user) return

    try {
      await flowController.markStepComplete(user.id, 6)
      router.push('/onboarding/survey')
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-haevn-lightgray">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-haevn-navy mb-4"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700,
              fontSize: '36px',
              lineHeight: '100%',
              letterSpacing: '-0.015em',
              textAlign: 'left'
            }}
          >
            Your relationship survey
          </h1>
          <p
            className="text-haevn-charcoal mb-3"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 500,
              fontSize: '18px',
              lineHeight: '120%',
              textAlign: 'left'
            }}
          >
            This is the foundation of HAEVN.
          </p>
          <p
            className="text-haevn-charcoal"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              fontSize: '16px',
              lineHeight: '120%',
              textAlign: 'left'
            }}
          >
            Your answers guide the connections we introduce you to. Take your time — your progress saves automatically.
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm space-y-6">
          {/* Key Points */}
          <div>
            <h3
              className="text-haevn-navy mb-4"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500,
                fontSize: '18px',
                lineHeight: '120%',
                textAlign: 'left'
              }}
            >
              Important to know:
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span
                  className="text-haevn-gold mt-1"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 700,
                    fontSize: '16px'
                  }}
                >
                  •
                </span>
                <span
                  className="text-haevn-charcoal"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 300,
                    fontSize: '16px',
                    lineHeight: '120%',
                    textAlign: 'left'
                  }}
                >
                  Your answers are private. We only use them to improve your matches.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="text-haevn-gold mt-1"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 700,
                    fontSize: '16px'
                  }}
                >
                  •
                </span>
                <span
                  className="text-haevn-charcoal"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 300,
                    fontSize: '16px',
                    lineHeight: '120%',
                    textAlign: 'left'
                  }}
                >
                  Progress saves automatically at each step.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="text-haevn-gold mt-1"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 700,
                    fontSize: '16px'
                  }}
                >
                  •
                </span>
                <span
                  className="text-haevn-charcoal"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 300,
                    fontSize: '16px',
                    lineHeight: '120%',
                    textAlign: 'left'
                  }}
                >
                  You can take breaks and return anytime.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="text-haevn-gold mt-1"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 700,
                    fontSize: '16px'
                  }}
                >
                  •
                </span>
                <span
                  className="text-haevn-charcoal"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 300,
                    fontSize: '16px',
                    lineHeight: '120%',
                    textAlign: 'left'
                  }}
                >
                  It's required. Without it, we can't make introductions.
                </span>
              </li>
            </ul>
          </div>

          {/* Start Button */}
          <div className="pt-4">
            <Button
              onClick={handleStart}
              className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full"
              size="lg"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500,
                fontSize: '18px'
              }}
            >
              Start the survey
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}