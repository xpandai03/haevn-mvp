import Link from 'next/link'
import { Lock, Heart, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { OnboardingProgress } from './OnboardingProgress'

interface PartnerProgress {
  name: string
  pct: number
}

interface CompatibilityTeaserCardProps {
  locked: boolean
  overallScore?: number
  partnerProgress?: PartnerProgress[]
  message?: string
}

function getMatchLabel(score: number): string {
  if (score >= 85) return 'HIGH MATCH'
  if (score >= 70) return 'GOOD MATCH'
  if (score >= 50) return 'MODERATE MATCH'
  return 'LOW MATCH'
}

export function CompatibilityTeaserCard({
  locked,
  overallScore = 0,
  partnerProgress = [],
  message
}: CompatibilityTeaserCardProps) {
  if (locked) {
    return (
      <Card className="rounded-2xl border-haevn-navy/10 shadow-sm bg-gradient-to-br from-gray-50 to-gray-100/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-haevn-lightgray flex items-center justify-center flex-shrink-0">
              <Lock className="h-5 w-5 text-haevn-charcoal/50" />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className="text-sm font-semibold text-haevn-navy"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
              >
                Compatibility Locked
              </h3>
              <p
                className="text-xs text-haevn-charcoal/70 mt-0.5"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
              >
                {message || 'Complete onboarding to unlock results'}
              </p>
            </div>
          </div>

          {/* Compact partner progress */}
          {partnerProgress.length > 0 && (
            <div className="mt-3 pt-3 border-t border-haevn-navy/5">
              <div className="space-y-2">
                {partnerProgress.slice(0, 3).map((partner, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span
                      className="text-xs text-haevn-charcoal/70 w-20 truncate"
                      style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
                    >
                      {partner.name}
                    </span>
                    <div className="flex-1">
                      <OnboardingProgress
                        percentage={partner.pct}
                        size="sm"
                        showPercentage={false}
                      />
                    </div>
                    <span
                      className="text-xs text-haevn-charcoal/60 w-8 text-right"
                      style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
                    >
                      {partner.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Unlocked state - show score and CTA
  const matchLabel = getMatchLabel(overallScore)

  return (
    <Card className="rounded-2xl border-haevn-navy/10 shadow-sm overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Score circle */}
          <div className="w-16 h-16 rounded-full bg-haevn-teal/10 flex items-center justify-center flex-shrink-0">
            <div className="text-center">
              <span
                className="text-2xl font-bold text-haevn-teal block leading-none"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
              >
                {overallScore}%
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-haevn-teal" />
              <h3
                className="text-sm font-semibold text-haevn-navy"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
              >
                Compatibility Results
              </h3>
            </div>
            <p
              className="text-xs font-medium text-green-600 mt-0.5"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              {matchLabel}
            </p>
            <p
              className="text-xs text-haevn-charcoal/60 mt-0.5"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              Strong alignment across core categories
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="mt-3 pt-3 border-t border-haevn-navy/5">
          <Link href="/dashboard/compatibility">
            <Button
              variant="ghost"
              className="w-full justify-between text-haevn-teal hover:text-haevn-teal hover:bg-haevn-teal/5 h-9 px-3"
            >
              <span
                className="text-sm font-medium"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
              >
                View Compatibility Details
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
