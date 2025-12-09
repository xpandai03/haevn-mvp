import type { CompatibilityScores } from '@/lib/types/dashboard'

interface CategoryConfig {
  key: keyof CompatibilityScores['categories']
  label: string
  description: string
}

/**
 * Category configurations matching the 5-category matching engine
 */
const categoryConfigs: CategoryConfig[] = [
  {
    key: 'intent',
    label: 'Intent & Goals',
    description: 'How well your relationship goals, timing, and expectations align with each other.'
  },
  {
    key: 'structure',
    label: 'Structure Fit',
    description: "How well your relationship setups line up, including orientation, boundaries, and safer-sex practices."
  },
  {
    key: 'connection',
    label: 'Connection Style',
    description: 'How you communicate, handle conflict, and connect emotionally with each other.'
  },
  {
    key: 'chemistry',
    label: 'Sexual Chemistry',
    description: 'Your erotic alignment, roles, kinks, and sexual energy compatibility.'
  },
  {
    key: 'lifestyle',
    label: 'Lifestyle Fit',
    description: 'How well your daily lives align - distance, social energy, and lifestyle preferences.'
  }
]

interface CompatibilityBreakdownProps {
  scores: CompatibilityScores
  showDescriptions?: boolean
  compact?: boolean
}

export function CompatibilityBreakdown({
  scores,
  showDescriptions = true,
  compact = false
}: CompatibilityBreakdownProps) {
  // Filter out lifestyle if it's not included
  const displayCategories = categoryConfigs.filter(
    cat => cat.key !== 'lifestyle' || scores.lifestyleIncluded
  )

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <h4
        className="text-haevn-navy font-semibold"
        style={{
          fontFamily: 'Roboto, Helvetica, sans-serif',
          fontWeight: 600,
          fontSize: compact ? '14px' : '16px'
        }}
      >
        Compatibility Breakdown
      </h4>

      <div className={compact ? 'space-y-3' : 'space-y-4'}>
        {displayCategories.map((category) => {
          const score = scores.categories[category.key]

          return (
            <div key={category.key} className="space-y-1.5">
              {/* Category Header */}
              <div className="flex items-center justify-between">
                <span
                  className="font-medium text-haevn-navy"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 500,
                    fontSize: compact ? '13px' : '14px'
                  }}
                >
                  {category.label}
                </span>
                <span
                  className="font-semibold text-haevn-charcoal"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 600,
                    fontSize: compact ? '13px' : '14px'
                  }}
                >
                  {score}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-haevn-lightgray rounded-full overflow-hidden">
                <div
                  className="h-full bg-haevn-teal rounded-full transition-all duration-300"
                  style={{ width: `${score}%` }}
                />
              </div>

              {/* Description */}
              {showDescriptions && (
                <p
                  className="text-haevn-charcoal/60"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 400,
                    fontSize: compact ? '11px' : '12px',
                    lineHeight: '1.4'
                  }}
                >
                  {category.description}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
