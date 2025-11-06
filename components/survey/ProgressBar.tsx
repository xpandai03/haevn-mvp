'use client'

import { useEffect, useState } from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'
import { getSectionPrimaryColor, getSectionGlow } from '@/lib/theme/colors'
import type { SectionId } from '@/lib/theme/types'

interface ProgressBarProps {
  currentStep: number
  totalSteps: number
  completionPercentage: number
  sectionName: string
  sectionId: SectionId
  showPercentage?: boolean
}

export function ProgressBar({
  currentStep,
  totalSteps,
  completionPercentage,
  sectionName,
  sectionId,
  showPercentage = true
}: ProgressBarProps) {
  const [prevSectionId, setPrevSectionId] = useState<SectionId>(sectionId)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Detect section changes for smooth transitions
  useEffect(() => {
    if (prevSectionId !== sectionId) {
      setIsTransitioning(true)
      const timer = setTimeout(() => {
        setPrevSectionId(sectionId)
        setIsTransitioning(false)
      }, 350) // Match transition duration
      return () => clearTimeout(timer)
    }
  }, [sectionId, prevSectionId])

  // Get dynamic colors from theme system
  const primaryColor = getSectionPrimaryColor(sectionId)
  const glowColor = getSectionGlow(sectionId)

  // Determine if color is a gradient
  const isGradient = primaryColor.includes('gradient')

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Header with step info and completion percentage */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
            Step {currentStep} of {totalSteps}
          </p>
          <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            {sectionName}
          </p>
        </div>
        {showPercentage && (
          <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
            {completionPercentage}%
          </p>
        )}
      </div>

      {/* Dynamic progress bar with section-based colors */}
      <ProgressPrimitive.Root
        value={completionPercentage}
        className={cn(
          'relative h-1 sm:h-2 w-full overflow-hidden rounded-full',
          'bg-gray-200 dark:bg-gray-800',
          'shadow-inner'
        )}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            'h-full w-full flex-1',
            'transition-all duration-350 ease-out',
            isTransitioning && 'opacity-80'
          )}
          style={{
            transform: `translateX(-${100 - (completionPercentage || 0)}%)`,
            background: isGradient ? primaryColor : undefined,
            backgroundColor: !isGradient ? primaryColor : undefined,
            boxShadow: `0 0 12px ${glowColor}`,
            borderRadius: '9999px'
          }}
        />
      </ProgressPrimitive.Root>

      {/* Visual glow effect under progress bar */}
      <style jsx>{`
        @keyframes pulseGlow {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  )
}