'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { getOnboardingFlowController } from '@/lib/onboarding/flow'
import { Heart, Users, Shield } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function WelcomePage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const flowController = getOnboardingFlowController()

  useEffect(() => {
    if (loading) return // Wait for auth to finish loading
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  const handleContinue = async () => {
    if (!user) return

    try {
      await flowController.markStepComplete(user.id, 3)
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-haevn-lightgray">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1
            className="text-haevn-navy mb-4"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700,
              fontSize: '36px',
              lineHeight: '100%',
              letterSpacing: '-0.015em'
            }}
          >
            Welcome to HAEVN
          </h1>
          <p
            className="text-haevn-charcoal"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              fontSize: '18px',
              lineHeight: '120%'
            }}
          >
            A safe space for intentional relationships and authentic connection.
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm space-y-6">
          {/* What Makes HAEVN Different */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-haevn-teal/10 flex items-center justify-center">
              <Heart className="h-5 w-5 text-haevn-teal" />
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
                Built for real relationships
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
                Whether you're solo, partnered, or exploring with others, HAEVN helps you find connections that honor your needs and boundaries.
              </p>
            </div>
          </div>

          {/* Community First */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-haevn-teal/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-haevn-teal" />
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
                Community, not just dating
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
                Connect with individuals, couples, and pods. Find dates, friends, play partners, or join workshops and events in your community.
              </p>
            </div>
          </div>

          {/* Safety & Authenticity */}
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
                Verified, safe, and private
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
                Every member is verified. Your privacy is protected. This is a space built on consent, respect, and authenticity.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-6"></div>

          {/* Next Step Teaser */}
          <div className="space-y-4">
            <h2
              className="text-haevn-navy"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500,
                fontSize: '20px',
                lineHeight: '120%',
                textAlign: 'center'
              }}
            >
              Next: Tell us who you are on HAEVN
            </h2>
            <p
              className="text-haevn-charcoal text-center"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 300,
                fontSize: '16px',
                lineHeight: '120%'
              }}
            >
              HAEVN welcomes individuals, couples, and groups (pods). We'll ask about your relationship structure and orientation to help you find compatible connections.
            </p>
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
              Let's Start
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
