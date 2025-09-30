'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { checkCityStatus } from '@/lib/data/cities'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import { getOnboardingFlowController } from '@/lib/onboarding/flow'
import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'

export default function SignupPage() {
  const router = useRouter()
  const { signUp, signIn } = useAuth()
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    zipCode: ''
  })
  const [cityInfo, setCityInfo] = useState<{ name: string; status: 'live' | 'waitlist' } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Check city status first
    const city = checkCityStatus(formData.zipCode)

    if (!city) {
      setError('Sorry, HAEVN is not available in your area yet.')
      setLoading(false)
      return
    }

    setCityInfo(city)

    try {
      // Create Supabase auth user with metadata
      const { data: signUpData, error: signUpError } = await signUp(
        formData.email,
        formData.password,
        {
          full_name: formData.name,
          city: city.name,
          zip_code: formData.zipCode,
          msa_status: city.status
        }
      )

      if (signUpError) {
        throw signUpError
      }

      // Store minimal data for onboarding flow
      localStorage.setItem('haevn_onboarding', JSON.stringify({
        city: city.name,
        cityStatus: city.status
      }))

      // Auto-login after signup
      const { data: signInData, error: signInError } = await signIn(formData.email, formData.password)

      if (signInError) {
        // If auto-login fails, still redirect to survey since account was created
        console.warn('Auto-login failed after signup:', signInError)
        toast({
          title: 'Account created!',
          description: 'Please sign in to continue.',
        })
        router.push('/auth/login')
      } else {
        // After successful login, ensure profile has city data
        // This is a workaround for the trigger not having access to metadata
        const { updateProfile } = await import('@/lib/actions/profile')
        await updateProfile({
          full_name: formData.name,
          city: city.name,
          msa_status: city.status
        })

        // Mark step 1 as complete
        // Use the user from signInData since we're logged in now
        const userId = signInData?.session?.user?.id || signUpData?.user?.id
        if (userId) {
          const flowController = getOnboardingFlowController()
          await flowController.markStepComplete(userId, 1)
        }

        toast({
          title: 'Welcome to HAEVN!',
          description: 'Let\'s get to know you better.',
        })

        // Redirect to expectations page (Step 1.5)
        router.push('/onboarding/expectations')
      }
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'Failed to create account')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-haevn-lightgray">
      <div className="w-full max-w-md">
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
            Create your account
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
            Let's get started with the basics.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label
                htmlFor="name"
                className="text-haevn-navy mb-2 block"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  textAlign: 'left'
                }}
              >
                What should we call you?
              </Label>
              <p
                className="text-haevn-charcoal opacity-70 mb-2"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  fontSize: '13px',
                  lineHeight: '120%',
                  textAlign: 'left'
                }}
              >
                First name or nickname is fine. This will be your username in the app.
              </p>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="border-haevn-navy rounded-xl"
              />
            </div>

            <div>
              <Label
                htmlFor="email"
                className="text-haevn-navy mb-2 block"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  textAlign: 'left'
                }}
              >
                Email
              </Label>
              <p
                className="text-haevn-charcoal opacity-70 mb-2"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  fontSize: '13px',
                  lineHeight: '120%',
                  textAlign: 'left'
                }}
              >
                We'll never share this. Used only for login and verification.
              </p>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="border-haevn-navy rounded-xl"
              />
            </div>

            <div>
              <Label
                htmlFor="password"
                className="text-haevn-navy mb-2 block"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  textAlign: 'left'
                }}
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="border-haevn-navy rounded-xl"
              />
            </div>

            <div>
              <Label
                htmlFor="zipCode"
                className="text-haevn-navy mb-2 block"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  textAlign: 'left'
                }}
              >
                ZIP code
              </Label>
              <p
                className="text-haevn-charcoal opacity-70 mb-2"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  fontSize: '13px',
                  lineHeight: '120%',
                  textAlign: 'left'
                }}
              >
                This helps us connect you locally. We never show your exact location.
              </p>
              <Input
                id="zipCode"
                type="text"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                required
                pattern="[0-9]{5}"
                placeholder="00000"
                className="border-haevn-navy rounded-xl"
              />
            </div>

            {error && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full mt-6"
              size="lg"
              disabled={loading}
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500,
                fontSize: '18px'
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Continue'
              )}
            </Button>

            <div
              className="text-center text-haevn-charcoal pt-4"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 300,
                fontSize: '14px'
              }}
            >
              Already have an account?{' '}
              <Link href="/auth/login" className="text-haevn-teal hover:underline font-medium">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}