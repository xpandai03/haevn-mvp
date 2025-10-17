'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { InfoIcon, ChevronLeft, AlertCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAuth } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface MSAValidationResponse {
  valid: boolean
  msa_name?: string
  city?: string
  county?: string
  message?: string
}

export default function ZipCodePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [zipCode, setZipCode] = useState('')
  const [showInfoPopover, setShowInfoPopover] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [msaData, setMsaData] = useState<MSAValidationResponse | null>(null)

  const isFormValid = zipCode.length === 5 && /^\d+$/.test(zipCode) && msaData?.valid === true

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, router])

  const validateZipCode = async (zip: string) => {
    if (zip.length !== 5) {
      setValidationError(null)
      setMsaData(null)
      return
    }

    setIsValidating(true)
    setValidationError(null)

    try {
      const response = await fetch(`/api/msa-check?zip=${zip}`)
      const data: MSAValidationResponse = await response.json()

      setMsaData(data)

      if (!data.valid) {
        setValidationError(data.message || "We're currently available only in the Austin Metro Area.")
      } else {
        setValidationError(null)
        console.log('ZIP validated:', data)
      }
    } catch (error) {
      console.error('Error validating ZIP:', error)
      setValidationError('Unable to validate ZIP code. Please try again.')
      setMsaData(null)
    } finally {
      setIsValidating(false)
    }
  }

  const handleContinue = async () => {
    if (!isFormValid || !user || !msaData) return

    try {
      // Get partnership ID for current user
      const { data: partnership, error: partnershipError } = await supabase
        .from('partnerships')
        .select('id')
        .eq('primary_user_id', user.id)
        .single()

      if (partnershipError) throw partnershipError

      if (partnership) {
        // Save ZIP and MSA data to partnerships table
        const { error: updateError } = await supabase
          .from('partnerships')
          .update({
            zip_code: zipCode,
            msa_name: msaData.msa_name,
            city: msaData.city,
            county: msaData.county,
            updated_at: new Date().toISOString()
          })
          .eq('id', partnership.id)

        if (updateError) throw updateError

        console.log('Saved ZIP and MSA data:', { zipCode, ...msaData })
        router.push('/onboarding/relationship-styles')
      }
    } catch (error) {
      console.error('Error saving ZIP code:', error)
      toast({
        title: 'Error',
        description: 'Failed to save ZIP code. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5)
    setZipCode(value)
  }

  const handleZipCodeBlur = () => {
    if (zipCode.length === 5) {
      validateZipCode(zipCode)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-haevn-lightgray">
      {/* Progress bar */}
      <div className="w-full px-4 pt-6 pb-4">
        <div className="max-w-2xl mx-auto">
          <div className="w-full h-1 bg-white rounded-full overflow-hidden">
            <div
              className="h-full bg-haevn-gold rounded-full transition-all duration-500 ease-out"
              style={{ width: '30%' }}
              role="progressbar"
            />
          </div>
        </div>
      </div>

      {/* Back button */}
      <div className="w-full px-4 mb-8">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 p-2 text-haevn-navy hover:text-haevn-charcoal hover:bg-white/50 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium" style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}>
              Back
            </span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-lg p-8 lg:p-12">
          {/* Question with info icon */}
          <div className="flex items-start gap-3 mb-8">
            <h1
              className="text-3xl lg:text-4xl text-haevn-navy leading-tight"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 700,
                lineHeight: '100%',
                letterSpacing: '-0.015em',
                textAlign: 'left'
              }}
            >
              What's your ZIP code?
            </h1>

            <TooltipProvider>
              <Tooltip open={showInfoPopover} onOpenChange={setShowInfoPopover}>
                <TooltipTrigger asChild>
                  <button className="flex-shrink-0 p-1.5 text-haevn-teal hover:opacity-80 rounded-full transition-opacity mt-1">
                    <InfoIcon className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="max-w-xs p-4 bg-white border-haevn-teal">
                  <p className="text-sm text-haevn-charcoal leading-relaxed" style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300, lineHeight: '120%', textAlign: 'left' }}>
                    This helps us show you people nearby.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* ZIP code input */}
          <div className="mb-6">
            <input
              type="text"
              inputMode="numeric"
              value={zipCode}
              onChange={handleZipCodeChange}
              onBlur={handleZipCodeBlur}
              placeholder="78701"
              maxLength={5}
              className={`w-full px-4 py-3 bg-white border-2 rounded-xl text-base text-haevn-charcoal placeholder:text-haevn-charcoal/40 focus:outline-none focus:ring-2 transition-colors ${
                validationError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                  : msaData?.valid
                  ? 'border-haevn-teal focus:border-haevn-teal focus:ring-haevn-teal/20'
                  : 'border-haevn-navy focus:border-haevn-teal focus:ring-haevn-teal/20'
              }`}
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500
              }}
              disabled={isValidating}
            />

            {/* Validation loading state */}
            {isValidating && (
              <p className="mt-2 text-sm text-haevn-charcoal" style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}>
                Checking ZIP code...
              </p>
            )}

            {/* Error message */}
            {validationError && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p
                  className="text-sm text-red-700"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 400,
                    lineHeight: '120%'
                  }}
                >
                  {validationError}
                </p>
              </div>
            )}

            {/* Success message */}
            {msaData?.valid && !validationError && (
              <p
                className="mt-2 text-sm text-haevn-teal"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500
                }}
              >
                ✓ {msaData.city}, {msaData.county} County
              </p>
            )}
          </div>

          {/* Helper text */}
          <p
            className="text-sm text-haevn-charcoal mb-8"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              lineHeight: '120%',
              textAlign: 'left'
            }}
          >
            We'll only show your general area, not your exact location
          </p>

          {/* Continue button */}
          <Button
            onClick={handleContinue}
            disabled={!isFormValid}
            className="w-full px-8 py-6 bg-haevn-teal hover:opacity-90 text-white text-lg rounded-full transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-4 focus:ring-haevn-teal/30 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
          >
            Continue
          </Button>
        </div>
      </main>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 pb-6">
        <div className="w-2 h-2 rounded-full bg-haevn-gold"></div>
        <div className="w-2 h-2 rounded-full bg-haevn-gold"></div>
        <div className="w-2 h-2 rounded-full bg-haevn-gold"></div>
        <div className="w-2 h-2 rounded-full bg-haevn-gold"></div>
        <div className="w-2 h-2 rounded-full bg-haevn-gold"></div>
        <div className="w-2 h-2 rounded-full bg-haevn-gold"></div>
      </div>
    </div>
  )
}