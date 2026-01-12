'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/lib/auth/context'
import { updateProfile } from '@/lib/actions/profile'
import { checkCityStatus } from '@/lib/data/cities'
import { getClientOnboardingFlowController } from '@/lib/onboarding/client-flow'
import { Loader2, AlertCircle, ChevronLeft } from 'lucide-react'

export default function SignupStep3() {
  const router = useRouter()
  const { user } = useAuth()

  const [zipCode, setZipCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [detectedCity, setDetectedCity] = useState<string | null>(null)

  // Check if user is authenticated
  useEffect(() => {
    if (!user) {
      // Redirect to step 2 if not logged in
      router.push('/auth/signup/step-2')
    }
  }, [user, router])

  // Validate ZIP in real-time
  useEffect(() => {
    if (zipCode.length === 5) {
      const cityData = checkCityStatus(zipCode)
      if (cityData) {
        setDetectedCity(cityData.name)
        setError('')
      } else {
        setDetectedCity(null)
        setError('Sorry, HAEVN is not available in this area yet.')
      }
    } else {
      setDetectedCity(null)
      setError('')
    }
  }, [zipCode])

  const handleBack = () => {
    router.push('/auth/signup/step-2')
  }

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (zipCode.length !== 5) {
      setError('Please enter a valid 5-digit ZIP code')
      return
    }

    const cityData = checkCityStatus(zipCode)

    if (!cityData) {
      setError('Sorry, HAEVN is not available in this area yet.')
      return
    }

    setIsLoading(true)

    try {
      // Update profile with ZIP and city data
      const result = await updateProfile({
        city: cityData.name,
        msa_status: cityData.status
      })

      if (!result.success) {
        setError(result.error || 'Failed to update profile')
        setIsLoading(false)
        return
      }

      // Store city data in localStorage
      localStorage.setItem('haevn_city_data', JSON.stringify({
        city: cityData.name,
        cityStatus: cityData.status
      }))

      // Mark step complete via flow controller
      const flow = getClientOnboardingFlowController()
      await flow.markStepComplete('signup')

      // Clear temp signup data
      localStorage.removeItem('haevn_signup_firstName')
      localStorage.removeItem('haevn_signup_email')

      // Check for invite code
      const inviteCode = localStorage.getItem('haevn_invite_code')

      // Navigate based on invite presence
      if (inviteCode) {
        router.push('/onboarding/accept-invite')
      } else {
        router.push('/onboarding/expectations')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  const isValid = zipCode.length === 5 && detectedCity !== null

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
            disabled={isLoading}
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 rounded-full bg-haevn-teal" />
            <div className="w-8 h-1 rounded-full bg-haevn-teal" />
            <div className="w-8 h-1 rounded-full bg-haevn-teal" />
          </div>
          <div className="w-16" /> {/* Spacer for balance */}
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
              What's your ZIP code?
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
              This helps us connect you locally. We never show your exact location.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success indicator */}
          {detectedCity && !error && (
            <Alert className="border-haevn-teal/50 bg-haevn-teal/10">
              <AlertDescription className="text-haevn-teal font-medium">
                ✓ {detectedCity} - Available!
              </AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleContinue} className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="zipCode"
                className="text-haevn-charcoal"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px'
                }}
              >
                ZIP code
              </Label>
              <Input
                id="zipCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{5}"
                maxLength={5}
                value={zipCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  setZipCode(value)
                }}
                placeholder="00000"
                required
                className="h-12 text-base"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  letterSpacing: '0.1em'
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
                5-digit US ZIP code
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
              Saving...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </footer>
    </div>
  )
}
