'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Check } from 'lucide-react'

const tiers = [
  {
    id: 'free',
    name: 'HAEVN Free',
    price: '$0',
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
    name: 'HAEVN+',
    price: '$19.99/month',
    description: 'Full access to connections',
    features: [
      'Unlimited matches',
      'Send likes and nudges',
      'Chat after handshake',
      'Share photos',
      'Advanced filters',
      'Priority support'
    ],
    limitations: []
  },
  {
    id: 'select',
    name: 'HAEVN Select',
    price: '$49.99/month',
    description: 'Premium concierge experience',
    features: [
      'Everything in HAEVN+',
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
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSelectTier = async (tierId: string) => {
    setSelectedTier(tierId)
    setLoading(true)

    // Update user data with selected tier
    const userData = localStorage.getItem('haevn_user')
    if (userData) {
      const user = JSON.parse(userData)
      user.membershipTier = tierId
      localStorage.setItem('haevn_user', JSON.stringify(user))
    }

    // For now, skip payment for non-free tiers (stub)
    if (tierId !== 'free') {
      // In production, redirect to Stripe checkout
      console.log('Would redirect to payment for:', tierId)
    }

    // Redirect to dashboard
    setTimeout(() => {
      router.push('/dashboard')
    }, 500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Choose Your Membership</h1>
          <p className="text-muted-foreground mt-2">
            Select the plan that works best for you
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <Card
              key={tier.id}
              className={`relative ${selectedTier === tier.id ? 'border-primary' : ''}`}
            >
              {tier.id === 'plus' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader>
                <CardTitle>{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="text-3xl font-bold mt-4">{tier.price}</div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-4">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {tier.limitations.length > 0 && (
                  <ul className="space-y-2 mb-4 opacity-60">
                    {tier.limitations.map((limitation) => (
                      <li key={limitation} className="flex items-start gap-2">
                        <span className="text-sm line-through">{limitation}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <Button
                  className="w-full"
                  variant={tier.id === 'plus' ? 'default' : 'outline'}
                  onClick={() => handleSelectTier(tier.id)}
                  disabled={loading}
                >
                  {loading && selectedTier === tier.id
                    ? 'Processing...'
                    : `Choose ${tier.name}`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}