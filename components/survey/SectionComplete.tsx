'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

interface SectionCompleteProps {
  sectionId: string
  sectionTitle: string
  sectionNumber: number
  totalSections: number
  onComplete?: () => void
}

export function SectionComplete({
  sectionTitle,
  sectionNumber,
  totalSections,
  onComplete,
}: SectionCompleteProps) {
  // Auto-advance after a short beat
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.()
    }, 1400)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-start py-20 space-y-5 text-left"
    >
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 flex items-center justify-center border border-[color:var(--haevn-teal)]">
          <Check
            className="w-4 h-4 text-[color:var(--haevn-teal)]"
            strokeWidth={2.5}
          />
        </span>
        <p className="text-xs tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
          Section complete
        </p>
      </div>
      <h2 className="font-heading text-2xl sm:text-3xl font-medium text-[color:var(--haevn-navy)] leading-tight">
        {sectionTitle}
      </h2>
      <p className="text-sm text-[color:var(--haevn-muted-fg)]">
        {sectionNumber} of {totalSections} sections complete
      </p>
    </motion.div>
  )
}
