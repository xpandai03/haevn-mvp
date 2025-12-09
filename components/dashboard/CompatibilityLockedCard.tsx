import { Lock, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OnboardingProgress } from './OnboardingProgress'
import type { CompatibilityLockedCardProps } from '@/lib/types/dashboard'

export function CompatibilityLockedCard({
  partners,
  userCompletion
}: CompatibilityLockedCardProps) {
  // Calculate overall progress across all partners
  const totalCompletion = partners.reduce((sum, p) => sum + p.onboardingCompletion, 0)
  const averageCompletion = partners.length > 0
    ? Math.round(totalCompletion / partners.length)
    : userCompletion

  // Count partners who need to complete
  const incompletePartners = partners.filter(p => p.status !== 'completed')

  return (
    <Card className="rounded-3xl border-haevn-navy/10 shadow-sm bg-gradient-to-br from-gray-50 to-gray-100">
      <CardHeader>
        <CardTitle
          className="text-haevn-navy flex items-center gap-2"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 700
          }}
        >
          <Lock className="h-5 w-5 text-haevn-charcoal/50" />
          Compatibility Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Locked Message */}
        <div className="text-center py-8">
          <div className="w-20 h-20 rounded-full bg-haevn-lightgray flex items-center justify-center mx-auto mb-4">
            <Lock className="h-10 w-10 text-haevn-charcoal/40" />
          </div>
          <h3
            className="text-lg font-semibold text-haevn-navy mb-2"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 600
            }}
          >
            Compatibility Locked
          </h3>
          <p
            className="text-sm text-haevn-charcoal/70 max-w-sm mx-auto"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 400
            }}
          >
            Compatibility results will unlock when all partners complete onboarding.
          </p>
        </div>

        {/* Partner Progress Summary */}
        {partners.length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-haevn-navy/5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-haevn-teal" />
              <span
                className="text-sm text-haevn-navy font-medium"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500
                }}
              >
                Partner Progress
              </span>
            </div>

            <div className="space-y-3">
              {partners.map((partner) => (
                <div key={partner.userId} className="flex items-center gap-3">
                  <span
                    className="text-xs text-haevn-charcoal w-24 truncate"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 400
                    }}
                  >
                    {partner.name}
                  </span>
                  <div className="flex-1">
                    <OnboardingProgress
                      percentage={partner.onboardingCompletion}
                      size="sm"
                      showPercentage={false}
                    />
                  </div>
                  <span
                    className="text-xs text-haevn-charcoal/70 w-10 text-right"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 500
                    }}
                  >
                    {partner.onboardingCompletion}%
                  </span>
                </div>
              ))}
            </div>

            {incompletePartners.length > 0 && (
              <p
                className="text-xs text-haevn-charcoal/60 mt-4 text-center"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 400
                }}
              >
                {incompletePartners.length === 1
                  ? `${incompletePartners[0].name} needs to complete onboarding`
                  : `${incompletePartners.length} partners need to complete onboarding`}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
