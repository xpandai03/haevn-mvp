'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { QuestionRenderer } from '@/components/survey/QuestionRenderer'
import { ProgressBar } from '@/components/survey/ProgressBar'
import { AutoSaveIndicator } from '@/components/survey/AutoSaveIndicator'
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { useAuth } from '@/lib/auth/context'
import { getUserSurveyData, saveUserSurveyData } from '@/lib/actions/survey-user'
import { getOnboardingFlowController } from '@/lib/onboarding/flow'
import {
  surveySections,
  getAllQuestions,
  getActiveQuestions
} from '@/lib/survey/questions'
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function SurveyPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [completionPct, setCompletionPct] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Get active questions based on skip logic
  const activeQuestions = getActiveQuestions(answers)
  const currentQuestion = activeQuestions[currentQuestionIndex]

  // Find current section
  const currentSection = surveySections.find(section =>
    section.questions.some(q => q.id === currentQuestion?.id)
  )

  // Calculate real-time completion percentage
  const calculateCurrentCompletion = () => {
    const answeredCount = activeQuestions.filter(q => {
      const answer = answers[q.id]
      if (Array.isArray(answer)) return answer.length > 0
      return answer !== undefined && answer !== null && answer !== ''
    }).length
    return Math.round((answeredCount / activeQuestions.length) * 100)
  }

  // Load survey data on mount
  useEffect(() => {
    async function loadSurveyData() {
      if (!user) {
        router.push('/auth/login')
        return
      }

      try {
        console.log('[Survey] Loading survey data for user...')

        // Load existing survey responses for the current user
        const { data: surveyData, error: surveyError } = await getUserSurveyData()

        if (surveyError) {
          console.error('Survey load error:', surveyError)
          // Don't throw - use empty data
        }

        if (surveyData) {
          setAnswers(surveyData.answers_json)

          // Find first unanswered question for resume
          const activeQs = getActiveQuestions(surveyData.answers_json)

          // Try to use saved current_step first, then fall back to first unanswered
          if (surveyData.current_step && surveyData.current_step > 0) {
            // Use the saved position but ensure it's valid
            const savedIndex = Math.min(surveyData.current_step, activeQs.length - 1)
            setCurrentQuestionIndex(savedIndex)
          } else {
            const firstUnanswered = activeQs.findIndex(q => !surveyData.answers_json[q.id])
            setCurrentQuestionIndex(firstUnanswered >= 0 ? firstUnanswered : 0)
          }

          // Recalculate completion percentage based on actual answers
          const answeredCount = activeQs.filter(q => {
            const answer = surveyData.answers_json[q.id]
            if (Array.isArray(answer)) return answer.length > 0
            return answer !== undefined && answer !== null && answer !== ''
          }).length
          const actualCompletion = Math.round((answeredCount / activeQs.length) * 100)
          setCompletionPct(actualCompletion)

          // If survey is complete, redirect
          if (actualCompletion === 100) {
            router.push('/onboarding/membership')
          }
        }
      } catch (err) {
        console.error('Error loading survey data:', err)
        toast({
          title: 'Error',
          description: 'Failed to load survey data. Please try again.',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }

    loadSurveyData()
  }, [user, router, toast])

  // Auto-save with debouncing
  const saveAnswers = useCallback(async (
    newAnswers: Record<string, any>,
    newQuestionIndex: number
  ) => {
    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    // Set new timeout for debounced save (500ms)
    const timeout = setTimeout(async () => {
      setSaveStatus('saving')
      setSaveError(null)

      try {
        const { success, error } = await saveUserSurveyData(newAnswers, newQuestionIndex)

        if (error || !success) {
          throw new Error(error || 'Failed to save')
        }

        setSaveStatus('saved')

        // Calculate new completion
        const activeQs = getActiveQuestions(newAnswers)
        const answeredCount = activeQs.filter(q => {
          const answer = newAnswers[q.id]
          if (Array.isArray(answer)) return answer.length > 0
          return answer !== undefined && answer !== null && answer !== ''
        }).length

        const newCompletion = Math.round((answeredCount / activeQs.length) * 100)
        setCompletionPct(newCompletion)

        // Check if complete
        if (newCompletion === 100) {
          // Survey is complete, will be handled by saveUserSurveyData

          toast({
            title: 'Survey Complete!',
            description: 'Great job! Let\'s celebrate...',
          })
          setTimeout(() => {
            router.push('/onboarding/celebration')
          }, 1500)
        }
      } catch (error) {
        console.error('Error saving survey:', error)
        setSaveStatus('error')
        setSaveError('Failed to save. Please check your connection.')

        toast({
          title: 'Save Error',
          description: 'Failed to save your progress. Please try again.',
          variant: 'destructive'
        })
      }
    }, 500)

    setSaveTimeout(timeout)
  }, [saveTimeout, router, toast])

  // Handle answer change
  const handleAnswerChange = (value: any) => {
    const newAnswers = {
      ...answers,
      [currentQuestion.id]: value
    }
    setAnswers(newAnswers)

    // Trigger auto-save with current question index
    saveAnswers({ [currentQuestion.id]: value }, currentQuestionIndex)
  }

  // Navigation
  const handleNext = () => {
    if (currentQuestionIndex < activeQuestions.length - 1) {
      const newIndex = currentQuestionIndex + 1
      setCurrentQuestionIndex(newIndex)
      saveAnswers({}, newIndex) // Save new index
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      const newIndex = currentQuestionIndex - 1
      setCurrentQuestionIndex(newIndex)
      saveAnswers({}, newIndex) // Save new index
    }
  }

  const handleSaveAndExit = async () => {
    setSaveStatus('saving')
    try {
      await saveUserSurveyData(answers, currentQuestionIndex)
      router.push('/dashboard')
    } catch (err) {
      console.error('Error saving survey:', err)
      toast({
        title: 'Error',
        description: 'Failed to save progress. Please try again.',
        variant: 'destructive'
      })
    }
  }

  // Check if current question is answered
  const isCurrentQuestionAnswered = () => {
    if (!currentQuestion) return false
    const answer = answers[currentQuestion.id]

    if (currentQuestion.type === 'multiselect') {
      return answer && answer.length > 0
    }
    return answer !== undefined && answer !== null && answer !== ''
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading survey...</p>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to load survey questions. Please refresh the page.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <div className="flex justify-between items-center mb-4">
            <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
            <div className="flex items-center gap-4">
              <AutoSaveIndicator status={saveStatus} error={saveError} />
              <Button variant="ghost" size="sm" onClick={handleSaveAndExit}>
                Save & Exit
              </Button>
            </div>
          </div>

          <ProgressBar
            currentStep={currentQuestionIndex + 1}
            totalSteps={activeQuestions.length}
            completionPercentage={calculateCurrentCompletion()}
            sectionName={currentSection?.title || ''}
          />

          {currentSection?.description && (
            <CardDescription className="mt-2">
              {currentSection.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          <QuestionRenderer
            question={currentQuestion}
            value={answers[currentQuestion.id]}
            onChange={handleAnswerChange}
            onEnterPress={handleNext}
            canAdvance={isCurrentQuestionAnswered() && currentQuestionIndex < activeQuestions.length - 1}
          />

          <div className="flex justify-between items-center pt-6 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="text-sm text-muted-foreground">
              Question {currentQuestionIndex + 1} of {activeQuestions.length}
            </div>

            <Button
              onClick={handleNext}
              disabled={!isCurrentQuestionAnswered() || currentQuestionIndex === activeQuestions.length - 1}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {currentQuestionIndex === activeQuestions.length - 1 && isCurrentQuestionAnswered() && (
            <div className="flex justify-center pt-4">
              <Button
                size="lg"
                onClick={() => router.push('/onboarding/celebration')}
                className="min-w-[200px]"
              >
                Complete Survey
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}