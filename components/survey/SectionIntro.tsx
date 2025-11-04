'use client'

import { useEffect, useState } from 'react'
import { AnimatedIllustration } from './AnimatedIllustration'
import { getSectionAnimations } from '@/lib/survey/section-animations'

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
  const [isVisible, setIsVisible] = useState(false)
  const animations = getSectionAnimations(sectionId)

  useEffect(() => {
    // Fade in
    setTimeout(() => setIsVisible(true), 100)

    // Auto-complete after 2.5 seconds
    const timer = setTimeout(() => {
      if (onComplete) {
        onComplete()
      }
    }, 2500)

    return () => clearTimeout(timer)
  }, [onComplete])

  if (!animations) {
    // No animation for this section - skip intro
    useEffect(() => {
      if (onComplete) {
        onComplete()
      }
    }, [onComplete])
    return null
  }

  return (
    <div
      className={`flex flex-col items-center py-8 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Animation */}
      <div className="w-48 h-48 mb-6">
        <AnimatedIllustration
          src={animations.intro}
          loop={false}
          autoplay={true}
          className="w-full h-full"
        />
      </div>

      {/* Section Title */}
      <h2
        className="text-2xl sm:text-3xl font-bold text-haevn-charcoal text-center mb-2"
        style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 700 }}
      >
        {sectionTitle}
      </h2>

      {/* Section Description */}
      {sectionDescription && (
        <p
          className="text-base sm:text-lg text-haevn-charcoal/70 text-center max-w-md"
          style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}
        >
          {sectionDescription}
        </p>
      )}

      {/* Skip button (optional) */}
      <button
        onClick={onComplete}
        className="mt-6 text-sm text-haevn-navy/60 hover:text-haevn-teal transition-colors"
        style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
      >
        Skip animation
      </button>
    </div>
  )
}
