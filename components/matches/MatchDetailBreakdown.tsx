'use client'

/**
 * Match Detail Breakdown Component
 *
 * Displays the 5-category compatibility breakdown for external matches.
 * Each category can be expanded to show a question-level SubScore breakdown.
 */

import { useState, useCallback, lazy, Suspense } from 'react'
import { ChevronDown } from 'lucide-react'
import type { CategoryScore } from '@/lib/matching'

const SubScoreBreakdown = lazy(() =>
  import('./SubScoreBreakdown').then(m => ({ default: m.SubScoreBreakdown }))
)

// Category configuration with labels and descriptions
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
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const toggleCategory = useCallback((key: string) => {
    setExpandedCategory(prev => (prev === key ? null : key))
  }, [])

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
          const isExpanded = expandedCategory === key
          const hasSubScores = categoryData?.subScores && categoryData.subScores.length > 0

          return (
            <div
              key={key}
              className="bg-white border border-haevn-gray-200 rounded-xl overflow-hidden"
            >
              {/* Category Header — clickable to expand */}
              <button
                type="button"
                className="w-full text-left p-4 hover:bg-haevn-lightgray/30 transition-colors"
                onClick={() => hasSubScores && toggleCategory(key)}
                aria-expanded={isExpanded}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
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
                    {hasSubScores && (
                      <ChevronDown
                        className={`h-4 w-4 text-haevn-charcoal/40 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </div>
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

                {/* Coverage indicator */}
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
              </button>

              {/* Expandable Sub-Score Panel */}
              {isExpanded && hasSubScores && (
                <div className="px-4 pb-4 border-t border-haevn-gray-200/60">
                  <Suspense
                    fallback={
                      <p className="text-xs text-haevn-charcoal/40 py-3 text-center">
                        Loading breakdown...
                      </p>
                    }
                  >
                    <SubScoreBreakdown
                      subScores={categoryData!.subScores}
                      categoryKey={key}
                    />
                  </Suspense>
                </div>
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
