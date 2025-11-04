'use client'

import { useEffect, useState } from 'react'
import { AnimatedIllustration } from './AnimatedIllustration'
import { getSectionAnimations } from '@/lib/survey/section-animations'

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
  const [isVisible, setIsVisible] = useState(false)
  const animations = getSectionAnimations(sectionId)

  useEffect(() => {
    // Fade in
    setTimeout(() => setIsVisible(true), 100)

    // Auto-complete after 1.5 seconds (shorter for completion)
    const timer = setTimeout(() => {
      if (onComplete) {
        onComplete()
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [onComplete])

  if (!animations) {
    // No animation - skip
    useEffect(() => {
      if (onComplete) {
        onComplete()
      }
    }, [onComplete])
    return null
  }

  return (
    <div
      className={`flex flex-col items-center py-6 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Animation */}
      <div className="w-32 h-32 mb-4">
        <AnimatedIllustration
          src={animations.completion}
          loop={false}
          autoplay={true}
          className="w-full h-full"
          onComplete={onComplete}
        />
      </div>

      {/* Success Message */}
      <div className="text-center">
        <p
          className="text-xl sm:text-2xl font-bold text-haevn-teal mb-1"
          style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 700 }}
        >
          Section Complete!
        </p>
        <p
          className="text-base text-haevn-charcoal/70"
          style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
        >
          {sectionTitle}
        </p>
      </div>

      {/* Progress */}
      <p
        className="mt-4 text-sm text-haevn-charcoal/60"
        style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
      >
        {sectionNumber} of {totalSections} sections completed
      </p>
    </div>
  )
}
