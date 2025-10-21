import { createClient } from '@/lib/supabase/client'

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
  private supabase = createClient()

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
      console.log('[FlowController] Getting resume step for user:', userId)

      // Check database for survey completion (for existing users who completed before localStorage tracking)
      const { data: surveyData } = await this.supabase
        .from('user_survey_responses')
        .select('completion_pct')
        .eq('user_id', userId)
        .maybeSingle()

      console.log('[FlowController] Survey data:', surveyData)

      // If survey is 100% complete, check membership and go to dashboard
      if (surveyData && surveyData.completion_pct === 100) {
        console.log('[FlowController] Survey complete (100%), sending to dashboard')
        return '/dashboard'
      }

      // Check localStorage for onboarding progress
      const state = await this.getOnboardingState(userId)
      console.log('[FlowController] Onboarding state:', state)

      if (!state) {
        // No localStorage state found
        console.log('[FlowController] No localStorage state found')

        // Check if user has ANY survey data
        if (surveyData && surveyData.completion_pct > 0) {
          // User has started survey, resume from there
          console.log('[FlowController] Survey in progress, resuming at survey')
          return '/onboarding/survey'
        }

        // No survey data - existing user who hasn't started onboarding yet
        // IMPORTANT: Never send authenticated users to /auth/signup!
        // Send them to first onboarding step instead
        console.log('[FlowController] No survey data, sending to first onboarding step')
        return '/onboarding/expectations'
      }

      // Find the first incomplete required step
      for (const step of ONBOARDING_STEPS) {
        // CRITICAL: Skip signup step (step 1) for authenticated users
        // If they're calling this function, they're already authenticated!
        if (step.id === 1) {
          console.log('[FlowController] Skipping signup step - user is authenticated')
          continue
        }

        if (step.required && !state.completedSteps.includes(step.id)) {
          console.log('[FlowController] Resuming at step:', step.path)
          return step.path
        }
      }

      // All required steps complete, go to dashboard
      console.log('[FlowController] All steps complete, going to dashboard')
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

// Singleton instance
let flowController: OnboardingFlowController | null = null

export function getOnboardingFlowController(): OnboardingFlowController {
  if (!flowController) {
    flowController = new OnboardingFlowController()
  }
  return flowController
}