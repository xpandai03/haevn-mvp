'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

function SignupStep1Form() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [firstName, setFirstName] = useState('')

  // Preserve invite code from URL if present
  useEffect(() => {
    const inviteCode = searchParams.get('invite')
    if (inviteCode) {
      localStorage.setItem('haevn_invite_code', inviteCode)
    }

    // Check if user already has a first name stored
    const storedName = localStorage.getItem('haevn_signup_firstName')
    if (storedName) {
      setFirstName(storedName)
    }
  }, [searchParams])

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()

    if (!firstName.trim()) return

    // Store first name temporarily
    localStorage.setItem('haevn_signup_firstName', firstName.trim())

    // Navigate to step 2
    router.push('/auth/signup/step-2')
  }

  const isValid = firstName.trim().length > 0

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Progress indicator */}
      <header className="pt-6 px-6 flex justify-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 rounded-full bg-haevn-teal" />
          <div className="w-8 h-1 rounded-full bg-gray-200" />
          <div className="w-8 h-1 rounded-full bg-gray-200" />
        </div>
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
                fontWeight: 500,
                fontSize: '28px',
                lineHeight: '120%',
                letterSpacing: '-0.01em'
              }}
            >
              What should we call you?
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
              First name or nickname is fine. This will be your username in the app.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleContinue} className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="firstName"
                className="text-haevn-charcoal"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px'
                }}
              >
                First name
              </Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. John"
                required
                className="h-12 text-base"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif'
                }}
                autoFocus
              />
            </div>
          </form>
        </div>
      </main>

      {/* Bottom-fixed CTA */}
      <footer className="pb-8 px-6 space-y-4">
        <Button
          onClick={handleContinue}
          disabled={!isValid}
          className="w-full max-w-md mx-auto block bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-full h-14 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 500,
            fontSize: '18px'
          }}
        >
          Continue
        </Button>

        {/* Sign in link */}
        <div className="text-center">
          <p
            className="text-haevn-charcoal"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 400,
              fontSize: '14px'
            }}
          >
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="text-haevn-teal hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </footer>
    </div>
  )
}

// Loading fallback
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
    </div>
  )
}

// Main export wrapped in Suspense
export default function SignupStep1() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SignupStep1Form />
    </Suspense>
  )
}
