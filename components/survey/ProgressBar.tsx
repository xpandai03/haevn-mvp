'use client'

import { Progress } from '@/components/ui/progress'

interface ProgressBarProps {
  currentStep: number
  totalSteps: number
  completionPercentage: number
  sectionName: string
}

export function ProgressBar({
  currentStep,
  totalSteps,
  completionPercentage,
  sectionName
}: ProgressBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-medium">
            Step {currentStep} of {totalSteps}
          </p>
          <p className="text-xs text-muted-foreground">
            {sectionName}
          </p>
        </div>
        <p className="text-sm font-medium">
          {completionPercentage}% Complete
        </p>
      </div>
      <Progress value={completionPercentage} className="h-2" />
    </div>
  )
}