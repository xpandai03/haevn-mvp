import { CompatibilityBreakdown } from '@/components/compatibility/CompatibilityBreakdown'
import type { CompatibilityScores } from '@/lib/types/dashboard'

interface InternalCompatibilityViewProps {
  scores: CompatibilityScores
}

function getMatchLabel(score: number): { label: string; className: string } {
  if (score >= 85) return { label: 'HIGH MATCH', className: 'text-green-600' }
  if (score >= 70) return { label: 'GOOD MATCH', className: 'text-haevn-teal' }
  if (score >= 50) return { label: 'MODERATE MATCH', className: 'text-yellow-600' }
  return { label: 'LOW MATCH', className: 'text-orange-500' }
}

export function InternalCompatibilityView({ scores }: InternalCompatibilityViewProps) {
  const { label: matchLabel, className: matchClassName } = getMatchLabel(scores.overall)

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Score Header Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="text-center">
          <p
            className="text-xs text-haevn-charcoal uppercase tracking-widest mb-3"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 500
            }}
          >
            Compatibility Score
          </p>
          <p
            className="text-6xl font-bold text-haevn-teal mb-2"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700
            }}
          >
            {scores.overall}%
          </p>
          <p
            className={`text-sm font-semibold uppercase tracking-wide ${matchClassName}`}
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 600
            }}
          >
            {matchLabel}
          </p>
          <p
            className="text-sm text-haevn-charcoal/60 mt-2"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 400
            }}
          >
            Strong Alignment Across Core Categories.
          </p>
        </div>
      </div>

      {/* Category Breakdown Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <CompatibilityBreakdown scores={scores} showDescriptions={true} />
      </div>

      {/* TODO marker for matching engine integration */}
      {/* TODO: Replace mock scores with real compatibility calculation from matching engine
          Integration point: lib/matching/calculateInternalCompatibility.ts
          The scores prop should come from: await calculateInternalCompatibility(partnershipId, partners) */}
    </div>
  )
}
