import type { SupabaseClient } from '@supabase/supabase-js'

export type OnboardingStep = {
  id: number
  path: string
  title: string
  description: string
  required: boolean
  completed?: boolean
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    path: '/auth/signup',
    title: 'Account Creation',
    description: 'Create your HAEVN account',
    required: true
  },
  {
    id: 2,
    path: '/onboarding/expectations',
    title: 'Before We Continue',
    description: 'What to expect from the onboarding process',
    required: true
  },
  {
    id: 3,
    path: '/onboarding/welcome',
    title: 'Welcome to HAEVN',
    description: 'Learn what makes HAEVN different',
    required: true
  },
  {
    id: 4,
    path: '/onboarding/identity',
    title: 'Your Identity',
    description: 'Tell us who you are and how you connect',
    required: true
  },
  {
    id: 5,
    path: '/onboarding/verification',
    title: 'Verification',
    description: 'Keep HAEVN safe and real',
    required: false // Can be skipped in Phase 1
  },
  {
    id: 6,
    path: '/onboarding/survey-intro',
    title: 'Survey Introduction',
    description: 'The foundation of meaningful connections',
    required: true
  },
  {
    id: 7,
    path: '/onboarding/survey',
    title: 'Relationship Survey',
    description: 'Help us understand your needs and boundaries',
    required: true
  },
  {
    id: 8,
    path: '/onboarding/celebration',
    title: 'You\'re In!',
    description: 'Celebrate your completion',
    required: true
  },
  {
    id: 9,
    path: '/onboarding/membership',
    title: 'Choose Your Plan',
    description: 'Select your membership level',
    required: true
  },
  {
    id: 10,
    path: '/dashboard',
    title: 'Dashboard',
    description: 'Your HAEVN home',
    required: false
  }
]

export interface OnboardingState {
  currentStep: number
  completedSteps: number[]
  expectationsViewed: boolean
  welcomeViewed: boolean
  identityCompleted: boolean
  verificationSkipped: boolean
  surveyIntroViewed: boolean
  surveyCompleted: boolean
  celebrationViewed: boolean
  membershipSelected: boolean
}

