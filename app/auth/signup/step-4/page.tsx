'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth/context'
import { getClientOnboardingFlowController } from '@/lib/onboarding/client-flow'
import { ChevronLeft } from 'lucide-react'

export default function SignupStep4() {
  const router = useRouter()
  const { user } = useAuth()

  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (!user) {
      router.push('/auth/signup/step-2')
    }
  }, [user, router])

  // Load previously stored phone if user navigates back
  useEffect(() => {
    const stored = localStorage.getItem('haevn_signup_phone')
    if (stored) {
      // Stored as E.164 (+1XXXXXXXXXX), convert back to display format
      const digits = stored.replace(/\D/g, '').slice(-10)
      setPhone(formatPhone(digits))
    }
  }, [])

  const handleBack = () => {
    router.push('/auth/signup/step-3')
  }

  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhone(formatPhone(digits))
  }

  const getDigits = (formatted: string) => formatted.replace(/\D/g, '')

  const isValid = getDigits(phone).length === 10

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    // Store as E.164 format for Twilio
    const e164 = `+1${getDigits(phone)}`
    localStorage.setItem('haevn_signup_phone', e164)

    // Clear temp signup data
    localStorage.removeItem('haevn_signup_firstName')
    localStorage.removeItem('haevn_signup_email')

    // Mark signup step complete
    const flow = getClientOnboardingFlowController()
    await flow.markStepComplete('signup')

    // Check for invite code
    const inviteCode = localStorage.getItem('haevn_invite_code')
    if (inviteCode) {
      router.push('/onboarding/accept-invite')
    } else {
      router.push('/onboarding/expectations')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header with progress and back button */}
      <header className="pt-6 px-6">
        <div className="flex items-center justify-between max-w-md mx-auto">
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
          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 rounded-full bg-haevn-teal" />
            <div className="w-8 h-1 rounded-full bg-haevn-teal" />
            <div className="w-8 h-1 rounded-full bg-haevn-teal" />
            <div className="w-8 h-1 rounded-full bg-haevn-teal" />
          </div>
          <div className="w-16" />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
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
              What's your phone number?
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
              We'll text you when you have new matches. We never share your number.
            </p>
          </div>

          <form onSubmit={handleContinue} className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="phone"
                className="text-haevn-charcoal"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px'
                }}
              >
                Phone number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(512) 555-1234"
                className="h-12 text-base"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif'
                }}
                autoFocus
              />
              <p
                className="text-haevn-charcoal opacity-70 text-sm"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontSize: '12px'
                }}
              >
                US mobile number — used for match notifications only
              </p>
            </div>
          </form>
        </div>
      </main>

      {/* Bottom-fixed CTA */}
      <footer className="pb-8 px-6">
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
      </footer>
    </div>
  )
}
