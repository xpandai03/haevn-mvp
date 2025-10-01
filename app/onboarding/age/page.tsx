'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { InfoIcon, ChevronLeft } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export default function AgePage() {
  const router = useRouter()
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [year, setYear] = useState('')
  const [showInfoPopover, setShowInfoPopover] = useState(false)

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) => currentYear - 18 - i)

  const isFormValid = month && day && year

  const handleContinue = () => {
    if (isFormValid) {
      // TODO: Save age data
      console.log({ month, day, year })
      // Navigate to next step
      router.push('/onboarding/gender-identity')
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
              style={{ width: '5%' }}
              role="progressbar"
              aria-valuenow={5}
              aria-valuemin={0}
              aria-valuemax={100}
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
          {/* Question with info icon - LEFT ALIGNED */}
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
              How old are you?
            </h1>

            <TooltipProvider>
              <Tooltip open={showInfoPopover} onOpenChange={setShowInfoPopover}>
                <TooltipTrigger asChild>
                  <button
                    className="flex-shrink-0 p-1.5 text-haevn-teal hover:opacity-80 rounded-full transition-opacity mt-1"
                    aria-label="More information"
                  >
                    <InfoIcon className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  className="max-w-xs p-4 bg-white border-haevn-teal"
                >
                  <p
                    className="text-sm text-haevn-charcoal leading-relaxed"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 300,
                      lineHeight: '120%',
                      textAlign: 'left'
                    }}
                  >
                    We use age only to confirm you're 18+ and to help match people in similar life stages.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Dropdowns */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger
                className="w-full px-4 py-3 bg-white border-2 border-haevn-navy rounded-xl text-base text-haevn-charcoal focus:outline-none focus:border-haevn-teal focus:ring-2 focus:ring-haevn-teal/20"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
              >
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m, idx) => (
                  <SelectItem
                    key={m}
                    value={String(idx + 1)}
                    style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
                  >
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={day} onValueChange={setDay}>
              <SelectTrigger
                className="w-full px-4 py-3 bg-white border-2 border-haevn-navy rounded-xl text-base text-haevn-charcoal focus:outline-none focus:border-haevn-teal focus:ring-2 focus:ring-haevn-teal/20"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
              >
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                {days.map((d) => (
                  <SelectItem
                    key={d}
                    value={String(d)}
                    style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
                  >
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={year} onValueChange={setYear}>
              <SelectTrigger
                className="w-full px-4 py-3 bg-white border-2 border-haevn-navy rounded-xl text-base text-haevn-charcoal focus:outline-none focus:border-haevn-teal focus:ring-2 focus:ring-haevn-teal/20"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
              >
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem
                    key={y}
                    value={String(y)}
                    style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
                  >
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Helper text - LEFT ALIGNED */}
          <p
            className="text-sm text-haevn-charcoal mb-8"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              lineHeight: '120%',
              textAlign: 'left'
            }}
          >
            You must be at least 18 years old to use HAEVN
          </p>

          {/* Continue button - Primary CTA uses TEAL per guidelines */}
          <Button
            onClick={handleContinue}
            disabled={!isFormValid}
            className="w-full px-8 py-6 bg-haevn-teal hover:opacity-90 active:opacity-80 text-white text-lg rounded-full transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-4 focus:ring-haevn-teal/30 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 500
            }}
          >
            Continue
          </Button>
        </div>
      </main>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 pb-6">
        <div className="w-2 h-2 rounded-full bg-haevn-gold"></div>
        <div className="w-2 h-2 rounded-full bg-white"></div>
        <div className="w-2 h-2 rounded-full bg-white"></div>
        <div className="w-2 h-2 rounded-full bg-white"></div>
        <div className="w-2 h-2 rounded-full bg-white"></div>
      </div>
    </div>
  )
}