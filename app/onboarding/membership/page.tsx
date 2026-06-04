'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { getClientOnboardingFlowController } from '@/lib/onboarding/client-flow'
import { useToast } from '@/hooks/use-toast'

type PlanId = 'free' | 'plus_6' | 'plus_12'

/** Benefits shared by both HAEVN+ products. */
const PLUS_BENEFITS = [
  'View full match profiles',
  'Connect and message your matches',
  'See detailed compatibility breakdowns',
  'Access meetup recommendations',
  'Ready to Meet signals',
]

interface PlanCard {
  id: PlanId
  name: string
  badge?: string
  price: string
  priceSub: string
  note?: string
  features: string[]
  cta: string
  emphasized?: boolean
}

const PLANS: PlanCard[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceSub: 'Forever',
    features: [
      'See your match count and compatibility scores',
      'Build your profile and add photos',
      'Upgrade anytime to unlock full access',
    ],
    cta: 'Continue with Free',
  },
  {
    id: 'plus_6',
    name: 'HAEVN+',
    badge: 'Most Popular',
    price: '$199',
    priceSub: 'for 6 months',
    note: 'One-time payment',
    features: PLUS_BENEFITS,
    cta: 'Get HAEVN+ 6 Months',
    emphasized: true,
  },
  {
    id: 'plus_12',
    name: 'HAEVN+ Annual',
    badge: 'Best Value',
    price: '$299',
    priceSub: 'for 12 months',
    note: 'One-time payment · Save $99',
    features: PLUS_BENEFITS,
    cta: 'Get HAEVN+ 12 Months',
  },
]

export default function MembershipPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const flowController = getClientOnboardingFlowController()
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) router.push('/auth/login')
  }, [user, authLoading, router])

  const handleSelectPlan = async (plan: PlanId) => {
    if (!user || loadingPlan) return
    setLoadingPlan(plan)

    try {
      // Free → mark membership step (7) complete and continue to verification.
      if (plan === 'free') {
        await flowController.markStepComplete(user.id, 7)
        toast({
          title: 'Welcome to HAEVN',
          description: 'You can upgrade anytime from your dashboard.',
        })
        setTimeout(() => router.push('/onboarding/verification'), 400)
        return
      }

      // Paid plan → create a Lemonsqueezy checkout and redirect to pay.
      const res = await fetch('/api/lemonsqueezy/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()

      if (res.ok && data.checkoutUrl) {
        // Mark the step complete before leaving for hosted checkout. The tier
        // flip happens server-side via the webhook once payment clears.
        await flowController.markStepComplete(user.id, 7)
        window.location.href = data.checkoutUrl
        return
      }

      toast({
        title: 'Unable to start checkout',
        description: data.error || 'Please try again.',
        variant: 'destructive',
      })
      setLoadingPlan(null)
    } catch (error) {
      console.error('[Membership] checkout error:', error)
      toast({
        title: 'Something went wrong',
        description: 'Please try again.',
        variant: 'destructive',
      })
      setLoadingPlan(null)
    }
  }

  return (
    <div className="survey-layout min-h-screen flex flex-col items-center justify-center p-6 bg-haevn-cream">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="mb-10">
          <h1
            className="font-heading text-haevn-navy mb-3"
            style={{
              fontWeight: 700,
              fontSize: '36px',
              lineHeight: '100%',
              letterSpacing: '-0.015em',
              textAlign: 'left',
            }}
          >
            Choose your membership
          </h1>
          <p
            className="text-haevn-charcoal"
            style={{ fontWeight: 300, fontSize: '18px', lineHeight: '120%' }}
          >
            HAEVN+ is a one-time payment for full access — no recurring
            subscription. Pick the length that works for you.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-6 md:grid-cols-3 md:items-stretch">
          {PLANS.map((plan) => {
            const isLoading = loadingPlan === plan.id
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl bg-white p-8 shadow-sm transition-all ${
                  plan.emphasized
                    ? 'border-2 border-haevn-orange shadow-md md:-mt-2 md:mb-2'
                    : 'border border-gray-100'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-8">
                    <span
                      className={`rounded-full px-4 py-1 text-white ${
                        plan.emphasized ? 'bg-haevn-orange' : 'bg-haevn-teal'
                      }`}
                      style={{ fontWeight: 500, fontSize: '12px' }}
                    >
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Name */}
                <h3
                  className="font-heading text-haevn-navy mb-1"
                  style={{
                    fontWeight: 700,
                    fontSize: '24px',
                    lineHeight: '100%',
                    letterSpacing: '-0.015em',
                  }}
                >
                  {plan.name}
                </h3>

                {/* Price */}
                <div className="mb-1 mt-4 flex items-baseline gap-2">
                  <span
                    className="text-haevn-navy"
                    style={{ fontWeight: 700, fontSize: '40px', lineHeight: '100%' }}
                  >
                    {plan.price}
                  </span>
                  <span
                    className="text-haevn-charcoal"
                    style={{ fontWeight: 300, fontSize: '14px' }}
                  >
                    {plan.priceSub}
                  </span>
                </div>
                <p
                  className="mb-6 min-h-[18px] text-haevn-charcoal/70"
                  style={{ fontWeight: 400, fontSize: '13px' }}
                >
                  {plan.note || ' '}
                </p>

                {/* Features */}
                <ul className="mb-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-haevn-teal" />
                      <span
                        className="text-haevn-charcoal"
                        style={{ fontWeight: 300, fontSize: '14px', lineHeight: '120%' }}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA — pinned to bottom for even card heights */}
                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loadingPlan !== null}
                  className={`mt-auto w-full rounded-full ${
                    plan.emphasized
                      ? 'bg-haevn-orange text-white hover:opacity-90'
                      : 'border-2 border-haevn-navy bg-white text-haevn-navy hover:bg-haevn-cream'
                  }`}
                  size="lg"
                  style={{ fontWeight: 500, fontSize: '16px' }}
                >
                  {isLoading ? 'Processing…' : plan.cta}
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
