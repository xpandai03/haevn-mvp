'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { checkCityStatus } from '@/lib/data/cities'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signUp, signIn, signOut, user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  // Detect invite code from URL params
  const inviteCode = searchParams.get('invite')
  const [hasInvite, setHasInvite] = useState(!!inviteCode)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    zipCode: ''
  })
  const [cityInfo, setCityInfo] = useState<{ name: string; status: 'live' | 'waitlist' } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showExistingUserPrompt, setShowExistingUserPrompt] = useState(false)

  // Store invite code in localStorage when detected
  useEffect(() => {
    if (inviteCode) {
      console.log('[Signup] Invite code detected:', inviteCode)
      localStorage.setItem('haevn_invite_code', inviteCode)
      setHasInvite(true)
    }
  }, [inviteCode])

  // Check for existing user session
  useEffect(() => {
    const checkExistingUser = async () => {
      if (authLoading) return // Wait for auth to load
      if (!user) {
        setShowExistingUserPrompt(false)
        return
      }

      console.log('[Signup] ===== EXISTING USER DETECTED =====')
      console.log('[Signup] User ID:', user.id)
      console.log('[Signup] Email:', user.email)

      // Show logout prompt instead of auto-redirecting
      setShowExistingUserPrompt(true)
    }

    checkExistingUser()
  }, [user, authLoading])

  const handleLogout = async () => {
    setLoading(true)
    try {
      await signOut()
      setShowExistingUserPrompt(false)
      toast({
        title: 'Logged out',
        description: 'You can now create a new account.',
      })
    } catch (error) {
      console.error('[Signup] Error logging out:', error)
      toast({
        title: 'Error',
        description: 'Failed to log out. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleContinueToOnboarding = async () => {
    if (!user) return

    // PHASE 3: Use API route instead of client-side getResumeStep()
    console.log('[Signup] Fetching resume path from API')

    try {
      const response = await fetch('/api/onboarding/resume-step', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('[Signup] API route returned error:', response.status)
        router.push('/dashboard')
        return
      }

      const data = await response.json()
      console.log('[Signup] Resume path from API:', data.resumePath)
      router.push(data.resumePath)
    } catch (error) {
      console.error('[Signup] Failed to fetch resume path:', error)
      router.push('/dashboard')
    }
  }

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
      console.log('[Signup Page] ===== STARTING SIGNUP =====')
      console.log('[Signup Page] Email:', formData.email)
      console.log('[Signup Page] Name:', formData.name)
      console.log('[Signup Page] City:', city.name)

      // Create Supabase auth user with metadata
      console.log('[Signup Page] Calling signUp...')
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
        console.error('[Signup Page] ❌ SignUp error:', signUpError)
        console.error('[Signup Page] Error code:', signUpError.code)
        console.error('[Signup Page] Error message:', signUpError.message)
        throw signUpError
      }

      console.log('[Signup Page] ✅ SignUp successful!')
      console.log('[Signup Page] New user ID:', signUpData?.user?.id)
      console.log('[Signup Page] New user email:', signUpData?.user?.email)
      console.log('[Signup Page] Session created:', !!signUpData?.session)

      // Store minimal data for onboarding flow
      console.log('[Signup Page] Storing onboarding data in localStorage...')
      localStorage.setItem('haevn_onboarding', JSON.stringify({
        city: city.name,
        cityStatus: city.status
      }))

      // Auto-login after signup
      console.log('[Signup Page] Calling signIn for auto-login...')
      const { data: signInData, error: signInError } = await signIn(formData.email, formData.password)

      if (signInError) {
        // If auto-login fails, still redirect to survey since account was created
        console.error('[Signup Page] ❌ Auto-login failed:', signInError)
        console.error('[Signup Page] Error code:', signInError.code)
        console.error('[Signup Page] Error message:', signInError.message)
        toast({
          title: 'Account created!',
          description: 'Please sign in to continue.',
        })
        router.push('/auth/login')
      } else {
        console.log('[Signup Page] ✅ Auto-login successful!')
        console.log('[Signup Page] Signed in user ID:', signInData?.session?.user?.id)
        console.log('[Signup Page] Signed in user email:', signInData?.session?.user?.email)
        console.log('[Signup Page] Session active:', !!signInData?.session)
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
          const flowController = getClientOnboardingFlowController()
          await flowController.markStepComplete(userId, 1)
        }

        toast({
          title: 'Welcome to HAEVN!',
          description: hasInvite ? 'Join your partner\'s account.' : 'Let\'s get to know you better.',
        })

        // Redirect based on invite presence
        if (hasInvite) {
          console.log('[Signup Page] Redirecting to accept-invite (invite code present)')
          router.push('/onboarding/accept-invite')
        } else {
          console.log('[Signup Page] Redirecting to expectations (no invite)')
          router.push('/onboarding/expectations')
        }
      }
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'Failed to create account')
      setLoading(false)
    }
  }

  // Show existing user prompt if user is logged in
  if (showExistingUserPrompt && user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-haevn-lightgray">
        <div className="w-full max-w-md">
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
              Already logged in
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
              You're currently signed in as <strong>{user.email}</strong>
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-sm space-y-4">
            <p className="text-haevn-charcoal mb-6">
              Would you like to continue with your onboarding, or log out to create a new account?
            </p>

            <Button
              onClick={handleContinueToOnboarding}
              className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full"
              size="lg"
              disabled={loading}
            >
              Continue to Onboarding
            </Button>

            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full rounded-full border-haevn-navy text-haevn-navy"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging out...
                </>
              ) : (
                'Log Out'
              )}
            </Button>
          </div>
        </div>
      </div>
    )
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
