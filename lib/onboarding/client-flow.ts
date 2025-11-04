/**
 * Client-Only Onboarding Flow Controller
 *
 * IMPORTANT: This version contains NO database queries.
 * All methods use localStorage only. Safe for client-side bundling.
 *
 * For server-side operations (like getResumeStep), use the API route:
 * GET /api/onboarding/resume-step
 */

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
    title: "You're In!",
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

/**
 * Client-Safe Onboarding Flow Controller
 *
 * Uses localStorage only - NO database queries
 * Safe to bundle in client-side JavaScript
 */
export class ClientOnboardingFlowController {
  /**
   * Get onboarding state from localStorage
   * NO database access - client-safe
   */
  async getOnboardingState(userId: string): Promise<OnboardingState | null> {
    try {
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
      console.error('[ClientFlow] Error in getOnboardingState:', error)
      return null
    }
  }

  /**
   * Update onboarding state in localStorage
   * NO database access - client-safe
   */
  async updateOnboardingState(
    userId: string,
    updates: Partial<OnboardingState>
  ): Promise<boolean> {
    try {
      const currentState = await this.getOnboardingState(userId)
      if (!currentState) return false

      const newState = { ...currentState, ...updates }

      if (typeof window !== 'undefined') {
        localStorage.setItem(`onboarding_state_${userId}`, JSON.stringify(newState))
      }

      return true
    } catch (error) {
      console.error('[ClientFlow] Error in updateOnboardingState:', error)
      return false
    }
  }

  /**
   * Mark a step as complete in localStorage
   * NO database access - client-safe
   */
  async markStepComplete(userId: string, stepId: number): Promise<boolean> {
    try {
      const state = await this.getOnboardingState(userId)
      if (!state) return false

      const completedSteps = state.completedSteps || []
      if (!completedSteps.includes(stepId)) {
        completedSteps.push(stepId)
      }

      const updates: Partial<OnboardingState> = {
        completedSteps,
        currentStep: Math.min(stepId + 1, ONBOARDING_STEPS.length)
      }

      // Update specific flags based on step
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
          updates.verificationSkipped = true
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
      console.error('[ClientFlow] Error marking step complete:', error)
      return false
    }
  }

  /**
   * Get next step info
   * Pure function - client-safe
   */
  getNextStep(currentStep: number): OnboardingStep | null {
    const nextIndex = ONBOARDING_STEPS.findIndex(s => s.id === currentStep + 1)
    return nextIndex >= 0 ? ONBOARDING_STEPS[nextIndex] : null
  }

  /**
   * Get previous step info
   * Pure function - client-safe
   */
  getPreviousStep(currentStep: number): OnboardingStep | null {
    const prevIndex = ONBOARDING_STEPS.findIndex(s => s.id === currentStep - 1)
    return prevIndex >= 0 ? ONBOARDING_STEPS[prevIndex] : null
  }

  /**
   * Check if user can access a step
   * Pure function - client-safe
   */
  canAccessStep(stepId: number, completedSteps: number[]): boolean {
    if (completedSteps.includes(stepId)) return true

    const requiredSteps = ONBOARDING_STEPS
      .filter(s => s.id < stepId && s.required)
      .map(s => s.id)

    return requiredSteps.every(id => completedSteps.includes(id))
  }

  /**
   * Calculate progress percentage
   * Pure function - client-safe
   */
  getProgressPercentage(completedSteps: number[]): number {
    const requiredSteps = ONBOARDING_STEPS.filter(s => s.required)
    const completedRequired = requiredSteps.filter(s =>
      completedSteps.includes(s.id)
    ).length

    return Math.round((completedRequired / requiredSteps.length) * 100)
  }

  /**
   * NOTE: getResumeStep() has been REMOVED from client controller
   *
   * Use the API route instead:
   *
   * const response = await fetch('/api/onboarding/resume-step', {
   *   credentials: 'include'
   * })
   * const { resumePath } = await response.json()
   */
}

/**
 * Factory function for client-side use
 * Returns controller with NO database access
 */
export function getClientOnboardingFlowController(): ClientOnboardingFlowController {
  return new ClientOnboardingFlowController()
}
