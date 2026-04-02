'use client'

import { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'

interface SectionCompleteProps {
  sectionId: string
  sectionTitle: string
  sectionNumber: number
  totalSections: number
  onComplete?: () => void
}

export function SectionComplete({
  sectionId,
  sectionTitle,
  sectionNumber,
  totalSections,
  onComplete
}: SectionCompleteProps) {
  // Auto-advance after a brief moment
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete()
    }, 1200)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="flex flex-col items-center py-10">
      <CheckCircle2 className="h-12 w-12 text-[#008080] mb-4" />

      <p
        className="text-xl font-bold text-[#008080] mb-1"
        style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 700 }}
      >
        Section Complete
      </p>
      <p
        className="text-base text-haevn-charcoal/70"
        style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
      >
        {sectionTitle}
      </p>

      <p
        className="mt-4 text-sm text-haevn-charcoal/50"
        style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
      >
        {sectionNumber} of {totalSections} sections completed
      </p>
    </div>
  )
}
