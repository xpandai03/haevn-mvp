'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { getClientOnboardingFlowController } from '@/lib/onboarding/flow'
import { useToast } from '@/hooks/use-toast'

const tiers = [
  {
    id: 'free',
    name: 'HAEVN Free',
    price: '$0',
    period: 'Forever',
    description: 'Get started with basic features',
    features: [
      'View compatibility scores',
      'Limited daily matches',
      'Basic profile'
    ],
    limitations: [
      'No messaging',
      'No photo sharing',
      'No advanced filters'
    ]
  },
  {
    id: 'plus',
    name: 'HAEVN Plus',
    price: '$19.99',
    period: 'per month',
    description: 'Full access to connections',
    features: [
      'Unlimited matches',
      'Send likes and nudges',
      'Chat after handshake',
      'Share photos',
      'Advanced filters',
      'Priority support'
    ],
    limitations: [],
    popular: true
  },
  {
    id: 'select',
    name: 'HAEVN Select',
    price: '$49.99',
    period: 'per month',
    description: 'Premium concierge experience',
    features: [
      'Everything in HAEVN Plus',
      'Verified badge',
      'Concierge matchmaking',
      'First access to new features',
      'Exclusive events',
      'Background verification'
    ],
    limitations: []
  }
]

export default function MembershipPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const flowController = getClientOnboardingFlowController()
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (authLoading) return // Wait for auth to finish loading
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  const handleSelectTier = async (tierId: string) => {
    if (!user) return

    setSelectedTier(tierId)
    setLoading(true)

    try {
      await flowController.markStepComplete(user.id, 9)

      if (tierId !== 'free') {
        router.push(`/onboarding/payment?tier=${tierId}`)
      } else {
        toast({
          title: 'Welcome to HAEVN Free!',
          description: 'You can upgrade anytime from your dashboard.',
        })
        setTimeout(() => {
          router.push('/dashboard')
        }, 500)
      }
    } catch (error) {
      console.error('Error updating membership:', error)
      toast({
        title: 'Error',
        description: 'Failed to update membership. Please try again.',
        variant: 'destructive'
      })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-haevn-lightgray">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="mb-10">
          <h1
            className="text-haevn-navy mb-3"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700,
              fontSize: '36px',
              lineHeight: '100%',
              letterSpacing: '-0.015em',
              textAlign: 'left'
            }}
          >
            Choose your membership
          </h1>
          <p
            className="text-haevn-charcoal"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              fontSize: '18px',
              lineHeight: '120%',
              textAlign: 'left'
            }}
          >
            Select the plan that works best for you. You can upgrade or cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative bg-white rounded-3xl p-8 shadow-sm transition-all ${
                selectedTier === tier.id ? 'ring-2 ring-haevn-teal' : ''
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-8">
                  <span
                    className="bg-haevn-gold text-white px-4 py-1 rounded-full"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 500,
                      fontSize: '12px'
                    }}
                  >
                    Most popular
                  </span>
                </div>
              )}

              {/* Tier Name */}
              <h3
                className="text-haevn-navy mb-2"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 700,
                  fontSize: '24px',
                  lineHeight: '100%',
                  letterSpacing: '-0.015em',
                  textAlign: 'left'
                }}
              >
                {tier.name}
              </h3>

              {/* Description */}
              <p
                className="text-haevn-charcoal mb-6"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  fontSize: '14px',
                  lineHeight: '120%',
                  textAlign: 'left'
                }}
              >
                {tier.description}
              </p>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-haevn-navy"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 700,
                      fontSize: '36px',
                      lineHeight: '100%'
                    }}
                  >
                    {tier.price}
                  </span>
                  <span
                    className="text-haevn-charcoal"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 300,
                      fontSize: '14px'
                    }}
                  >
                    {tier.period}
                  </span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-haevn-teal flex-shrink-0 mt-0.5" />
                    <span
                      className="text-haevn-charcoal"
                      style={{
                        fontFamily: 'Roboto, Helvetica, sans-serif',
                        fontWeight: 300,
                        fontSize: '14px',
                        lineHeight: '120%',
                        textAlign: 'left'
                      }}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Limitations */}
              {tier.limitations.length > 0 && (
                <ul className="space-y-2 mb-6 opacity-60">
                  {tier.limitations.map((limitation) => (
                    <li key={limitation} className="flex items-start gap-2">
                      <span
                        className="text-haevn-charcoal line-through"
                        style={{
                          fontFamily: 'Roboto, Helvetica, sans-serif',
                          fontWeight: 300,
                          fontSize: '13px',
                          lineHeight: '120%',
                          textAlign: 'left'
                        }}
                      >
                        {limitation}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* CTA Button */}
              <Button
                onClick={() => handleSelectTier(tier.id)}
                disabled={loading}
                className={`w-full rounded-full ${
                  tier.popular
                    ? 'bg-haevn-teal hover:opacity-90 text-white'
                    : 'bg-white hover:bg-haevn-lightgray text-haevn-navy border-2 border-haevn-navy'
                }`}
                size="lg"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '16px'
                }}
              >
                {loading && selectedTier === tier.id
                  ? 'Processing...'
                  : `Choose ${tier.name}`}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}