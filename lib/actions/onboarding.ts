'use server'

import { createClient } from '@/lib/supabase/server'
import {
  getOrCreateOnboardingState as getOrCreateOnboardingStateDb,
  markStepComplete as markStepCompleteDb,
  nextStepFrom,
  isOnboardingComplete,
  type OnboardingState
} from '@/lib/db/onboarding'
import { getCurrentPartnershipId } from '@/lib/actions/partnership'

/**
 * Server action to get or create onboarding state for current user
 */
export async function getOnboardingState(): Promise<{
  state: OnboardingState | null
  nextStep: string
  error: string | null
}> {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { state: null, nextStep: '/auth/login', error: 'Not authenticated' }
    }

    // Get current partnership
    const { id: partnershipId, error: partnershipError } = await getCurrentPartnershipId()

    if (partnershipError || !partnershipId) {
      return { state: null, nextStep: '/auth/signup', error: 'No partnership found' }
    }

    // Get or create onboarding state
    const state = await getOrCreateOnboardingStateDb(user.id, partnershipId)

    if (!state) {
      return { state: null, nextStep: '/onboarding/expectations', error: 'Failed to load onboarding state' }
    }

    const nextStep = nextStepFrom(state)

    return { state, nextStep, error: null }
  } catch (error) {
    console.error('Error in getOnboardingState:', error)
    return { state: null, nextStep: '/auth/login', error: 'Internal error' }
  }
}

/**
 * Server action to mark a step as complete
 */
export async function completeOnboardingStep(
  stepName: string
): Promise<{
  success: boolean
  nextStep: string
  error: string | null
}> {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, nextStep: '/auth/login', error: 'Not authenticated' }
    }

    // Get current partnership
    const { id: partnershipId, error: partnershipError } = await getCurrentPartnershipId()

    if (partnershipError || !partnershipId) {
      return { success: false, nextStep: '/auth/signup', error: 'No partnership found' }
    }

    // Mark step as complete
    const result = await markStepCompleteDb(partnershipId, stepName as any)

    if (!result) {
      return { success: false, nextStep: '/onboarding/expectations', error: 'Failed to update progress' }
    }

    // Get updated state to determine next step
    const state = await getOrCreateOnboardingStateDb(user.id, partnershipId)
    const nextStep = nextStepFrom(state)

    return { success: true, nextStep, error: null }
  } catch (error) {
    console.error('Error in completeOnboardingStep:', error)
    return { success: false, nextStep: '/onboarding/expectations', error: 'Internal error' }
  }
}

/**
 * Server action to check if onboarding is complete
 */
export async function checkOnboardingComplete(): Promise<boolean> {
  const { state } = await getOnboardingState()
  return isOnboardingComplete(state)
}

/**
 * Server action to update identity fields in partnership
 */
export async function updateIdentityFields(
  profileType: 'solo' | 'couple' | 'pod',
  relationshipOrientation: string[]
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Use the database function to avoid RLS recursion
    const { data, error: updateError } = await supabase
      .rpc('update_identity_fields', {
        p_user_id: user.id,
        p_profile_type: profileType,
        p_orientation: relationshipOrientation
      })

    if (updateError) {
      console.error('Failed to update identity fields:', updateError)

      // Fallback: try to get/create partnership first
      const { id: partnershipId, error: partnershipError } = await getCurrentPartnershipId()

      if (!partnershipError && partnershipId) {
        // Try direct update if we have a partnership
        const { error: directUpdateError } = await supabase
          .from('partnerships')
          .update({
            profile_type: profileType,
            relationship_orientation: relationshipOrientation
          })
          .eq('id', partnershipId)
          .eq('owner_id', user.id) // Extra safety check

        if (!directUpdateError) {
          return { success: true, error: null }
        }
      }

      return { success: false, error: 'Failed to save identity' }
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('Error in updateIdentityFields:', error)
    return { success: false, error: 'Internal error' }
  }
}

/**
 * Server action to update membership tier
 */
export async function updateMembershipTier(
  tier: 'free' | 'standard' | 'select'
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get current partnership
    const { id: partnershipId, error: partnershipError } = await getCurrentPartnershipId()

    if (partnershipError || !partnershipId) {
      return { success: false, error: 'No partnership found' }
    }

    // Update partnership with membership tier
    const { error: updateError } = await supabase
      .from('partnerships')
      .update({
        membership_tier: tier,
        onboarding_completed_at: new Date().toISOString()
      })
      .eq('id', partnershipId)

    if (updateError) {
      console.error('Failed to update membership tier:', updateError)
      return { success: false, error: 'Failed to save membership' }
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('Error in updateMembershipTier:', error)
    return { success: false, error: 'Internal error' }
  }
}