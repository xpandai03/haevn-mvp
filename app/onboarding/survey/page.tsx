'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { QuestionRenderer } from '@/components/survey/QuestionRenderer'
import { AutoSaveIndicator } from '@/components/survey/AutoSaveIndicator'
import { SectionCelebrationModal } from '@/components/survey/SectionCelebrationModal'
import { SectionIntro } from '@/components/survey/SectionIntro'
import { SectionComplete } from '@/components/survey/SectionComplete'
import { useAuth } from '@/lib/auth/context'
import {
  surveySections,
  getActiveQuestions,
  getSectionForQuestion,
  getActiveQuestionsInSection,
  getQuestionIndexInSection,
  isSectionComplete,
  getSectionCelebrationMessage
} from '@/lib/survey/questions'
import { Loader2, AlertCircle, ChevronLeft } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function SurveyPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()  // Get loading state from auth
  const { toast } = useToast()
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [completionPct, setCompletionPct] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)
  const [completedSections, setCompletedSections] = useState<string[]>([])
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationSection, setCelebrationSection] = useState<{
    title: string
    number: number
    message: string
  } | null>(null)
  const [showSectionIntro, setShowSectionIntro] = useState(false)
  const [showSectionComplete, setShowSectionComplete] = useState(false)
  const [previousSectionId, setPreviousSectionId] = useState<string | null>(null)

  // Get active questions based on skip logic (memoized to prevent unnecessary recalculations)
  const activeQuestions = useMemo(() => {
    const questions = getActiveQuestions(answers)
    console.log('[Survey] Active questions recalculated:', questions.length, 'questions')
    console.log('[Survey] Question IDs:', questions.map(q => q.id))
    return questions
  }, [answers])

  const currentQuestion = activeQuestions[currentQuestionIndex]

  // Validate and adjust current question index when active questions change
  useEffect(() => {
    console.log('[Survey] Validating question index:', currentQuestionIndex, '/', activeQuestions.length)

    // If current index is out of bounds, adjust it
    if (currentQuestionIndex >= activeQuestions.length) {
      console.warn('[Survey] Index out of bounds, adjusting from', currentQuestionIndex, 'to', activeQuestions.length - 1)
      const newIndex = Math.max(0, activeQuestions.length - 1)
      setCurrentQuestionIndex(newIndex)
      return
    }

    // Check if current question exists
    const expectedQuestion = activeQuestions[currentQuestionIndex]
    if (!expectedQuestion) {
      console.error('[Survey] No question at index', currentQuestionIndex, '- resetting to 0')
      setCurrentQuestionIndex(0)
      return
    }

    console.log('[Survey] Current question validated:', expectedQuestion.id, 'at index', currentQuestionIndex)
  }, [activeQuestions, currentQuestionIndex])

  // Find current section
  const currentSection = currentQuestion ? getSectionForQuestion(currentQuestion.id) : undefined

  // Detect section change and show intro animation
  useEffect(() => {
    if (currentSection && currentSection.id !== previousSectionId) {
      console.log('[Survey] New section detected:', currentSection.title)
      console.log('[Survey] Previous section:', previousSectionId)
      console.log('[Survey] Completed sections:', completedSections)

      // Show intro animation if:
      // 1. This section is not already completed
      // 2. AND we're transitioning from a different section (previousSectionId !== null means we've seen at least one section)
      //    OR this is the very first section (previousSectionId === null) on a fresh start
      const isNewSection = !completedSections.includes(currentSection.id)
      const isTransition = previousSectionId !== null && previousSectionId !== currentSection.id
      const isFirstSection = previousSectionId === null && currentQuestionIndex === 0

      if (isNewSection && (isTransition || isFirstSection)) {
        console.log('[Survey] ✨ Showing section intro animation')
        setShowSectionIntro(true)
      }

      setPreviousSectionId(currentSection.id)
    }
  }, [currentSection, previousSectionId, completedSections, currentQuestionIndex])

  // Get section-specific progress
  const questionsInSection = currentSection
    ? getActiveQuestionsInSection(currentSection.id, answers)
    : []
  const questionIndexInSection = currentQuestion
    ? getQuestionIndexInSection(currentQuestion.id, answers)
    : 0

  // Calculate real-time completion percentage
  const calculateCurrentCompletion = () => {
    const answeredCount = activeQuestions.filter(q => {
      const answer = answers[q.id]
      if (Array.isArray(answer)) return answer.length > 0
      return answer !== undefined && answer !== null && answer !== ''
    }).length
    return Math.round((answeredCount / activeQuestions.length) * 100)
  }

  // Clear survey data when user changes (prevents data leakage between users)
  useEffect(() => {
    console.log('[Survey] ===== USER CHANGE DETECTION =====')
    console.log('[Survey] Current user:', user?.id, user?.email)
    console.log('[Survey] Current answers count:', Object.keys(answers).length)

    if (!user) {
      console.log('[Survey] ❌ No user - clearing survey state')
      setAnswers({})
      setCurrentQuestionIndex(0)
      setCompletionPct(0)
      setCompletedSections([])
      console.log('[Survey] ✅ Survey state cleared')
      return
    }

    console.log('[Survey] ✅ User detected:', user.id)
    console.log('[Survey] Email:', user.email)
    console.log('[Survey] =====================================')
    // Data will be reloaded by the loadSurveyData effect below
  }, [user?.id]) // Only re-run when user.id actually changes

  // Load survey data on mount
  useEffect(() => {
    async function loadSurveyData() {
      // Wait for auth to finish loading before checking user
      if (authLoading) {
        console.log('[Survey] Auth still loading, waiting...')
        return
      }

      // Only redirect if auth finished loading AND there's no user
      if (!user) {
        console.log('[Survey] No user after auth loaded, redirecting to login')
        router.push('/auth/login')
        return
      }

      try {
        console.log('[Survey] Loading survey data for user:', user.id)

        // Load existing survey responses for the current user using API route
        const response = await fetch('/api/survey/load', {
          method: 'GET',
          credentials: 'include', // Include cookies
        })

        const { data: surveyData, error: surveyError, code } = await response.json()

        if (surveyError || !response.ok) {
          console.error('Survey load error:', surveyError)
          if (code === 'NO_SESSION') {
            console.error('[Survey] No session during load - redirecting to login')
            toast({
              title: 'Session expired',
              description: 'Please sign in again.',
              variant: 'destructive'
            })
            setTimeout(() => {
              window.location.href = '/auth/login'
            }, 1500)
            return
          }
          // Don't throw - use empty data
        }

        if (surveyData) {
          setAnswers(surveyData.answers_json)
          setCompletedSections(surveyData.completed_sections || [])

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

          // If survey is complete, mark step and redirect to celebration
          if (actualCompletion === 100) {
            const { getClientOnboardingFlowController } = await import('@/lib/onboarding/flow')
            const flowController = getClientOnboardingFlowController()
            if (user?.id) {
              await flowController.markStepComplete(user.id, 7)
            }
            router.push('/onboarding/celebration')
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
  }, [user, authLoading, router, toast])  // Re-run when auth loading state changes

  // Auto-save with debouncing
  const saveAnswers = useCallback(async (
    newAnswers: Record<string, any>,
    newQuestionIndex: number,
    sections: string[] = []
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
        // Call API route instead of server action
        const response = await fetch('/api/survey/save', {
          method: 'POST',
          credentials: 'include', // Include cookies
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partialAnswers: newAnswers,
            currentQuestionIndex: newQuestionIndex,
            completedSections: sections
          })
        })

        const { success, error, code } = await response.json()

        if (!success || error || !response.ok) {
          // Handle specific error codes
          if (code === 'NO_SESSION') {
            console.error('[Survey] No session - redirecting to login')
            setSaveError('Session expired. Please sign in again.')
            setTimeout(() => {
              window.location.href = '/auth/login'
            }, 2000)
            return
          }
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
          toast({
            title: 'Survey Complete!',
            description: 'Great job! Let\'s celebrate...',
          })

          // Mark survey step as complete
          const { getClientOnboardingFlowController } = await import('@/lib/onboarding/flow')
          const flowController = getClientOnboardingFlowController()
          if (user?.id) {
            await flowController.markStepComplete(user.id, 7)
          }

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
    console.log('[Survey] Answer changed:', currentQuestion.id, '=', value)

    const newAnswers = {
      ...answers,
      [currentQuestion.id]: value
    }
    setAnswers(newAnswers)

    // Recalculate active questions to check if current question should still be visible
    const newActiveQuestions = getActiveQuestions(newAnswers)
    console.log('[Survey] Active questions after change:', newActiveQuestions.map(q => q.id))

    // Check if the current question is still in the active list
    const currentQuestionStillActive = newActiveQuestions.some(q => q.id === currentQuestion.id)
    if (!currentQuestionStillActive) {
      console.warn('[Survey] Current question no longer active after answer change:', currentQuestion.id)
      // This can happen if answering a question invalidates itself or future questions
      // We'll let the useEffect handle repositioning
    }

    // Check if this completes a section
    if (currentSection && !completedSections.includes(currentSection.id)) {
      const sectionIsComplete = isSectionComplete(currentSection.id, newAnswers)

      if (sectionIsComplete) {
        // Mark section as complete
        const newCompletedSections = [...completedSections, currentSection.id]
        setCompletedSections(newCompletedSections)

        // Show completion animation first
        setShowSectionComplete(true)

        // After animation completes, show celebration modal
        setTimeout(() => {
          setShowSectionComplete(false)
          const sectionIndex = surveySections.findIndex(s => s.id === currentSection.id)
          setCelebrationSection({
            title: currentSection.title,
            number: sectionIndex + 1,
            message: getSectionCelebrationMessage(sectionIndex)
          })
          setShowCelebration(true)
        }, 1600) // Match SectionComplete duration

        // Save with completed sections
        saveAnswers(newAnswers, currentQuestionIndex, newCompletedSections)
        return
      }
    }

    // Trigger auto-save with current question index
    saveAnswers(newAnswers, currentQuestionIndex, completedSections)
  }

  // Navigation
  const handleNext = async () => {
    console.log('[Survey] handleNext called')
    console.log('[Survey] Current index:', currentQuestionIndex, '/', activeQuestions.length - 1)
    console.log('[Survey] Current question:', currentQuestion?.id)

    if (currentQuestionIndex < activeQuestions.length - 1) {
      const newIndex = currentQuestionIndex + 1
      const nextQuestion = activeQuestions[newIndex]
      console.log('[Survey] Moving to index:', newIndex, '-', nextQuestion?.id)
      setCurrentQuestionIndex(newIndex)
      saveAnswers(answers, newIndex, completedSections) // Save new index
    } else {
      // On last question - complete survey and redirect
      console.log('[Survey] ===== COMPLETING SURVEY =====')
      console.log('[Survey] Saving final answers and marking step complete...')

      // Save final state
      await saveAnswers(answers, currentQuestionIndex, completedSections)

      // Mark survey step as complete
      const { getClientOnboardingFlowController } = await import('@/lib/onboarding/flow')
      const flowController = getClientOnboardingFlowController()
      if (user?.id) {
        await flowController.markStepComplete(user.id, 7)
        console.log('[Survey] ✅ Step 7 marked complete')
      }

      toast({
        title: 'Survey Complete!',
        description: 'Great job! Let\'s celebrate your progress...',
      })

      console.log('[Survey] Redirecting to celebration page...')
      router.push('/onboarding/celebration')
    }
  }

  const handlePrevious = () => {
    console.log('[Survey] handlePrevious called')
    console.log('[Survey] Current index:', currentQuestionIndex)

    if (currentQuestionIndex > 0) {
      const newIndex = currentQuestionIndex - 1
      const prevQuestion = activeQuestions[newIndex]
      console.log('[Survey] Moving to index:', newIndex, '-', prevQuestion?.id)
      setCurrentQuestionIndex(newIndex)
      saveAnswers(answers, newIndex, completedSections) // Save new index
    } else {
      console.log('[Survey] Already at first question')
    }
  }

  const handleSaveAndExit = async () => {
    setSaveStatus('saving')
    try {
      const response = await fetch('/api/survey/save', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partialAnswers: answers,
          currentQuestionIndex: currentQuestionIndex,
          completedSections: completedSections
        })
      })

      const { success, error } = await response.json()

      if (!success || error || !response.ok) {
        throw new Error(error || 'Failed to save')
      }

      toast({
        title: 'Progress saved',
        description: 'You can continue where you left off anytime.',
      })
      router.push('/onboarding/expectations')
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
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
          <p className="text-haevn-charcoal" style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}>
            Loading survey...
          </p>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-haevn-lightgray">
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
    <div className="min-h-screen flex flex-col bg-haevn-lightgray">
      {/* Progress bar */}
      <div className="w-full px-4 pt-6 pb-4">
        <div className="max-w-2xl mx-auto">
          <div className="w-full h-1 bg-white rounded-full overflow-hidden">
            <div
              className="h-full bg-haevn-gold rounded-full transition-all duration-500 ease-out"
              style={{ width: `${calculateCurrentCompletion()}%` }}
              role="progressbar"
              aria-valuenow={calculateCurrentCompletion()}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-haevn-charcoal" style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}>
              {calculateCurrentCompletion()}% complete
            </p>
            <AutoSaveIndicator status={saveStatus} error={saveError} />
          </div>
        </div>
      </div>

      {/* Back button and Save & Exit */}
      <div className="w-full px-4 mb-6 sm:mb-8">
        <div className="max-w-2xl mx-auto flex justify-between items-center gap-2">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-1 sm:gap-2 p-2 text-haevn-navy hover:text-haevn-charcoal hover:bg-white/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px]"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-xs sm:text-sm font-medium" style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}>
              Back
            </span>
          </button>

          <button
            onClick={handleSaveAndExit}
            className="text-xs sm:text-sm text-haevn-navy hover:text-haevn-teal transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center px-2"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
          >
            Save & Exit
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-lg p-6 sm:p-8 lg:p-12">
          {/* Section Intro Animation */}
          {showSectionIntro && currentSection && (
            <SectionIntro
              sectionId={currentSection.id}
              sectionTitle={currentSection.title}
              sectionDescription={currentSection.description}
              onComplete={() => setShowSectionIntro(false)}
            />
          )}

          {/* Section Complete Animation */}
          {showSectionComplete && currentSection && (
            <SectionComplete
              sectionId={currentSection.id}
              sectionTitle={currentSection.title}
              sectionNumber={surveySections.findIndex(s => s.id === currentSection.id) + 1}
              totalSections={surveySections.length}
              onComplete={() => setShowSectionComplete(false)}
            />
          )}

          {/* Section title with progress */}
          {!showSectionIntro && !showSectionComplete && currentSection && (
            <div className="mb-6">
              <h2 className="text-sm text-haevn-gold mb-2" style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {currentSection.title}
              </h2>
              {currentSection.description && (
                <p className="text-sm text-haevn-charcoal/70 mb-2" style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300, lineHeight: '120%' }}>
                  {currentSection.description}
                </p>
              )}
              <p className="text-xs text-haevn-charcoal/50" style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}>
                Question {questionIndexInSection + 1} of {questionsInSection.length}
              </p>
            </div>
          )}

          {/* Question - hidden during animations */}
          {!showSectionIntro && !showSectionComplete && (
            <>
              <QuestionRenderer
                question={currentQuestion}
                value={answers[currentQuestion.id]}
                onChange={handleAnswerChange}
                onEnterPress={handleNext}
                canAdvance={isCurrentQuestionAnswered() && currentQuestionIndex < activeQuestions.length - 1}
              />

              {/* Continue button */}
              <div className="mt-8">
                <Button
                  onClick={handleNext}
                  disabled={!isCurrentQuestionAnswered() || currentQuestionIndex === activeQuestions.length - 1}
                  className="w-full px-8 py-6 bg-haevn-teal hover:opacity-90 active:opacity-80 text-white text-lg rounded-full transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-4 focus:ring-haevn-teal/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
                >
                  {currentQuestionIndex === activeQuestions.length - 1 ? 'Complete Survey' : 'Continue'}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Question counter - section specific */}
        <div className="mt-6 text-center">
          <p className="text-sm text-haevn-charcoal/70" style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}>
            Question {questionIndexInSection + 1} of {questionsInSection.length}
          </p>
        </div>
      </main>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 pb-6">
        {Array.from({ length: Math.min(activeQuestions.length, 10) }).map((_, idx) => (
          <div
            key={idx}
            className={`w-2 h-2 rounded-full ${
              idx <= Math.floor((currentQuestionIndex / activeQuestions.length) * 10)
                ? 'bg-haevn-gold'
                : 'bg-white'
            }`}
          />
        ))}
      </div>

      {/* Section Celebration Modal */}
      {celebrationSection && (
        <SectionCelebrationModal
          isOpen={showCelebration}
          onClose={() => setShowCelebration(false)}
          sectionTitle={celebrationSection.title}
          sectionNumber={celebrationSection.number}
          totalSections={surveySections.length}
          celebrationMessage={celebrationSection.message}
        />
      )}
    </div>
  )
}