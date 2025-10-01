'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type OnboardingStep = 'identity' | 'survey' | 'membership' | 'completed'

export interface OnboardingState {
  user_id: string
  current_step: OnboardingStep
  completed_steps: string[]
  identity_completed: boolean
  survey_completed: boolean
  membership_selected: boolean
  last_active: string
  created_at: string
  updated_at: string
}

export async function getOnboardingState() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('user_onboarding_state')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('Error fetching onboarding state:', error)
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

export async function updateOnboardingState(updates: Partial<OnboardingState>) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // First, try to get existing state
  const { data: existingState } = await supabase
    .from('user_onboarding_state')
    .select('*')
    .eq('user_id', user.id)
    .single()

  let result
  if (existingState) {
    // Update existing state
    result = await supabase
      .from('user_onboarding_state')
      .update({
        ...updates,
        last_active: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single()
  } else {
    // Create new state
    result = await supabase
      .from('user_onboarding_state')
      .insert({
        user_id: user.id,
        current_step: 'identity',
        completed_steps: [],
        identity_completed: false,
        survey_completed: false,
        membership_selected: false,
        ...updates,
        last_active: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
  }

  if (result.error) {
    console.error('Error updating onboarding state:', result.error)
    return { success: false, error: result.error.message }
  }

  return { success: true, data: result.data }
}

export async function markStepCompleted(step: 'identity' | 'survey' | 'membership') {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get current state or create new one
  const { data: currentState } = await getOnboardingState()

  const completed_steps = currentState?.completed_steps || []
  if (!completed_steps.includes(step)) {
    completed_steps.push(step)
  }

  // Determine next step
  let nextStep: OnboardingStep = 'identity'
  let updates: Partial<OnboardingState> = {
    completed_steps
  }

  switch (step) {
    case 'identity':
      updates.identity_completed = true
      updates.current_step = 'survey'
      nextStep = 'survey'
      break
    case 'survey':
      updates.survey_completed = true
      updates.current_step = 'membership'
      nextStep = 'membership'
      break
    case 'membership':
      updates.membership_selected = true
      updates.current_step = 'completed'
      nextStep = 'completed'
      break
  }

  const result = await updateOnboardingState(updates)

  if (!result.success) {
    console.error('Failed to mark step completed:', result.error)
    return { success: false, error: result.error, nextStep: null }
  }

  return { success: true, nextStep }
}

export async function resetOnboardingState() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('user_onboarding_state')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    console.error('Error resetting onboarding state:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}