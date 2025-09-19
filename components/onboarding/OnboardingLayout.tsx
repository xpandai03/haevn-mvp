'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { getOnboardingFlowController, ONBOARDING_STEPS } from '@/lib/onboarding/flow'
import { ArrowLeft, Save, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'

interface OnboardingLayoutProps {
  children: React.ReactNode
  currentStep: number
  showProgressBar?: boolean
  showBackButton?: boolean
  showSaveExit?: boolean
}

export function OnboardingLayout({
  children,
  currentStep,
  showProgressBar = true,
  showBackButton = true,
  showSaveExit = true
}: OnboardingLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const { toast } = useToast()
  const [progress, setProgress] = useState(0)
  const [saving, setSaving] = useState(false)
  const flowController = getOnboardingFlowController()

  // Calculate progress
  useEffect(() => {
    async function calculateProgress() {
      if (!user) return

      const state = await flowController.getOnboardingState(user.id)
      if (state) {
        const percentage = flowController.getProgressPercentage(state.completedSteps)
        setProgress(percentage)
      }
    }

    calculateProgress()
  }, [user, currentStep, flowController])

  // Get current step info
  const stepInfo = ONBOARDING_STEPS.find(s => s.id === currentStep)
  const totalRequiredSteps = ONBOARDING_STEPS.filter(s => s.required).length

  const handleBack = () => {
    const prevStep = flowController.getPreviousStep(currentStep)
    if (prevStep) {
      router.push(prevStep.path)
    }
  }

  const handleSaveAndExit = async () => {
    if (!user) return

    setSaving(true)
    try {
      // Update current step in state
      await flowController.updateOnboardingState(user.id, {
        currentStep
      })

      toast({
        title: 'Progress saved',
        description: 'You can continue where you left off anytime.',
      })

      router.push('/dashboard')
    } catch (error) {
      console.error('Error saving progress:', error)
      toast({
        title: 'Error',
        description: 'Failed to save progress. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {showBackButton && currentStep > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}

              <div>
                <h2 className="text-lg font-semibold">{stepInfo?.title}</h2>
                <p className="text-sm text-muted-foreground">
                  Step {currentStep} of {totalRequiredSteps}
                </p>
              </div>
            </div>

            {showSaveExit && currentStep > 1 && currentStep < 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAndExit}
                disabled={saving}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save & Exit
              </Button>
            )}
          </div>

          {showProgressBar && (
            <div className="mt-4">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {progress}% complete
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Auto-save indicator */}
        {currentStep > 1 && currentStep < 10 && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <AlertDescription>
              Your progress saves automatically. You can leave and come back anytime.
            </AlertDescription>
          </Alert>
        )}

        {children}
      </main>
    </div>
  )
}

// Shared component for educational cards
interface EducationCardProps {
  icon: React.ReactNode
  title: string
  description: string
}

export function EducationCard({ icon, title, description }: EducationCardProps) {
  return (
    <div className="flex gap-4 p-4 rounded-lg border bg-card">
      <div className="flex-shrink-0 mt-1">{icon}</div>
      <div className="space-y-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}