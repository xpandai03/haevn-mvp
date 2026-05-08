import type { SupabaseClient } from '@supabase/supabase-js'
import { selectBestPartnership } from '@/lib/partnership/selectPartnership'
import { FEATURE_FLAGS } from '@/lib/feature-flags'

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
    path: '/onboarding/identity',
    title: 'Your Identity',
    description: 'Tell us who you are and how you connect',
    required: true
  },
  {
    id: 4,
    path: '/onboarding/survey-intro',
    title: 'Survey Introduction',
    description: 'The foundation of meaningful connections',
    required: true
  },
  {
    id: 5,
    path: '/onboarding/survey',
    title: 'Relationship Survey',
    description: 'Help us understand your needs and boundaries',
    required: true
  },
  {
    id: 6,
    path: '/onboarding/celebration',
    title: 'You\'re In!',
    description: 'Celebrate your completion',
    required: true
  },
  {
    id: 7,
    path: '/onboarding/membership',
    title: 'Choose Your Plan',
    description: 'Select your membership level',
    required: true
  },
  {
    id: 8,
    path: '/onboarding/verification',
    title: 'Verification',
    description: 'Keep HAEVN safe and real',
    required: false // Skippable while FEATURE_FLAGS.requireVerification === false
  },
  {
    id: 9,
    path: '/onboarding/verification-complete',
    title: 'Verification Complete',
    description: 'Thanks for verifying',
    required: false // Only shown if verification completed
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
  identityCompleted: boolean
  verificationCompleted: boolean
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
      // Client-side: read from localStorage (the only place this state
      // is persisted right now). Falls back to a fresh default object
      // for first-time visitors so client-side callers (markStepComplete,
      // updateOnboardingState) have something to merge into.
      if (typeof window !== 'undefined') {
        const storedState = localStorage.getItem(`onboarding_state_${userId}`)
        if (storedState) {
          return JSON.parse(storedState)
        }
        return {
          currentStep: 1,
          completedSteps: [],
          expectationsViewed: false,
          identityCompleted: false,
          verificationCompleted: false,
          verificationSkipped: false,
          surveyIntroViewed: false,
          surveyCompleted: false,
          celebrationViewed: false,
          membershipSelected: false
        }
      }

      // Server-side: localStorage isn't reachable, so we have no way to
      // know which steps the user has actually completed. Return null
      // (signal: "no state available") instead of the empty default —
      // returning the empty default tricks getResumeStep into thinking
      // the user has completed nothing, which sends every server-side
      // resume calculation back to /onboarding/expectations regardless
      // of how far the user actually progressed. Callers (getResumeStep)
      // must use DB-derived signals instead when state is null.
      return null
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
          updates.identityCompleted = true
          break
        case 4:
          updates.surveyIntroViewed = true
          break
        case 6:
          updates.celebrationViewed = true
          break
        case 7:
          updates.membershipSelected = true
          break
        case 8:
          updates.verificationSkipped = true // Skip handler calls this
          break
        case 9:
          updates.verificationCompleted = true
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

  async getResumeStep(userId: string): Promise<string | null> {
    try {
      console.log('[FLOW] ===== GET RESUME STEP =====')
      console.log('[FLOW] Getting resume step for user:', userId)

      // Check if user has a partnership (use deterministic selection for multiple)
      const membership = await selectBestPartnership(this.supabase, userId)

      console.log('[FLOW] Partnership membership:', {
        hasPartnership: !!membership,
        partnershipId: membership?.partnership_id,
        role: membership?.role,
        surveyReviewed: membership?.survey_reviewed,
        membershipTier: membership?.membership_tier
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

      // PRIORITY 1: If survey complete, go to dashboard
      // Owners implicitly reviewed (they created it), members must explicitly review
      const isComplete = surveyData?.completion_pct === 100 &&
        (membership.role === 'owner' || membership.survey_reviewed === true)
      console.log('[FLOW] DECISION user=%s pct=%s role=%s reviewed=%s result=%s',
        userId,
        surveyData?.completion_pct,
        membership.survey_reviewed,
        isComplete ? '/dashboard' : 'continue checking'
      )

      if (isComplete) {
        // Survey is complete — but verification (step 8) may still be
        // pending. When localStorage is available (client-side calls), use
        // it as source of truth: if neither completed nor skipped, send
        // the user to /onboarding/verification before allowing dashboard.
        // On server-side calls localStorage isn't reachable, so we keep
        // the legacy short-circuit (the protected-route gate in
        // middleware.ts handles mandatory verification when the
        // FEATURE_FLAGS.requireVerification flag is on).
        if (typeof window !== 'undefined') {
          const stored = window.localStorage.getItem(`onboarding_state_${userId}`)
          if (stored) {
            try {
              const parsed = JSON.parse(stored) as OnboardingState
              const verificationDone = FEATURE_FLAGS.requireVerification
                ? parsed.verificationCompleted === true
                : parsed.verificationCompleted === true || parsed.verificationSkipped === true
              if (!verificationDone) {
                console.log('[FLOW] Survey complete but verification pending, resuming at /onboarding/verification')
                console.log('[FLOW] =========================================')
                return '/onboarding/verification'
              }
            } catch {
              // ignore corrupt localStorage and fall through
            }
          }
        }
        console.log('[FLOW] ✅ Survey complete - SHORT CIRCUIT - no resume needed')
        console.log('[FLOW] =========================================')
        return null  // No resume step needed - onboarding is complete
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
        // No state available — either a returning user predating
        // localStorage tracking, or (more importantly) we're running
        // server-side where localStorage is unreachable. Resume from
        // DB-derived signals instead of the empty client default; that
        // default sends every server-side caller back to
        // /onboarding/expectations and is exactly what causes the
        // post-verification-skip loop.
        console.log('[FlowController] No state available, deriving resume from DB signals')

        if (membership && surveyData) {
          // Survey complete but isComplete returned false earlier (e.g.
          // a non-owner whose review state is still false, transient
          // read of a stale row). Trust the DB completion and let the
          // caller proceed — middleware's verification gate handles any
          // mandatory-verification enforcement separately.
          if (surveyData.completion_pct === 100) {
            console.log('[FlowController] Survey at 100% but isComplete=false — letting through (null)')
            return null
          }
          if (surveyData.completion_pct > 0) {
            console.log('[FlowController] Survey in progress, resuming at /onboarding/survey')
            return '/onboarding/survey'
          }
          // Survey row exists at 0% — they reached the survey but
          // haven't answered anything. Resume at the survey itself,
          // not back at expectations.
          console.log('[FlowController] Survey row at 0%, resuming at /onboarding/survey')
          return '/onboarding/survey'
        }

        if (membership) {
          // Has a partnership but no survey row — they passed identity
          // (which is what creates the partnership) but haven't started
          // the survey yet. Resume at survey-intro, NOT at expectations
          // — going back to expectations would be a regression.
          console.log('[FlowController] Has partnership, no survey — resuming at /onboarding/survey-intro')
          return '/onboarding/survey-intro'
        }

        // No partnership, no survey — genuinely a new user.
        console.log('[FlowController] No partnership, sending to /onboarding/expectations')
        return '/onboarding/expectations'
      }

      // PRIORITY 4: Check localStorage for incomplete steps
      // BUT: Database state (survey complete + reviewed) takes precedence
      // If database says they're done, trust it over localStorage

      // Double-check database state one more time before trusting localStorage
      // Owners implicitly reviewed, members need explicit review
      if (surveyData?.completion_pct === 100 && (membership.role === 'owner' || membership.survey_reviewed)) {
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

        // Verification step: not in `required`, but enforced when the
        // mandatory-verification flag is on. Skip counts as complete only
        // while the flag is off.
        if (step.path === '/onboarding/verification') {
          const verificationDone = FEATURE_FLAGS.requireVerification
            ? state.verificationCompleted === true
            : state.verificationCompleted === true || state.verificationSkipped === true
          if (!verificationDone) {
            console.log('[FlowController] Verification gate not satisfied, resuming at:', step.path, 'flagOn=', FEATURE_FLAGS.requireVerification)
            return step.path
          }
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