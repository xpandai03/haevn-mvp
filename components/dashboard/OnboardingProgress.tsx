import { cn } from '@/lib/utils'
import type { OnboardingProgressProps } from '@/lib/types/dashboard'

export function OnboardingProgress({
  percentage,
  label,
  showPercentage = true,
  size = 'md'
}: OnboardingProgressProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage))

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4'
  }

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-1">
          {label && (
            <span
              className="text-sm text-haevn-charcoal"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500
              }}
            >
              {label}
            </span>
          )}
          {showPercentage && (
            <span
              className="text-sm text-haevn-charcoal"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500
              }}
            >
              {clampedPercentage}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full bg-haevn-lightgray rounded-full overflow-hidden',
          heightClasses[size]
        )}
      >
        <div
          className={cn(
            'h-full bg-haevn-teal rounded-full transition-all duration-300 ease-out',
            clampedPercentage === 100 && 'bg-green-500'
          )}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  )
}
