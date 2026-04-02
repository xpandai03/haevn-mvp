'use client'

/**
 * SubScoreBreakdown — Question-Level Explainability
 *
 * Renders a detailed table of sub-scores within a single category.
 * Each row shows the component name, score, match quality badge,
 * and a plain-English explanation.
 *
 * Lazy-rendered: only mounts when the user expands a category.
 */

import { memo } from 'react'
import type { SubScore } from '@/lib/matching'
import {
  SUB_SCORE_LABELS,
  getMatchQuality,
  MATCH_QUALITY_CONFIG,
  type MatchQuality,
} from '@/lib/matching/constants/subScoreLabels'

interface SubScoreBreakdownProps {
  subScores: SubScore[]
  categoryKey: string
}

/** Score bar color based on match quality */
function getBarColor(quality: MatchQuality): string {
  switch (quality) {
    case 'exact': return 'bg-emerald-500'
    case 'close': return 'bg-amber-500'
    case 'mismatch': return 'bg-orange-500'
    case 'blocked': return 'bg-red-500'
    case 'no_data': return 'bg-gray-300'
  }
}

export const SubScoreBreakdown = memo(function SubScoreBreakdown({
  subScores,
  categoryKey,
}: SubScoreBreakdownProps) {
  if (!subScores || subScores.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic py-2">
        No detailed breakdown available for this category.
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {subScores.map((sub) => {
        const labelInfo = SUB_SCORE_LABELS[sub.key]
        const quality = getMatchQuality(sub.score, sub.matched)
        const config = MATCH_QUALITY_CONFIG[quality]
        const score = Math.round(sub.score)

        return (
          <div
            key={`${categoryKey}-${sub.key}`}
            className={`rounded-lg border px-3 py-2.5 ${config.borderColor} ${config.bgColor}`}
          >
            {/* Top row: label + badge + score */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span
                  className="font-medium text-haevn-navy block truncate"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 500,
                    fontSize: '13px',
                  }}
                >
                  {labelInfo?.label ?? sub.key}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.color} ${config.bgColor} border ${config.borderColor}`}
                  style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
                >
                  {config.label}
                </span>
                <span
                  className="font-semibold text-haevn-charcoal tabular-nums"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 600,
                    fontSize: '13px',
                    minWidth: '32px',
                    textAlign: 'right',
                  }}
                >
                  {sub.matched ? `${score}%` : '—'}
                </span>
              </div>
            </div>

            {/* Score bar */}
            {sub.matched && (
              <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getBarColor(quality)}`}
                  style={{ width: `${score}%` }}
                />
              </div>
            )}

            {/* Description or reason */}
            <p
              className="text-haevn-charcoal/60 mt-1"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 400,
                fontSize: '11px',
                lineHeight: '1.4',
              }}
            >
              {sub.reason || labelInfo?.description || 'Score based on your survey responses.'}
            </p>
          </div>
        )
      })}
    </div>
  )
})
