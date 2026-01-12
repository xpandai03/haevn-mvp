'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { getClientOnboardingFlowController } from '@/lib/onboarding/client-flow'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function VerificationCompletePage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const flowController = getClientOnboardingFlowController()
  const [firstName, setFirstName] = useState<string>('')
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Get first name from user metadata
    const name = user.user_metadata?.full_name?.split(' ')[0] || 'there'
    setFirstName(name)
  }, [user, loading, router])

  const handleContinue = async () => {
    if (!user) return
    setIsNavigating(true)

    try {
      // Mark verification-complete step as done
      await flowController.markStepComplete(user.id, 5)
      router.push('/onboarding/survey-intro')
    } catch (error) {
      console.error('[VerificationComplete] Error continuing:', error)
      toast({
        title: 'Error',
        description: 'Failed to continue. Please try again.',
        variant: 'destructive'
      })
      setIsNavigating(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Main content - centered */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center space-y-8">
          {/* Success icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-3">
            <h1
              className="text-haevn-navy"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500,
                fontSize: '28px',
                lineHeight: '120%',
                letterSpacing: '-0.01em'
              }}
            >
              Thanks for verifying, {firstName}!
            </h1>
            <p
              className="text-haevn-charcoal"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: '140%'
              }}
            >
              You're now verified. Next up: Your Profile Builder - where we learn what you're looking for.
            </p>
          </div>
        </div>
      </main>

      {/* Bottom-fixed CTA */}
      <footer className="pb-8 px-6">
        <Button
          onClick={handleContinue}
          disabled={isNavigating}
          className="w-full max-w-md mx-auto block bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-full h-14 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 500,
            fontSize: '18px'
          }}
        >
          {isNavigating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin inline" />
              Loading...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </footer>
    </div>
  )
}
