'use client'

/**
 * Match Detail Breakdown — architectural reskin.
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

const CATEGORY_CONFIG: Record<string, { label: string; description: string }> = {
  intent: {
    label: 'Intent & Goals',
    description:
      'How well your relationship goals, timing, and expectations align with each other.',
  },
  structure: {
    label: 'Structure Fit',
    description:
      'How well your relationship setups line up, including orientation, boundaries, and safer-sex practices.',
  },
  connection: {
    label: 'Connection Style',
    description:
      'How you communicate, handle conflict, and connect emotionally with each other.',
  },
  chemistry: {
    label: 'Sexual Chemistry',
    description:
      'Your erotic alignment, roles, kinks, and sexual energy compatibility.',
  },
  lifestyle: {
    label: 'Lifestyle Fit',
    description:
      'How well your daily lives align — distance, social energy, and lifestyle preferences.',
  },
}

const CATEGORY_ORDER = [
  'intent',
  'structure',
  'connection',
  'chemistry',
  'lifestyle',
] as const

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

  const categoryMap = new Map<string, CategoryScore>()
  for (const cat of categories) {
    categoryMap.set(cat.category, cat)
  }

  const displayCategories = CATEGORY_ORDER.filter(
    key => key !== 'lifestyle' || lifestyleIncluded
  )

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
        Compatibility breakdown
      </p>

      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {displayCategories.map(key => {
          const categoryData = categoryMap.get(key)
          const config = CATEGORY_CONFIG[key]
          const score = categoryData?.score ?? 0
          const included = categoryData?.included ?? false
          const isExpanded = expandedCategory === key
          const hasSubScores =
            categoryData?.subScores && categoryData.subScores.length > 0

          return (
            <div
              key={key}
              className="bg-white border border-[color:var(--haevn-border)]"
            >
              {/* Header — clickable when expandable */}
              <button
                type="button"
                className="w-full text-left p-4 hover:bg-[color:var(--haevn-dash-surface-alt)] transition-colors"
                onClick={() => hasSubScores && toggleCategory(key)}
                aria-expanded={isExpanded}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-[color:var(--haevn-navy)] text-sm sm:text-base">
                      {config.label}
                    </span>
                    {hasSubScores && (
                      <ChevronDown
                        className={`h-4 w-4 text-[color:var(--haevn-muted-fg)] transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        strokeWidth={1.5}
                      />
                    )}
                  </div>
                  <span className="font-heading text-[color:var(--haevn-navy)] tabular-nums text-sm sm:text-base">
                    {Math.round(score)}%
                  </span>
                </div>

                {/* Bar — sharp, teal fill, no rounding */}
                <div className="w-full h-[3px] bg-[color:var(--haevn-border)] overflow-hidden mb-2">
                  <div
                    className="h-full bg-[color:var(--haevn-teal)] transition-all duration-500"
                    style={{ width: `${Math.round(score)}%` }}
                  />
                </div>

                <p className="text-xs text-[color:var(--haevn-muted-fg)] leading-relaxed">
                  {config.description}
                </p>

                {categoryData && categoryData.coverage < 0.5 && included && (
                  <p className="text-[10px] tracking-wide uppercase text-[color:var(--haevn-gold)] mt-2">
                    Limited data available
                  </p>
                )}
              </button>

              {isExpanded && hasSubScores && (
                <div className="px-4 pb-4 border-t border-[color:var(--haevn-border)]">
                  <Suspense
                    fallback={
                      <p className="text-xs text-[color:var(--haevn-muted-fg)] py-3 text-center">
                        Loading breakdown…
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

      {!lifestyleIncluded && (
        <p className="text-[11px] text-[color:var(--haevn-muted-fg)] text-center">
          Lifestyle compatibility not calculated due to incomplete data.
        </p>
      )}
    </div>
  )
}
