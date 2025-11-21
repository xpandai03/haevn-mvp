'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { getClientOnboardingFlowController } from '@/lib/onboarding/client-flow'
import { Clock, Save, Shield } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'

export default function ExpectationsPage() {
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
      await flowController.markStepComplete(user.id, 2)
      // Route to new dating intentions page
      router.push('/onboarding/dating-intentions')
    } catch (error) {
      console.error('Error updating onboarding state:', error)
      toast({
        title: 'Error',
        description: 'Failed to save progress. Please try again.',
        variant: 'destructive'
      })
    }
  }

  // Get user's first name for personalization
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8 bg-white">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          {/* HAEVN Icon */}
          <div className="flex justify-center mb-4">
            <Image
              src="/images/haevn-logo-with-icon.png"
              alt="HAEVN"
              width={60}
              height={60}
              className="object-contain"
            />
          </div>

          <h1
            className="text-haevn-navy mb-4"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700,
              fontSize: '36px',
              lineHeight: '100%',
              letterSpacing: '-0.015em',
              textAlign: 'center'
            }}
          >
            Welcome to HAEVN, {firstName}!
          </h1>
          <p
            className="text-haevn-charcoal"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              fontSize: '18px',
              lineHeight: '120%',
              textAlign: 'center'
            }}
          >
            Before we begin, here's what to expect.
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
          {/* Info Item 1 */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-haevn-teal/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-haevn-teal" />
            </div>
            <div>
              <h3
                className="text-haevn-navy mb-2"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '18px',
                  lineHeight: '120%',
                  textAlign: 'left'
                }}
              >
                It takes about 10-15 minutes
              </h3>
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
                That's how long the full setup usually takes.
              </p>
            </div>
          </div>

          {/* Info Item 2 */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-haevn-teal/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-haevn-teal" />
            </div>
            <div>
              <h3
                className="text-haevn-navy mb-2"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '18px',
                  lineHeight: '120%',
                  textAlign: 'left'
                }}
              >
                Every step matters
              </h3>
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
                HAEVN is an intent-based matching platform. The process takes more time, but that's why it works.
              </p>
            </div>
          </div>

          {/* Info Item 3 */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-haevn-teal/10 flex items-center justify-center">
              <Save className="h-5 w-5 text-haevn-teal" />
            </div>
            <div>
              <h3
                className="text-haevn-navy mb-2"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '18px',
                  lineHeight: '120%',
                  textAlign: 'left'
                }}
              >
                You can come back anytime
              </h3>
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
                Your progress saves automatically. Finish at your own pace.
              </p>
            </div>
          </div>

          {/* Continue Button */}
          <div className="pt-6">
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
              I'm ready — Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}