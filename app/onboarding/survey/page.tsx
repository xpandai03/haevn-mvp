'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { QuestionRenderer } from '@/components/survey/QuestionRenderer'
import { AutoSaveIndicator } from '@/components/survey/AutoSaveIndicator'
import { SectionCelebrationModal } from '@/components/survey/SectionCelebrationModal'
import { SectionIntro } from '@/components/survey/SectionIntro'
import { SectionComplete } from '@/components/survey/SectionComplete'
import { ProgressBar } from '@/components/survey/ProgressBar'
import { useAuth } from '@/lib/auth/context'
import type { SectionId } from '@/lib/theme/types'
import {
  surveySections,
  getActiveQuestions,
  getSectionForQuestion,
  getActiveQuestionsInSection,
  getQuestionIndexInSection,
  isSectionComplete,
  getSectionCelebrationMessage
} from '@/lib/survey/questions'
import { AlertCircle, ChevronLeft } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { safeResponseJson } from '@/lib/utils'
import FullPageLoader from '@/components/ui/full-page-loader'

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

  // Direction of the last navigation — used to drive framer-motion slide.
  // +1 = forward, -1 = back. Defaults to forward on first render.
  const navDirectionRef = useRef<1 | -1>(1)

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

        const { data: parsed, parseError } = await safeResponseJson(response)
        if (parseError) {
          console.error('[Survey] Failed to parse survey/load response:', parseError)
        }
        const { data: surveyData, error: surveyError, code } = parsed || {}

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
            const { getClientOnboardingFlowController } = await import('@/lib/onboarding/client-flow')
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

        const { data: saveResult, parseError: saveParseError } = await safeResponseJson(response)
        if (saveParseError) {
          console.error('[Survey] Failed to parse survey/save response:', saveParseError)
        }
        const { success, error, code } = saveResult || {}

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
          const { getClientOnboardingFlowController } = await import('@/lib/onboarding/client-flow')
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

    // Note: Section completion check moved to handleNext to only trigger on Continue click
    // This fixes the bug where popup appeared while typing in the last question

    // Trigger auto-save with current question index
    saveAnswers(newAnswers, currentQuestionIndex, completedSections)
  }

  // Navigation
  const handleNext = async () => {
    console.log('[Survey] handleNext called')
    console.log('[Survey] Current index:', currentQuestionIndex, '/', activeQuestions.length - 1)
    console.log('[Survey] Current question:', currentQuestion?.id)

    // Check if this completes a section (only on Continue click, not on typing)
    if (currentSection && !completedSections.includes(currentSection.id)) {
      const sectionIsComplete = isSectionComplete(currentSection.id, answers)

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
        saveAnswers(answers, currentQuestionIndex, newCompletedSections)

        // Still advance to next question after showing celebration
        if (currentQuestionIndex < activeQuestions.length - 1) {
          setTimeout(() => {
            const newIndex = currentQuestionIndex + 1
            setCurrentQuestionIndex(newIndex)
            saveAnswers(answers, newIndex, newCompletedSections)
          }, 1700) // Slight delay after section complete animation
        }
        return
      }
    }

    if (currentQuestionIndex < activeQuestions.length - 1) {
      const newIndex = currentQuestionIndex + 1
      const nextQuestion = activeQuestions[newIndex]
      console.log('[Survey] Moving to index:', newIndex, '-', nextQuestion?.id)
      navDirectionRef.current = 1
      setCurrentQuestionIndex(newIndex)
      saveAnswers(answers, newIndex, completedSections) // Save new index
    } else {
      // On last question - complete survey and redirect
      console.log('[Survey] ===== COMPLETING SURVEY =====')
      console.log('[Survey] Saving final answers and marking step complete...')

      // Save final state
      await saveAnswers(answers, currentQuestionIndex, completedSections)

      // Mark survey step as complete
      const { getClientOnboardingFlowController } = await import('@/lib/onboarding/client-flow')
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
      navDirectionRef.current = -1
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

      const { data: exitResult, parseError: exitParseError } = await safeResponseJson(response)
      if (exitParseError) {
        console.error('[Survey] Failed to parse save-and-exit response:', exitParseError)
      }
      const { success, error } = exitResult || {}

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
    return <FullPageLoader />
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

  const direction = navDirectionRef.current

  return (
    <div
      className="survey-layout min-h-screen flex flex-col bg-[color:var(--haevn-bg)] text-[color:var(--haevn-charcoal)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Fixed 2px top progress bar + inline caption row */}
      <div className="w-full px-6 sm:px-12 pt-8 pb-2">
        <div className="max-w-2xl mx-auto">
          <ProgressBar
            currentStep={currentQuestionIndex + 1}
            totalSteps={activeQuestions.length}
            completionPercentage={calculateCurrentCompletion()}
            sectionName={currentSection?.title || ''}
            sectionId={(currentSection?.id as SectionId) || 'basic_demographics'}
            showPercentage={true}
          />
        </div>
      </div>

      {/* Top controls: Back / Save & Exit */}
      <div className="w-full px-6 sm:px-12 mt-4 mb-6 sm:mb-10">
        <div className="max-w-2xl mx-auto flex justify-between items-center gap-2">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-2 p-2 -ml-2 text-sm text-[color:var(--haevn-muted-fg)] hover:text-[color:var(--haevn-navy)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-4">
            <AutoSaveIndicator status={saveStatus} error={saveError} />
            <button
              onClick={handleSaveAndExit}
              className="text-sm text-[color:var(--haevn-muted-fg)] hover:text-[color:var(--haevn-teal)] transition-colors"
            >
              Save &amp; exit
            </button>
          </div>
        </div>
      </div>

      {/* Main content — cardless, architectural */}
      <main className="flex-1 w-full px-6 sm:px-12 pb-28 sm:pb-20">
        <div className="w-full max-w-2xl mx-auto">
          {/* Section interstitials */}
          {showSectionIntro && currentSection && (
            <SectionIntro
              sectionId={currentSection.id}
              sectionTitle={currentSection.title}
              sectionDescription={currentSection.description}
              onComplete={() => setShowSectionIntro(false)}
            />
          )}

          {showSectionComplete && currentSection && (
            <SectionComplete
              sectionId={currentSection.id}
              sectionTitle={currentSection.title}
              sectionNumber={surveySections.findIndex(s => s.id === currentSection.id) + 1}
              totalSections={surveySections.length}
              onComplete={() => setShowSectionComplete(false)}
            />
          )}

          {/* Section marker */}
          {!showSectionIntro && !showSectionComplete && currentSection && (
            <div className="mb-8">
              <p className="text-[11px] tracking-[0.2em] uppercase text-[color:var(--haevn-teal)]">
                {currentSection.title}
              </p>
              <p className="text-xs text-[color:var(--haevn-muted-fg)] mt-1">
                Question {questionIndexInSection + 1} of {questionsInSection.length}
              </p>
            </div>
          )}

          {/* Animated question region */}
          {!showSectionIntro && !showSectionComplete && (
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={currentQuestion.id}
                custom={direction}
                initial={{ x: direction > 0 ? 20 : -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction > 0 ? -20 : 20, opacity: 0 }}
                transition={{
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <QuestionRenderer
                  question={currentQuestion}
                  value={answers[currentQuestion.id]}
                  onChange={handleAnswerChange}
                  onEnterPress={handleNext}
                  canAdvance={
                    isCurrentQuestionAnswered() &&
                    currentQuestionIndex < activeQuestions.length - 1
                  }
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Sticky bottom action bar */}
      {!showSectionIntro && !showSectionComplete && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[color:var(--haevn-border)] z-40">
          <div className="max-w-2xl mx-auto px-6 sm:px-12 py-4 flex items-center justify-end">
            <button
              onClick={handleNext}
              disabled={!isCurrentQuestionAnswered()}
              className="haevn-btn-primary"
            >
              {currentQuestionIndex === activeQuestions.length - 1
                ? 'Submit'
                : 'Continue'}
              <ChevronLeft className="w-4 h-4 ml-2 rotate-180" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

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