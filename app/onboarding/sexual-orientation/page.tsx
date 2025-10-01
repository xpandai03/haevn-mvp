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

const ORIENTATION_OPTIONS = [
  'Straight/Heterosexual',
  'Gay',
  'Lesbian',
  'Bisexual',
  'Pansexual',
  'Queer',
  'Asexual',
  'Demisexual',
  'Questioning',
  'Other'
]

export default function SexualOrientationPage() {
  const router = useRouter()
  const [selectedOrientations, setSelectedOrientations] = useState<string[]>([])
  const [customOrientation, setCustomOrientation] = useState('')
  const [showInfoPopover, setShowInfoPopover] = useState(false)

  const showCustomInput = selectedOrientations.includes('Other')
  const isFormValid = selectedOrientations.length > 0 && (!showCustomInput || customOrientation.trim())

  const toggleOrientation = (orientation: string) => {
    setSelectedOrientations(prev =>
      prev.includes(orientation)
        ? prev.filter(o => o !== orientation)
        : [...prev, orientation]
    )
  }

  const handleContinue = () => {
    if (isFormValid) {
      const orientations = showCustomInput
        ? [...selectedOrientations.filter(o => o !== 'Other'), customOrientation]
        : selectedOrientations
      console.log({ orientations })
      router.push('/onboarding/relationship-status')
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
              style={{ width: '20%' }}
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
          <div className="flex items-start gap-3 mb-4">
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
              How do you describe your sexual orientation?
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
                    Pick the label(s) that best fit you, use "other" or write your own if needed.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <p className="text-sm text-haevn-charcoal mb-6" style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300, lineHeight: '120%', textAlign: 'left' }}>
            Select all that apply
          </p>

          {/* Multi-select cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {ORIENTATION_OPTIONS.map((orientation) => (
              <button
                key={orientation}
                onClick={() => toggleOrientation(orientation)}
                className={`
                  relative p-4 rounded-2xl border-2 text-left transition-all duration-200
                  ${selectedOrientations.includes(orientation)
                    ? 'border-haevn-teal bg-white shadow-sm'
                    : 'border-haevn-navy bg-white hover:bg-haevn-lightgray/30'
                  }
                `}
              >
                <span className="text-base text-haevn-charcoal" style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}>
                  {orientation}
                </span>
                {selectedOrientations.includes(orientation) && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-haevn-teal flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Custom input */}
          {showCustomInput && (
            <div className="mb-6">
              <input
                type="text"
                value={customOrientation}
                onChange={(e) => setCustomOrientation(e.target.value)}
                placeholder="Describe your orientation"
                className="w-full px-4 py-3 bg-white border-2 border-haevn-navy rounded-xl text-base text-haevn-charcoal placeholder:text-haevn-charcoal/40 focus:outline-none focus:border-haevn-teal focus:ring-2 focus:ring-haevn-teal/20"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}
              />
            </div>
          )}

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
        <div className="w-2 h-2 rounded-full bg-white"></div>
      </div>
    </div>
  )
}