export class OnboardingFlowController {
  private supabase: SupabaseClient

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient
  }

  async getOnboardingState(userId: string): Promise<OnboardingState | null> {
    try {
      // For now, use localStorage as a fallback since the migration hasn't been run
      // This is temporary until the database table is created
      if (typeof window !== 'undefined') {
        const storedState = localStorage.getItem(`onboarding_state_${userId}`)
        if (storedState) {
          return JSON.parse(storedState)
        }
      }

      // Return default state if nothing is stored
      return {
        currentStep: 1,
        completedSteps: [],
        expectationsViewed: false,
        welcomeViewed: false,
        identityCompleted: false,
        verificationSkipped: false,
        surveyIntroViewed: false,
        surveyCompleted: false,
        celebrationViewed: false,
        membershipSelected: false
      }
    } catch (error) {
      console.error('Error in getOnboardingState:', error)
      return null
    }
  }

  async updateOnboardingState(
    userId: string,
    updates: Partial<OnboardingState>
  ): Promise<boolean> {
    try {
      // Get current state
      const currentState = await this.getOnboardingState(userId)
      if (!currentState) return false

      // Merge updates with current state
      const newState = { ...currentState, ...updates }

      // Store in localStorage for now
      if (typeof window !== 'undefined') {
        localStorage.setItem(`onboarding_state_${userId}`, JSON.stringify(newState))
      }

      return true
    } catch (error) {
      console.error('Error in updateOnboardingState:', error)
      return false
    }
  }

  async markStepComplete(userId: string, stepId: number): Promise<boolean> {
    try {
      const state = await this.getOnboardingState(userId)
      if (!state) return false

      const completedSteps = state.completedSteps || []
      if (!completedSteps.includes(stepId)) {
        completedSteps.push(stepId)
      }

      // Update specific flags based on step
      const updates: Partial<OnboardingState> = {
        completedSteps,
        currentStep: Math.min(stepId + 1, ONBOARDING_STEPS.length)
      }

      switch (stepId) {
        case 2:
          updates.expectationsViewed = true
          break
        case 3:
          updates.welcomeViewed = true
          break
        case 4:
          updates.identityCompleted = true
          break
        case 5:
          updates.verificationSkipped = true // If they complete or skip
          break
        case 6:
          updates.surveyIntroViewed = true
          break
        case 8:
          updates.celebrationViewed = true
          break
      }

      return await this.updateOnboardingState(userId, updates)
    } catch (error) {
      console.error('Error marking step complete:', error)
      return false
    }
  }

  getNextStep(currentStep: number): OnboardingStep | null {
    const nextIndex = ONBOARDING_STEPS.findIndex(s => s.id === currentStep + 1)
    return nextIndex >= 0 ? ONBOARDING_STEPS[nextIndex] : null
  }

  getPreviousStep(currentStep: number): OnboardingStep | null {
    const prevIndex = ONBOARDING_STEPS.findIndex(s => s.id === currentStep - 1)
    return prevIndex >= 0 ? ONBOARDING_STEPS[prevIndex] : null
  }

  canAccessStep(stepId: number, completedSteps: number[]): boolean {
    // Can always access completed steps
    if (completedSteps.includes(stepId)) return true

    // Check if all required previous steps are complete
    const requiredSteps = ONBOARDING_STEPS
      .filter(s => s.id < stepId && s.required)
      .map(s => s.id)

    return requiredSteps.every(id => completedSteps.includes(id))
  }

  getProgressPercentage(completedSteps: number[]): number {
    const requiredSteps = ONBOARDING_STEPS.filter(s => s.required)
    const completedRequired = requiredSteps.filter(s =>
      completedSteps.includes(s.id)
    ).length

    return Math.round((completedRequired / requiredSteps.length) * 100)
  }

  async getResumeStep(userId: string): Promise<string> {
    try {
      console.log('[FLOW] ===== GET RESUME STEP =====')
      console.log('[FLOW] Getting resume step for user:', userId)

      // Check if user has a partnership
      const { data: membership } = await this.supabase
        .from('partnership_members')
        .select('partnership_id, survey_reviewed, role')
        .eq('user_id', userId)
        .maybeSingle()

      console.log('[FLOW] Partnership membership:', {
        hasPartnership: !!membership,
        partnershipId: membership?.partnership_id,
        role: membership?.role,
        surveyReviewed: membership?.survey_reviewed
      })

      if (!membership) {
        // No partnership - new user, start regular onboarding
        console.log('[FLOW] No partnership found, starting regular onboarding')
        console.log('[FLOW] =========================================')
        return '/onboarding/expectations'
      }

      // DEFENSIVE GUARD: Validate partnership_id before querying
      const partnershipId = membership.partnership_id
      if (!partnershipId || typeof partnershipId !== 'string' || partnershipId.length < 10) {
        console.warn('[FLOW] ⚠️ Missing or invalid partnershipId:', partnershipId)
        console.warn('[FLOW] Treating survey as incomplete, sending to onboarding')
        console.log('[FLOW] =========================================')
        return '/onboarding/expectations'
      }

      console.log('[FLOW] Valid partnershipId:', partnershipId)
      console.log('[FLOW] ✅ Querying survey by user_id:', userId)

      // Check user's survey completion (stable across partnership changes)
      const { data: surveyData, error: surveyError } = await this.supabase
        .from('user_survey_responses')
        .select('completion_pct')
        .eq('user_id', userId)
        .maybeSingle()

      if (surveyError) {
        console.error('[FLOW] ❌ Error fetching survey:', surveyError.message)
        console.error('[FLOW] Code:', surveyError.code)
        console.log('[FLOW] Treating survey as incomplete')
      }

      console.log('[FLOW] Partnership survey data:', {
        hasSurvey: !!surveyData,
        completionPct: surveyData?.completion_pct,
        error: surveyError?.message
      })

      // PRIORITY 1: If survey complete and user has reviewed, go to dashboard
      // This is the SOURCE OF TRUTH - database state overrides localStorage
      const isComplete = surveyData?.completion_pct === 100 && membership.survey_reviewed === true
      console.log('[FLOW] DECISION user=%s pct=%s reviewed=%s result=%s',
        userId,
        surveyData?.completion_pct,
        membership.survey_reviewed,
        isComplete ? '/dashboard' : 'continue checking'
      )

      if (isComplete) {
        console.log('[FLOW] ✅ Survey complete and reviewed, sending to dashboard')
        console.log('[FLOW] =========================================')
        return '/dashboard'
      }

      // PRIORITY 2: If partner (not owner) and hasn't reviewed survey yet
      if (membership.role === 'member' && !membership.survey_reviewed) {
        console.log('[FlowController] Partner has not reviewed survey yet')

        if (surveyData && surveyData.completion_pct > 0) {
          // Owner has started/completed survey, send to review
          console.log('[FlowController] Survey exists, sending to review-survey')
          return '/onboarding/review-survey'
        } else {
          // Owner hasn't started survey yet, wait
          console.log('[FlowController] No survey data yet, waiting for owner')
          // Could redirect to a "waiting" page or let them view empty review page
          return '/onboarding/review-survey'
        }
      }

      // PRIORITY 3: If owner or survey not complete, continue normal flow
      const state = await this.getOnboardingState(userId)
      console.log('[FlowController] Onboarding state:', state)

      if (!state) {
        // No localStorage state found
        console.log('[FlowController] No localStorage state found')

        // IMPORTANT: For existing users who completed everything before localStorage tracking
        // If they have a partnership AND survey data (even if incomplete), they're returning users
        if (membership && surveyData) {
          console.log('[FlowController] Existing user without localStorage - checking survey progress')

          if (surveyData.completion_pct > 0 && surveyData.completion_pct < 100) {
            // Survey in progress, resume from there
            console.log('[FlowController] Survey in progress, resuming at survey')
            return '/onboarding/survey'
          }

          // Survey is 0% or something else is wrong, but they have partnership
          // This shouldn't happen, but if it does, send to survey
          console.log('[FlowController] Survey incomplete, sending to survey')
          return '/onboarding/survey'
        }

        // No survey data - brand new user, start onboarding
        console.log('[FlowController] No survey data, sending to first onboarding step')
        return '/onboarding/expectations'
      }

      // PRIORITY 4: Check localStorage for incomplete steps
      // BUT: Database state (survey complete + reviewed) takes precedence
      // If database says they're done, trust it over localStorage

      // Double-check database state one more time before trusting localStorage
      if (surveyData?.completion_pct === 100 && membership.survey_reviewed) {
        console.log('[FlowController] ✅ Database confirms completion, ignoring localStorage - going to dashboard')
        return '/dashboard'
      }

      // Find the first incomplete required step from localStorage
      for (const step of ONBOARDING_STEPS) {
        // CRITICAL: Skip signup step (step 1) for authenticated users
        if (step.id === 1) {
          console.log('[FlowController] Skipping signup step - user is authenticated')
          continue
        }

        if (step.required && !state.completedSteps.includes(step.id)) {
          console.log('[FlowController] Resuming at incomplete step:', step.path)
          return step.path
        }
      }

      // All required steps complete in localStorage, go to dashboard
      console.log('[FlowController] All steps complete in localStorage, going to dashboard')
      return '/dashboard'
    } catch (error) {
      console.error('[FlowController] Error in getResumeStep:', error)
      return '/dashboard' // Safe fallback for existing users
    }
  }

  private isSurveyComplete(completedSteps: number[]): boolean {
    return completedSteps.includes(7) // Survey is step 7
  }

  private isMembershipSelected(completedSteps: number[]): boolean {
    return completedSteps.includes(9) // Membership is step 9
  }
}

/**
 * Factory function for server-side use
 * Creates flow controller with server-compatible Supabase client
 */
export async function getServerOnboardingFlowController(): Promise<OnboardingFlowController> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  console.log('[FLOW] Server controller created (server client)')
  return new OnboardingFlowController(supabase)
}

/**
 * Factory function for client-side use
 * Creates flow controller with browser-compatible Supabase client
 */
export function getClientOnboardingFlowController(): OnboardingFlowController {
  // Use require to avoid tree-shaking issues
  const { createClient } = require('@/lib/supabase/client')
  const supabase = createClient()
  return new OnboardingFlowController(supabase)
}