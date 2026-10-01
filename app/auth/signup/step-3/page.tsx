'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/lib/auth/context'
import { previewSignupZip, saveSignupLocation } from '@/lib/actions/signupLocation'
import { AlertCircle, ChevronLeft } from 'lucide-react'
import { HaevnLoader } from '@/components/ui/haevn-loader'

// Every US ZIP is accepted: all markets are released. The lookup only fills in
// the city name; when it misses, the member types their city instead.
type ZipLookup = { status: 'idle' | 'checking' | 'missed' } | { status: 'found'; label: string }

export default function SignupStep3() {
  const router = useRouter()
  const { user } = useAuth()

  const [zipCode, setZipCode] = useState('')
  const [typedCity, setTypedCity] = useState('')
  const [lookup, setLookup] = useState<ZipLookup>({ status: 'idle' })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Check if user is authenticated
  useEffect(() => {
    if (!user) {
      // Redirect to step 2 if not logged in
      router.push('/auth/signup/step-2')
    }
  }, [user, router])

  // Resolve the city name for display once 5 digits are in
  useEffect(() => {
    setError('')
    if (zipCode.length !== 5) {
      setLookup({ status: 'idle' })
      return
    }
    let cancelled = false
    setLookup({ status: 'checking' })
    previewSignupZip(zipCode)
      .then((place) => {
        if (cancelled) return
        setLookup(place ? { status: 'found', label: `${place.city}, ${place.state}` } : { status: 'missed' })
      })
      .catch(() => { if (!cancelled) setLookup({ status: 'missed' }) })
    return () => { cancelled = true }
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

    setIsLoading(true)

    try {
      const result = await saveSignupLocation({ zip: zipCode, typedCity })

      if (!result.ok) {
        if (result.reason === 'city_required') {
          setLookup({ status: 'missed' })
          setError('Please enter your city to continue.')
        } else if (result.reason === 'invalid_zip') {
          setError('Please enter a valid 5-digit ZIP code')
        } else {
          setError('Something went wrong. Please try again.')
        }
        setIsLoading(false)
        return
      }

      // Navigate to phone number collection
      router.push('/auth/signup/step-4')
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  const needsCity = lookup.status === 'missed'
  const isValid =
    zipCode.length === 5 &&
    lookup.status !== 'checking' &&
    (!needsCity || typedCity.trim().length > 0)

  return (
    <div className="survey-layout min-h-screen flex flex-col bg-white">
      {/* Header with progress and back button */}
      <header className="pt-6 px-6">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-haevn-charcoal hover:text-haevn-navy transition-colors"
            style={{
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
            <div className="w-8 h-1 rounded-full bg-gray-200" />
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
              className="font-heading text-haevn-navy"
              style={{
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

          {/* Resolved city */}
          {lookup.status === 'found' && !error && (
            <Alert className="border-haevn-teal/50 bg-haevn-teal/10">
              <AlertDescription className="text-haevn-teal font-medium">
                ✓ {lookup.label}
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
                  letterSpacing: '0.1em'
                }}
                autoFocus
              />
              <p
                className="text-haevn-charcoal opacity-70 text-sm"
                style={{
                  fontSize: '12px'
                }}
              >
                5-digit US ZIP code
              </p>
            </div>

            {needsCity && (
              <div className="space-y-2">
                <Label
                  htmlFor="city"
                  className="text-haevn-charcoal"
                  style={{
                    fontWeight: 500,
                    fontSize: '14px'
                  }}
                >
                  City
                </Label>
                <Input
                  id="city"
                  type="text"
                  autoComplete="address-level2"
                  maxLength={80}
                  value={typedCity}
                  onChange={(e) => setTypedCity(e.target.value)}
                  placeholder="Your city or town"
                  className="h-12 text-base"
                />
                <p
                  className="text-haevn-charcoal opacity-70 text-sm"
                  style={{
                    fontSize: '12px'
                  }}
                >
                  We couldn&apos;t look up that ZIP. Tell us your city instead.
                </p>
              </div>
            )}
          </form>
        </div>
      </main>

      {/* Bottom-fixed CTA */}
      <footer className="pb-8 px-6">
        <Button
          onClick={handleContinue}
          disabled={!isValid || isLoading}
          className="w-full max-w-md mx-auto block bg-haevn-orange hover:bg-haevn-orange/90 text-white rounded-full h-14 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontWeight: 500,
            fontSize: '18px'
          }}
        >
          {isLoading ? (
            <>
              <HaevnLoader size={20} className="mr-2" />
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
