'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/lib/auth/context'
import { Loader2, AlertCircle, ChevronLeft } from 'lucide-react'

export default function SignupStep2() {
  const router = useRouter()
  const { signUp, signIn, user } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Load first name from localStorage
  useEffect(() => {
    const storedName = localStorage.getItem('haevn_signup_firstName')
    if (!storedName) {
      // Redirect back to step 1 if no first name
      router.push('/auth/signup/step-1')
      return
    }
    setFirstName(storedName)

    // Check if user is already logged in
    if (user) {
      router.push('/auth/signup/step-3')
    }
  }, [user, router])

  const handleBack = () => {
    router.push('/auth/signup/step-1')
  }

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) return

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)

    try {
      // Create Supabase account
      const { error: signUpError } = await signUp(email, password, {
        full_name: firstName
      })

      if (signUpError) {
        setError(signUpError.message)
        setIsLoading(false)
        return
      }

      // Auto-login after signup
      const { error: signInError } = await signIn(email, password)

      if (signInError) {
        setError('Account created but login failed. Please try signing in.')
        setIsLoading(false)
        return
      }

      // Store temp data
      localStorage.setItem('haevn_signup_email', email)

      // Navigate to step 3
      router.push('/auth/signup/step-3')
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  const isValid = email && password.length >= 6

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Back button */}
      <header className="pt-6 px-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-haevn-charcoal hover:text-haevn-navy transition-colors"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 500,
            fontSize: '14px'
          }}
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
      </header>

      {/* Main content - centered */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Heading */}
          <div className="space-y-3">
            <h1
              className="text-haevn-navy"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 700,
                fontSize: '32px',
                lineHeight: '120%',
                letterSpacing: '-0.015em'
              }}
            >
              Set up your account
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
              We'll never share this. Used only for login and verification.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleContinue} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-haevn-charcoal"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px'
                }}
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="h-12 text-base"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif'
                }}
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-haevn-charcoal"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px'
                }}
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
                className="h-12 text-base"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif'
                }}
              />
              <p
                className="text-haevn-charcoal opacity-70 text-sm"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontSize: '12px'
                }}
              >
                Minimum 6 characters
              </p>
            </div>
          </form>
        </div>
      </main>

      {/* Bottom-fixed CTA */}
      <footer className="pb-8 px-6">
        <Button
          onClick={handleContinue}
          disabled={!isValid || isLoading}
          className="w-full max-w-md mx-auto block bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-full h-14 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 500,
            fontSize: '18px'
          }}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </footer>
    </div>
  )
}
