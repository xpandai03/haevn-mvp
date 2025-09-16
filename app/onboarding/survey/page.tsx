'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { surveySteps, calculateCompletion } from '@/lib/data/survey'

export default function SurveyPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [completion, setCompletion] = useState(0)
  const [loading, setLoading] = useState(false)

  // Load saved responses on mount
  useEffect(() => {
    const savedResponses = localStorage.getItem('haevn_survey_responses')
    if (savedResponses) {
      const parsed = JSON.parse(savedResponses)
      setResponses(parsed)
      setCompletion(calculateCompletion(parsed))

      // Find the first incomplete step
      for (let i = 0; i < surveySteps.length; i++) {
        const step = surveySteps[i]
        const stepComplete = step.questions.every(q => parsed[q.id])
        if (!stepComplete) {
          setCurrentStep(i)
          break
        }
      }
    }
  }, [])

  // Save responses whenever they change
  useEffect(() => {
    if (Object.keys(responses).length > 0) {
      localStorage.setItem('haevn_survey_responses', JSON.stringify(responses))
      setCompletion(calculateCompletion(responses))
    }
  }, [responses])

  const currentStepData = surveySteps[currentStep]

  const handleSingleSelect = (questionId: string, value: string) => {
    setResponses({ ...responses, [questionId]: value })
  }

  const handleMultiSelect = (questionId: string, value: string, checked: boolean) => {
    const current = responses[questionId] || []
    if (checked) {
      setResponses({ ...responses, [questionId]: [...current, value] })
    } else {
      setResponses({ ...responses, [questionId]: current.filter((v: string) => v !== value) })
    }
  }

  const isStepComplete = () => {
    return currentStepData.questions.every(q => {
      const response = responses[q.id]
      if (q.type === 'multiselect') {
        return response && response.length > 0
      }
      return response
    })
  }

  const handleNext = () => {
    if (currentStep < surveySteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else if (completion === 100) {
      // Survey complete, update user data
      const userData = localStorage.getItem('haevn_user')
      if (userData) {
        const user = JSON.parse(userData)
        user.surveyCompleted = true
        localStorage.setItem('haevn_user', JSON.stringify(user))
      }
      router.push('/onboarding/membership')
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSaveAndExit = () => {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex justify-between items-center mb-4">
            <CardTitle>Complete Your Profile</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleSaveAndExit}>
              Save & Exit
            </Button>
          </div>
          <CardDescription>
            Step {currentStep + 1} of {surveySteps.length}: {currentStepData.title}
          </CardDescription>
          <Progress value={completion} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-1">{completion}% Complete</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStepData.questions.map((question) => (
            <div key={question.id} className="space-y-3">
              <Label>{question.label}</Label>

              {question.type === 'select' && (
                <RadioGroup
                  value={responses[question.id] || ''}
                  onValueChange={(value) => handleSingleSelect(question.id, value)}
                >
                  {question.options.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                      <Label htmlFor={`${question.id}-${option}`} className="font-normal cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {question.type === 'multiselect' && (
                <div className="space-y-2">
                  {question.options.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${question.id}-${option}`}
                        checked={responses[question.id]?.includes(option) || false}
                        onCheckedChange={(checked) =>
                          handleMultiSelect(question.id, option, checked as boolean)
                        }
                      />
                      <Label htmlFor={`${question.id}-${option}`} className="font-normal cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="flex justify-between pt-6">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </Button>
            <Button
              onClick={handleNext}
              disabled={!isStepComplete()}
            >
              {currentStep === surveySteps.length - 1 && completion === 100
                ? 'Complete Survey'
                : 'Next'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}