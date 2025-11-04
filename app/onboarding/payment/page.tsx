'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth/context'
import { getClientOnboardingFlowController } from '@/lib/onboarding/flow'
import { CreditCard, Lock, Shield, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

function PaymentPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const flowController = getClientOnboardingFlowController()
  const [processing, setProcessing] = useState(false)

  // Get the selected tier from query params
  const selectedTier = searchParams.get('tier') || 'plus'
  const tierPrice = selectedTier === 'select' ? '$49.99/month' : '$19.99/month'
  const tierName = selectedTier === 'select' ? 'HAEVN Select' : 'HAEVN+'

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, router])

  const handlePayment = async () => {
    if (!user) return

    setProcessing(true)

    try {
      // Simulate payment processing
      // In production, this would integrate with Stripe
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Mark payment complete
      await flowController.markStepComplete(user.id, 10)

      toast({
        title: 'Payment successful!',
        description: `Welcome to ${tierName}!`,
      })

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (error) {
      console.error('Payment error:', error)
      toast({
        title: 'Payment failed',
        description: 'There was an error processing your payment. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-haevn-lightgray">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-3xl p-8 shadow-sm">
          {/* Header */}
          <div className="mb-8">
            <h1
              className="text-haevn-navy mb-3"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 700,
                fontSize: '32px',
                lineHeight: '100%',
                letterSpacing: '-0.015em',
                textAlign: 'left'
              }}
            >
              Secure your spot
            </h1>
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
              Complete your {tierName} membership
            </p>
          </div>

          <div className="space-y-6">
            {/* Plan Summary */}
            <div className="p-4 rounded-2xl bg-haevn-gold/10 border border-haevn-gold/20">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3
                    className="text-haevn-navy"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 500,
                      fontSize: '18px',
                      textAlign: 'left'
                    }}
                  >
                    {tierName}
                  </h3>
                  <p
                    className="text-haevn-charcoal"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 300,
                      fontSize: '14px',
                      textAlign: 'left'
                    }}
                  >
                    Monthly subscription
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className="text-haevn-navy"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 700,
                      fontSize: '28px',
                      lineHeight: '100%'
                    }}
                  >
                    {tierPrice}
                  </p>
                  <p
                    className="text-haevn-charcoal"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 300,
                      fontSize: '12px'
                    }}
                  >
                    Billed monthly
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-haevn-gold/20">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-haevn-teal" />
                  <span
                    className="text-haevn-charcoal"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 300,
                      fontSize: '14px'
                    }}
                  >
                    Cancel anytime
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-haevn-teal" />
                  <span
                    className="text-haevn-charcoal"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 300,
                      fontSize: '14px'
                    }}
                  >
                    Instant access to all features
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-haevn-teal" />
                  <span
                    className="text-haevn-charcoal"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 300,
                      fontSize: '14px'
                    }}
                  >
                    30-day money-back guarantee
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Form (Placeholder) */}
            <Alert className="border-haevn-gold bg-haevn-gold/10 rounded-xl">
              <AlertDescription
                className="text-haevn-navy"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  fontSize: '14px',
                  lineHeight: '120%'
                }}
              >
                <strong style={{ fontWeight: 500 }}>Demo mode:</strong> Payment integration will be added with Stripe in production.
                Click "Complete payment" to simulate a successful transaction.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="card"
                  className="text-haevn-navy"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px'
                  }}
                >
                  Card number
                </Label>
                <div className="relative">
                  <Input
                    id="card"
                    placeholder="4242 4242 4242 4242"
                    disabled={processing}
                    className="pl-10 border-haevn-navy rounded-xl"
                  />
                  <CreditCard className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-haevn-charcoal" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="expiry"
                    className="text-haevn-navy"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 500,
                      fontSize: '14px'
                    }}
                  >
                    Expiry date
                  </Label>
                  <Input
                    id="expiry"
                    placeholder="MM/YY"
                    disabled={processing}
                    className="border-haevn-navy rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="cvc"
                    className="text-haevn-navy"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 500,
                      fontSize: '14px'
                    }}
                  >
                    CVC
                  </Label>
                  <Input
                    id="cvc"
                    placeholder="123"
                    disabled={processing}
                    className="border-haevn-navy rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Security Badges */}
            <div className="flex items-center justify-center gap-6 py-4">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-haevn-teal" />
                <span
                  className="text-haevn-charcoal"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 300,
                    fontSize: '12px'
                  }}
                >
                  Secure checkout
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-haevn-teal" />
                <span
                  className="text-haevn-charcoal"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 300,
                    fontSize: '12px'
                  }}
                >
                  PCI compliant
                </span>
              </div>
              <span
                className="px-3 py-1 rounded-full bg-haevn-navy text-white"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '11px'
                }}
              >
                Powered by Stripe
              </span>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handlePayment}
                className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full"
                size="lg"
                disabled={processing}
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '18px'
                }}
              >
                {processing ? 'Processing...' : `Complete payment - ${tierPrice}`}
              </Button>

              <Button
                variant="outline"
                className="w-full bg-white hover:bg-haevn-lightgray text-haevn-navy border-2 border-haevn-navy rounded-full"
                onClick={() => router.push('/onboarding/membership')}
                disabled={processing}
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '16px'
                }}
              >
                Back to membership options
              </Button>
            </div>

            <p
              className="text-center text-haevn-charcoal opacity-70"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 300,
                fontSize: '12px',
                lineHeight: '120%'
              }}
            >
              By completing this payment, you agree to our Terms of Service and Privacy Policy.
              Payments are encrypted and handled securely. Cancel anytime.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentPageContent />
    </Suspense>
  )
}