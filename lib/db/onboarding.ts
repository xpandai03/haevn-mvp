import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export interface OnboardingState {
  id: string
  user_id: string
  partnership_id: string
  current_step: number
  completed_steps: string[]
  expectations_viewed: boolean
  welcome_viewed: boolean
  identity_completed: boolean
  verification_skipped: boolean
  survey_intro_viewed: boolean
  survey_completed: boolean
  celebration_viewed: boolean
  membership_selected: boolean
  last_active: string
  updated_at: string
}

// Step mapping for navigation
const STEP_ROUTES = {
  1: '/auth/signup',
  2: '/onboarding/expectations',
  3: '/onboarding/welcome',
  4: '/onboarding/identity',
  5: '/onboarding/verification',
  6: '/onboarding/survey-intro',
  7: '/onboarding/survey',
  8: '/onboarding/celebration',
  9: '/onboarding/membership',
  10: '/dashboard'
} as const

const STEP_NAMES = {
  'signup': 1,
  'expectations': 2,
  'welcome': 3,
  'identity': 4,
  'verification': 5,
  'survey-intro': 6,
  'survey': 7,
  'celebration': 8,
  'membership': 9,
  'dashboard': 10
} as const

/**
 * Get or create onboarding state for a user's partnership
 */
export async function getOrCreateOnboardingState(
  userId: string,
  partnershipId: string
): Promise<OnboardingState | null> {
  const supabase = createClient()

  try {
    // Try to get existing state
    const { data: existingState, error: fetchError } = await supabase
      .from('onboarding_state')
      .select('*')
      .eq('partnership_id', partnershipId)
      .single()

    if (existingState && !fetchError) {
      return existingState
    }

    // Create new state if it doesn't exist
    if (fetchError?.code === 'PGRST116') { // Not found
      const { data: newState, error: createError } = await supabase
        .from('onboarding_state')
        .insert({
          user_id: userId,
          partnership_id: partnershipId,
          current_step: 2, // Start at expectations after signup
          completed_steps: ['signup']
        })
        .select()
        .single()

      if (createError) {
        console.error('Failed to create onboarding state:', createError)
        return null
      }

      return newState
    }

    console.error('Failed to fetch onboarding state:', fetchError)
    return null
  } catch (error) {
    console.error('Error in getOrCreateOnboardingState:', error)
    return null
  }
}

/**
 * Mark a step as completed and advance to the next step
 */
export async function markStepComplete(
  partnershipId: string,
  stepName: keyof typeof STEP_NAMES
): Promise<{ current_step: number; completed_steps: string[] } | null> {
  const supabase = createClient()

  try {
    // Get current state
    const { data: currentState, error: fetchError } = await supabase
      .from('onboarding_state')
      .select('*')
      .eq('partnership_id', partnershipId)
      .single()

    if (fetchError || !currentState) {
      console.error('Failed to fetch onboarding state:', fetchError)
      return null
    }

    // Add step to completed if not already there
    const completedSteps = currentState.completed_steps || []
    if (!completedSteps.includes(stepName)) {
      completedSteps.push(stepName)
    }

    // Calculate next step
    let nextStep = STEP_NAMES[stepName] + 1

    // Update state with specific flags
    const updates: any = {
      completed_steps: completedSteps,
      current_step: Math.max(currentState.current_step, nextStep)
    }

    // Set specific boolean flags based on step
    switch (stepName) {
      case 'expectations':
        updates.expectations_viewed = true
        break
      case 'welcome':
        updates.welcome_viewed = true
        break
      case 'identity':
        updates.identity_completed = true
        break
      case 'survey-intro':
        updates.survey_intro_viewed = true
        break
      case 'survey':
        updates.survey_completed = true
        break
      case 'celebration':
        updates.celebration_viewed = true
        break
      case 'membership':
        updates.membership_selected = true
        break
    }

    // Update the database
    const { data: updatedState, error: updateError } = await supabase
      .from('onboarding_state')
      .update(updates)
      .eq('partnership_id', partnershipId)
      .select('current_step, completed_steps')
      .single()

    if (updateError) {
      console.error('Failed to update onboarding state:', updateError)
      return null
    }

    return updatedState
  } catch (error) {
    console.error('Error in markStepComplete:', error)
    return null
  }
}

/**
 * Determine the next step route based on current state
 */
export function nextStepFrom(state: OnboardingState | null): string {
  if (!state) {
    return '/onboarding/expectations'
  }

  // Check if onboarding is complete
  if (state.membership_selected || state.current_step >= 10) {
    return '/dashboard'
  }

  // Return the route for the current step
  return STEP_ROUTES[state.current_step as keyof typeof STEP_ROUTES] || '/onboarding/expectations'
}

/**
 * Check if a user has completed onboarding
 */
export function isOnboardingComplete(state: OnboardingState | null): boolean {
  if (!state) return false

  // Required steps for MVP (skipping verification)
  const requiredSteps = [
    'expectations',
    'welcome',
    'identity',
    'survey-intro',
    'survey',
    'celebration',
    'membership'
  ]

  return requiredSteps.every(step =>
    state.completed_steps?.includes(step)
  ) || state.membership_selected
}

/**
 * Get onboarding progress percentage
 */
export function getProgressPercentage(state: OnboardingState | null): number {
  if (!state) return 0

  // Total steps minus verification for Phase 1
  const totalSteps = 8 // signup through membership, skipping verification
  const completedCount = state.completed_steps?.length || 0

  return Math.round((completedCount / totalSteps) * 100)
}

/**
 * Get the current step name from step number
 */
export function getStepName(stepNumber: number): string {
  const stepMap: Record<number, string> = {
    1: 'signup',
    2: 'expectations',
    3: 'welcome',
    4: 'identity',
    5: 'verification',
    6: 'survey-intro',
    7: 'survey',
    8: 'celebration',
    9: 'membership',
    10: 'dashboard'
  }

  return stepMap[stepNumber] || 'unknown'
}