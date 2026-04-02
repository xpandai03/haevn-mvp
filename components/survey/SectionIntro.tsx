'use client'

import { useEffect } from 'react'

// Map section IDs to their display order
const SECTION_NUMBERS: Record<string, string> = {
  basic_demographics: '01',
  relationship_preferences: '02',
  communication_attachment: '03',
  lifestyle_values: '04',
  privacy_community: '05',
  intimacy_sexuality: '06',
  personal_expression: '07',
  personality_insights: '08',
}

interface SectionIntroProps {
  sectionId: string
  sectionTitle: string
  sectionDescription?: string
  onComplete?: () => void
}

export function SectionIntro({
  sectionId,
  sectionTitle,
  sectionDescription,
  onComplete
}: SectionIntroProps) {
  const sectionNumber = SECTION_NUMBERS[sectionId] || '00'

  // Auto-advance after a brief moment (just enough to register the section change)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete()
    }, 1200)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="flex flex-col items-center py-12">
      {/* Section number */}
      <div
        className="text-6xl sm:text-7xl font-bold text-[#008080]/20 mb-3"
        style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 700 }}
      >
        {sectionNumber}
      </div>

      {/* Section title */}
      <h2
        className="text-2xl sm:text-3xl font-bold text-haevn-charcoal text-center mb-2"
        style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 700 }}
      >
        {sectionTitle}
      </h2>

      {/* Description */}
      {sectionDescription && (
        <p
          className="text-base text-haevn-charcoal/60 text-center max-w-md"
          style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}
        >
          {sectionDescription}
        </p>
      )}

      {/* Skip link */}
      <button
        onClick={onComplete}
        className="mt-6 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Continue
      </button>
    </div>
  )
}
