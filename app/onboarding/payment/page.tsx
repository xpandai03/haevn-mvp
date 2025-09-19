'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { useAuth } from '@/lib/auth/context'
import { getOnboardingFlowController } from '@/lib/onboarding/flow'
import { CreditCard, Lock, Shield, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

function PaymentPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const flowController = getOnboardingFlowController()
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
    <OnboardingLayout currentStep={10}>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Secure Your Spot</CardTitle>
            <CardDescription className="text-base">
              Complete your {tierName} membership
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan Summary */}
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold">{tierName}</h3>
                  <p className="text-sm text-muted-foreground">Monthly subscription</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{tierPrice}</p>
                  <p className="text-xs text-muted-foreground">Billed monthly</p>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Cancel anytime</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Instant access to all features</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>30-day money-back guarantee</span>
                </div>
              </div>
            </div>

            {/* Payment Form (Placeholder) */}
            <Alert className="border-amber-200 bg-amber-50">
              <AlertDescription className="text-amber-900">
                <strong>Demo Mode:</strong> Payment integration will be added with Stripe in production.
                Click "Complete Payment" to simulate a successful transaction.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="card">Card Number</Label>
                <div className="relative">
                  <Input
                    id="card"
                    placeholder="4242 4242 4242 4242"
                    disabled={processing}
                    className="pl-10"
                  />
                  <CreditCard className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry Date</Label>
                  <Input
                    id="expiry"
                    placeholder="MM/YY"
                    disabled={processing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input
                    id="cvc"
                    placeholder="123"
                    disabled={processing}
                  />
                </div>
              </div>
            </div>

            {/* Security Badges */}
            <div className="flex items-center justify-center gap-6 py-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                <span>Secure checkout</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                <span>PCI compliant</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                Powered by Stripe
              </Badge>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handlePayment}
                className="w-full"
                size="lg"
                disabled={processing}
              >
                {processing ? 'Processing...' : `Complete Payment - ${tierPrice}`}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push('/onboarding/membership')}
                disabled={processing}
              >
                Back to membership options
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              By completing this payment, you agree to our Terms of Service and Privacy Policy.
              Payments are encrypted and handled securely. Cancel anytime.
            </p>
          </CardContent>
        </Card>
      </div>
    </OnboardingLayout>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentPageContent />
    </Suspense>
  )
}