/**
 * Match Detail Breakdown Component
 *
 * Displays the 5-category compatibility breakdown for external matches.
 * Uses the NEW category labels: Intent, Structure, Connection, Chemistry, Lifestyle
 */

import type { CategoryScore } from '@/lib/matching'

// Category configuration with NEW labels and descriptions
const CATEGORY_CONFIG: Record<string, { label: string; description: string }> = {
  intent: {
    label: 'Intent & Goals',
    description: 'How well your relationship goals, timing, and expectations align with each other.',
  },
  structure: {
    label: 'Structure Fit',
    description: "How well your relationship setups line up, including orientation, boundaries, and safer-sex practices.",
  },
  connection: {
    label: 'Connection Style',
    description: 'How you communicate, handle conflict, and connect emotionally with each other.',
  },
  chemistry: {
    label: 'Sexual Chemistry',
    description: 'Your erotic alignment, roles, kinks, and sexual energy compatibility.',
  },
  lifestyle: {
    label: 'Lifestyle Fit',
    description: 'How well your daily lives align - distance, social energy, and lifestyle preferences.',
  },
}

// Ordered list of categories (Lifestyle may be excluded)
const CATEGORY_ORDER = ['intent', 'structure', 'connection', 'chemistry', 'lifestyle'] as const

interface MatchDetailBreakdownProps {
  categories: CategoryScore[]
  lifestyleIncluded: boolean
  compact?: boolean
}

export function MatchDetailBreakdown({
  categories,
  lifestyleIncluded,
  compact = false,
}: MatchDetailBreakdownProps) {
  // Create a map for quick lookup
  const categoryMap = new Map<string, CategoryScore>()
  for (const cat of categories) {
    categoryMap.set(cat.category, cat)
  }

  // Filter categories to display
  const displayCategories = CATEGORY_ORDER.filter(
    key => key !== 'lifestyle' || lifestyleIncluded
  )

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <h3
        className="text-haevn-navy font-semibold"
        style={{
          fontFamily: 'Roboto, Helvetica, sans-serif',
          fontWeight: 600,
          fontSize: compact ? '14px' : '16px',
        }}
      >
        Compatibility Breakdown
      </h3>

      <div className={compact ? 'space-y-3' : 'space-y-4'}>
        {displayCategories.map(key => {
          const categoryData = categoryMap.get(key)
          const config = CATEGORY_CONFIG[key]
          const score = categoryData?.score ?? 0
          const included = categoryData?.included ?? false

          return (
            <div
              key={key}
              className="bg-white border border-haevn-gray-200 rounded-xl p-4"
            >
              {/* Category Header */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className="font-medium text-haevn-navy"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 500,
                    fontSize: compact ? '13px' : '14px',
                  }}
                >
                  {config.label}
                </span>
                <span
                  className="font-semibold text-haevn-charcoal"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 600,
                    fontSize: compact ? '13px' : '14px',
                  }}
                >
                  {Math.round(score)}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-haevn-lightgray rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-haevn-teal rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(score)}%` }}
                />
              </div>

              {/* Description */}
              <p
                className="text-haevn-charcoal/60"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 400,
                  fontSize: compact ? '11px' : '12px',
                  lineHeight: '1.4',
                }}
              >
                {config.description}
              </p>

              {/* Coverage indicator (optional, for low coverage) */}
              {categoryData && categoryData.coverage < 0.5 && included && (
                <p
                  className="text-amber-600 mt-1"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 400,
                    fontSize: '10px',
                  }}
                >
                  Limited data available for this category
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Lifestyle note if excluded */}
      {!lifestyleIncluded && (
        <p
          className="text-haevn-charcoal/50 text-center"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 400,
            fontSize: '11px',
          }}
        >
          Lifestyle compatibility not calculated due to incomplete data.
        </p>
      )}
    </div>
  )
}
