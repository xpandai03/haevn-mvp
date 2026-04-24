'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'

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
  onComplete,
}: SectionIntroProps) {
  const sectionNumber = SECTION_NUMBERS[sectionId] || '00'

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.()
    }, 1600)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-start py-20 space-y-6 text-left"
    >
      <p className="text-xs tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
        Section {sectionNumber}
      </p>
      <h2 className="font-heading text-3xl sm:text-4xl font-medium text-[color:var(--haevn-navy)] leading-tight">
        {sectionTitle}
      </h2>
      {sectionDescription && (
        <p className="text-base text-[color:var(--haevn-muted-fg)] leading-relaxed max-w-xl">
          {sectionDescription}
        </p>
      )}
      <button
        onClick={onComplete}
        className="text-sm text-[color:var(--haevn-muted-fg)] hover:text-[color:var(--haevn-teal)] transition-colors mt-4"
      >
        Continue →
      </button>
    </motion.div>
  )
}
