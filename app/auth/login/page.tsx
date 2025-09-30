'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const { signIn } = useAuth()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: signInData, error: signInError } = await signIn(email, password)

      if (signInError) {
        throw signInError
      }

      toast({
        title: 'Welcome back!',
        description: 'Successfully signed in to your account.',
      })

      // Check user's survey progress to determine redirect
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // Check survey completion
      const { data: surveyData } = await supabase
        .from('user_survey_responses')
        .select('completion_pct')
        .eq('user_id', signInData.session.user.id)
        .maybeSingle()

      // If survey incomplete or not started, redirect to survey
      if (!surveyData || surveyData.completion_pct < 100) {
        router.push('/onboarding/survey')
        return
      }

      // Check if membership selected
      const { data: onboardingState } = await supabase
        .from('user_onboarding_state')
        .select('membership_selected')
        .eq('user_id', signInData.session.user.id)
        .maybeSingle()

      if (onboardingState && !onboardingState.membership_selected) {
        router.push('/onboarding/membership')
        return
      }

      // Everything complete, go to dashboard
      router.push('/dashboard')
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Invalid email or password')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-haevn-lightgray">
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
            Welcome back
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
            Sign in to your HAEVN account.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
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
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
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
                  Signing in...
                </>
              ) : (
                'Sign in'
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
              Don't have an account?{' '}
              <Link href="/auth/signup" className="text-haevn-teal hover:underline font-medium">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}