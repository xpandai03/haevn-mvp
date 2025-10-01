'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { InfoIcon, ChevronLeft } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export default function ZipCodePage() {
  const router = useRouter()
  const [zipCode, setZipCode] = useState('')
  const [showInfoPopover, setShowInfoPopover] = useState(false)

  const isFormValid = zipCode.length === 5 && /^\d+$/.test(zipCode)

  const handleContinue = () => {
    if (isFormValid) {
      console.log({ zipCode })
      router.push('/onboarding/relationship-styles')
    }
  }

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5)
    setZipCode(value)
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
              placeholder="78701"
              maxLength={5}
              className="w-full px-4 py-3 bg-white border-2 border-haevn-navy rounded-xl text-base text-haevn-charcoal placeholder:text-haevn-charcoal/40 focus:outline-none focus:border-haevn-teal focus:ring-2 focus:ring-haevn-teal/20"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500
              }}
            />
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