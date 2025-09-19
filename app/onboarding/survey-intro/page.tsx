'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { useAuth } from '@/lib/auth/context'
import { getOnboardingFlowController } from '@/lib/onboarding/flow'
import { Users, Heart, Compass, MapPin, Stars, Brain } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'

const SURVEY_SECTIONS = [
  {
    icon: Users,
    title: 'Identity & Orientation',
    description: 'Demographics, Orientation',
    color: 'text-purple-500'
  },
  {
    icon: Heart,
    title: 'Relationship Style',
    description: 'Relationship Orientation, Relational Style',
    color: 'text-pink-500'
  },
  {
    icon: Compass,
    title: 'Lifestyle & Community',
    description: 'Lifestyle, Privacy & Community',
    color: 'text-blue-500'
  },
  {
    icon: MapPin,
    title: 'Erotic Map',
    description: 'Erotic Orientation, Boundaries & Safer Sex, Open Expression',
    color: 'text-red-500'
  },
  {
    icon: Stars,
    title: 'Optional Exploration',
    description: 'Kink Library',
    color: 'text-amber-500',
    optional: true
  },
  {
    icon: Brain,
    title: 'Personality Insights',
    description: 'Erotic Personality',
    color: 'text-green-500'
  }
]

export default function SurveyIntroPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const flowController = getOnboardingFlowController()

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, router])

  const handleStart = async () => {
    if (!user) return

    try {
      // Mark this step as complete
      await flowController.markStepComplete(user.id, 6)

      // Navigate to survey
      router.push('/onboarding/survey')
    } catch (error) {
      console.error('Error updating onboarding state:', error)
      toast({
        title: 'Error',
        description: 'Failed to save progress. Please try again.',
        variant: 'destructive'
      })
    }
  }

  return (
    <OnboardingLayout currentStep={6}>
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Your Relationship Survey</CardTitle>
            <CardDescription className="text-base space-y-2">
              <span className="block font-semibold text-foreground">
                This is the foundation of HAEVN.
              </span>
              <span className="block">
                Your answers guide the connections we introduce you to.
              </span>
              <span className="block font-semibold text-foreground">
                It's required. Without it, we can't make introductions.
              </span>
              <span className="block">
                Take your time. Your progress saves automatically.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Survey Sections Preview */}
            <div className="mb-8">
              <h3 className="font-semibold mb-4">Survey Sections</h3>
              <div className="grid gap-3">
                {SURVEY_SECTIONS.map((section, index) => {
                  const Icon = section.icon
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-background border"
                    >
                      <Icon className={`h-5 w-5 mt-0.5 ${section.color}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{section.title}</span>
                          {section.optional && (
                            <Badge variant="secondary" className="text-xs">
                              Optional
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {section.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Key Points */}
            <div className="space-y-3 p-4 rounded-lg bg-muted/50 mb-6">
              <p className="text-sm font-medium">Important to know:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Your answers are private. We only use them to improve your matches.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Progress saves automatically at each step.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>You can take breaks and return anytime.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Most questions are required, but some sections are optional.</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={handleStart}
              className="w-full"
              size="lg"
            >
              Start the Survey
            </Button>
          </CardContent>
        </Card>
      </div>
    </OnboardingLayout>
  )
}