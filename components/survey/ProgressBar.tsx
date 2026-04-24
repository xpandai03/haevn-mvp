'use client'

import { useEffect, useState } from 'react'
import type { SectionId } from '@/lib/theme/types'

interface ProgressBarProps {
  currentStep: number
  totalSteps: number
  completionPercentage: number
  sectionName: string
  sectionId: SectionId
  showPercentage?: boolean
}

/**
 * Architectural survey progress bar.
 *
 * Visual: a 2px teal fill pinned to the top of the viewport.
 * A minimal caption row (section name / step x of N / %) sits below the
 * bar only when rendered inline by the page layout.
 *
 * Props are unchanged from the previous implementation so the page layout
 * does not need to be touched.
 */
export function ProgressBar({
  currentStep,
  totalSteps,
  completionPercentage,
  sectionName,
  showPercentage = true,
}: ProgressBarProps) {
  const [mounted, setMounted] = useState(false)

  // Defer the fill until after mount so the initial transition animates.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const pct = Math.max(0, Math.min(100, completionPercentage || 0))

  return (
    <>
      {/* Fixed 2px bar at top of viewport */}
      <div
        className="survey-progress-fixed"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={sectionName ? `${sectionName} progress` : 'Survey progress'}
      >
        <span style={{ width: `${mounted ? pct : 0}%` }} />
      </div>

      {/* Inline caption (section name + step count + optional %).
          Rendered here so the existing page layout can place us wherever. */}
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          {sectionName && (
            <p className="text-[11px] sm:text-xs uppercase tracking-[0.14em] text-[color:var(--haevn-muted-fg)] truncate">
              {sectionName}
            </p>
          )}
          <p className="text-xs sm:text-sm text-[color:var(--haevn-charcoal)] mt-0.5">
            Step {currentStep} of {totalSteps}
          </p>
        </div>
        {showPercentage && (
          <p className="text-xs sm:text-sm tabular-nums text-[color:var(--haevn-muted-fg)]">
            {pct}%
          </p>
        )}
      </div>
    </>
  )
}
