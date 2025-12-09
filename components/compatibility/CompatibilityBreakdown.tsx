import type { CompatibilityScores } from '@/lib/types/dashboard'

interface CategoryConfig {
  key: keyof CompatibilityScores['categories']
  label: string
  description: string
}

const categoryConfigs: CategoryConfig[] = [
  {
    key: 'goalsExpectations',
    label: 'Goals & Expectations',
    description: 'What each of you is looking for right now; dating, play, exploration, or something more defined.'
  },
  {
    key: 'structureFit',
    label: 'Structure Fit',
    description: "How well your relationship setups line up, whether you're solo, partnered, or part of a more complex structure."
  },
  {
    key: 'boundariesComfort',
    label: 'Boundaries & Comfort Levels',
    description: "What each person is open to, what each person isn't open to, and whether those limits work together."
  },
  {
    key: 'opennessCuriosity',
    label: 'Openness & Curiosity',
    description: 'How comfortable each of you is with trying new things, exploring different dynamics, or learning as you go.'
  },
  {
    key: 'sexualEnergy',
    label: 'Sexual Energy',
    description: 'The kind of sexual tone, pace, and vibe each of you naturally enjoys.'
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
        {categoryConfigs.map((category) => {
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
