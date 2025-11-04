'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { getClientOnboardingFlowController } from '@/lib/onboarding/client-flow'
import { CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function CelebrationPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const flowController = getClientOnboardingFlowController()

  useEffect(() => {
    if (loading) return // Wait for auth to finish loading
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  const handleContinue = async () => {
    if (!user) return

    try {
      await flowController.markStepComplete(user.id, 8)
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-haevn-lightgray">
      <div className="w-full max-w-2xl">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 rounded-full bg-haevn-teal/10 flex items-center justify-center">
            <CheckCircle2 className="h-12 w-12 text-haevn-teal" />
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-haevn-navy mb-4"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700,
              fontSize: '42px',
              lineHeight: '100%',
              letterSpacing: '-0.015em',
              textAlign: 'left'
            }}
          >
            You're all set!
          </h1>
          <p
            className="text-haevn-charcoal mb-6"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              fontSize: '18px',
              lineHeight: '120%',
              textAlign: 'left'
            }}
          >
            Your survey is complete. We'll use your responses to help you find compatible connections.
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm space-y-6 mb-6">
          <div>
            <h2
              className="text-haevn-navy mb-4"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500,
                fontSize: '20px',
                lineHeight: '120%',
                textAlign: 'left'
              }}
            >
              What happens next:
            </h2>
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
                  We'll review your responses to find people who share your values and relationship style.
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
                  You'll be able to explore your dashboard, update your profile, and see potential matches.
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
                  Choose a membership plan to unlock messaging and connect with others.
                </span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="pt-4">
            <Button
              onClick={handleContinue}
              className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full"
              size="lg"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500,
                fontSize: '18px'
              }}
            >
              Choose your membership
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}