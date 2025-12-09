import Link from 'next/link'
import { Heart, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { CompatibilityPreviewCardProps, CompatibilityCategoryDisplay } from '@/lib/types/dashboard'

// Category display configuration matching screenshot exactly
const categoryDisplayConfig: Omit<CompatibilityCategoryDisplay, 'score'>[] = [
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

function getMatchLabel(score: number): string {
  if (score >= 85) return 'HIGH MATCH'
  if (score >= 70) return 'GOOD MATCH'
  if (score >= 50) return 'MODERATE MATCH'
  return 'LOW MATCH'
}

function getMatchColor(score: number): string {
  if (score >= 85) return 'text-green-600'
  if (score >= 70) return 'text-haevn-teal'
  if (score >= 50) return 'text-yellow-600'
  return 'text-orange-500'
}

export function CompatibilityPreviewCard({ scores }: CompatibilityPreviewCardProps) {
  const matchLabel = getMatchLabel(scores.overall)
  const matchColor = getMatchColor(scores.overall)

  // Build category data with scores
  const categories: CompatibilityCategoryDisplay[] = categoryDisplayConfig.map(cat => ({
    ...cat,
    score: scores.categories[cat.key]
  }))

  return (
    <Card className="rounded-3xl border-haevn-navy/10 shadow-sm">
      <CardHeader>
        <CardTitle
          className="text-haevn-navy flex items-center gap-2"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 700
          }}
        >
          <Heart className="h-5 w-5 text-haevn-teal" />
          Compatibility Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score Section */}
        <div className="bg-haevn-lightgray rounded-2xl p-6 text-center">
          <p
            className="text-sm text-haevn-charcoal uppercase tracking-wider mb-2"
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
            className={`text-sm font-semibold uppercase tracking-wide ${matchColor}`}
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 600
            }}
          >
            {matchLabel}
          </p>
          <p
            className="text-xs text-haevn-charcoal/60 mt-2"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 400
            }}
          >
            Strong Alignment Across Core Categories.
          </p>
        </div>

        {/* Category Breakdown */}
        <div>
          <h4
            className="text-haevn-navy mb-4"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 600,
              fontSize: '16px'
            }}
          >
            Compatibility Breakdown
          </h4>

          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.key} className="space-y-1.5">
                {/* Category Header */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-sm font-medium text-haevn-navy"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 500
                    }}
                  >
                    {category.label}
                  </span>
                  <span
                    className="text-sm font-semibold text-haevn-charcoal"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 600
                    }}
                  >
                    {category.score}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-haevn-lightgray rounded-full overflow-hidden">
                  <div
                    className="h-full bg-haevn-teal rounded-full transition-all duration-300"
                    style={{ width: `${category.score}%` }}
                  />
                </div>

                {/* Description */}
                <p
                  className="text-xs text-haevn-charcoal/60"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 400
                  }}
                >
                  {category.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* View Full Button */}
        <div className="pt-2">
          <Link href="/compatibility">
            <Button
              className="w-full bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-xl"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500
              }}
            >
              View Full Compatibility
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>

        {/* TODO marker for matching engine integration */}
        {/* TODO: Replace mock scores with real compatibility calculation from matching engine
            Integration point: lib/matching/calculateCompatibility.ts
            The scores prop should come from: await getInternalCompatibility(partnershipId) */}
      </CardContent>
    </Card>
  )
}
