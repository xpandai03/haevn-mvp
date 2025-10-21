'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateSurveyCompletion } from '@/lib/survey/questions'

export interface UserSurveyData {
  answers_json: Record<string, any>
  completion_pct: number
  current_step: number
  completed_sections?: string[]
}

/**
 * Get survey data for the current user
 */
export async function getUserSurveyData(): Promise<{ data: UserSurveyData | null, error: string | null, code?: string }> {
  console.log('[getUserSurveyData] ===== LOAD REQUEST =====')

  // DEBUG: Check what cookies are available
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  console.log('[getUserSurveyData] Available cookies:', allCookies.map(c => c.name).join(', '))
  const sbCookies = allCookies.filter(c => c.name.startsWith('sb-'))
  console.log('[getUserSurveyData] Supabase cookies found:', sbCookies.length)

  const supabase = await createClient()

  // CRITICAL: Check server-side session first
  console.log('[getUserSurveyData] Calling getSession()...')
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  console.log('[getUserSurveyData] Session result:', {
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id,
    expiresAt: session?.expires_at,
    error: sessionError?.message
  })

  // Verify session is valid
  if (!session || !session.user) {
    console.error('[getUserSurveyData] ❌ NO SESSION FOUND')
    return {
      data: null,
      error: 'Not authenticated',
      code: 'NO_SESSION'
    }
  }

  const user = session.user
  console.log('[getUserSurveyData] ✅ User authenticated:', user.id)
  console.log('[getUserSurveyData] Loading survey for user:', user.id)

  try {
    // Use admin client to bypass RLS
    const adminClient = createAdminClient()

    // Try to get existing survey data
    console.log('[getUserSurveyData] Querying user_survey_responses for user_id:', user.id)
    const { data, error } = await adminClient
      .from('user_survey_responses')
      .select('answers_json, completion_pct, current_step, completed_sections')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('[getUserSurveyData] Error:', error)
      return {
        data: null,
        error: error.message
      }
    }

    // Return survey data or empty survey
    if (!data) {
      console.log('[getUserSurveyData] No existing data found - creating empty survey for user:', user.id)

      // Create initial empty survey response using admin client
      const { data: newData, error: insertError } = await adminClient
        .from('user_survey_responses')
        .insert({
          user_id: user.id,
          answers_json: {},
          completion_pct: 0,
          current_step: 0
        })
        .select()
        .single()

      if (insertError) {
        console.error('[getUserSurveyData] Insert error:', insertError)
        // Return empty data even if insert fails
        return {
          data: {
            answers_json: {},
            completion_pct: 0,
            current_step: 0
          },
          error: null
        }
      }

      console.log('[getUserSurveyData] Created empty survey response')
      return {
        data: {
          answers_json: {},
          completion_pct: 0,
          current_step: 0
        },
        error: null
      }
    }

    console.log('[getUserSurveyData] Found existing data for user:', user.id)
    console.log('[getUserSurveyData] Answers count:', Object.keys(data.answers_json || {}).length)
    console.log('[getUserSurveyData] Completion:', data.completion_pct + '%')
    console.log('[getUserSurveyData] Current step:', data.current_step)

    return {
      data: {
        answers_json: (data.answers_json as Record<string, any>) || {},
        completion_pct: data.completion_pct || 0,
        current_step: data.current_step || 0,
        completed_sections: (data.completed_sections as string[]) || []
      },
      error: null
    }
  } catch (err) {
    console.error('[getUserSurveyData] Unexpected error:', err)
    return {
      data: null,
      error: 'Failed to load survey data'
    }
  }
}

/**
 * Save survey data for the current user
 */
export async function saveUserSurveyData(
  partialAnswers: Record<string, any>,
  currentQuestionIndex: number,
  completedSections: string[] = []
): Promise<{ success: boolean, error: string | null, code?: string }> {
  console.log('[saveUserSurveyData] ===== SAVE REQUEST =====')
  console.log('[saveUserSurveyData] Question index:', currentQuestionIndex)
  console.log('[saveUserSurveyData] Answers:', Object.keys(partialAnswers))

  // DEBUG: Check what cookies are available
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  console.log('[saveUserSurveyData] Available cookies:', allCookies.map(c => c.name).join(', '))
  const sbCookies = allCookies.filter(c => c.name.startsWith('sb-'))
  console.log('[saveUserSurveyData] Supabase cookies found:', sbCookies.length)
  sbCookies.forEach(c => console.log(`  - ${c.name}: ${c.value.substring(0, 50)}...`))

  const supabase = await createClient()

  // Check session first (more reliable for server actions)
  console.log('[saveUserSurveyData] Calling getSession()...')
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  console.log('[saveUserSurveyData] Session result:', {
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id,
    expiresAt: session?.expires_at,
    error: sessionError?.message
  })

  if (sessionError) {
    console.error('[saveUserSurveyData] ❌ SESSION ERROR:', sessionError)
    return { success: false, error: 'Session error: ' + sessionError.message, code: 'SESSION_ERROR' }
  }

  if (!session || !session.user) {
    console.error('[saveUserSurveyData] ❌ NO SESSION FOUND')
    return { success: false, error: 'Not authenticated - no session', code: 'NO_SESSION' }
  }

  const user = session.user
  console.log('[saveUserSurveyData] ✅ User authenticated:', user.id)
  console.log('[saveUserSurveyData] Session expires:', new Date(session.expires_at! * 1000).toISOString())

  try {
    // Use admin client to bypass RLS issues (same pattern as matching.ts)
    const adminClient = createAdminClient()

    // Get existing answers
    console.log('[saveUserSurveyData] Fetching existing answers...')
    const { data: existing, error: selectError } = await adminClient
      .from('user_survey_responses')
      .select('answers_json')
      .eq('user_id', user.id)
      .maybeSingle()

    if (selectError) {
      console.error('[saveUserSurveyData] Select error:', selectError)
      return { success: false, error: `Failed to fetch existing data: ${selectError.message}` }
    }

    console.log('[saveUserSurveyData] Existing data:', existing ? 'found' : 'none')

    if (existing) {
      console.log('[saveUserSurveyData] ⚠️ FOUND EXISTING DATA FOR USER:', user.id)
      console.log('[saveUserSurveyData] Existing answers keys:', Object.keys(existing.answers_json || {}))
      console.log('[saveUserSurveyData] Existing answers count:', Object.keys(existing.answers_json || {}).length)
    }

    // Merge answers
    const mergedAnswers = {
      ...(existing?.answers_json as Record<string, any> || {}),
      ...partialAnswers
    }

    console.log('[saveUserSurveyData] Merged answers count:', Object.keys(mergedAnswers).length)
    console.log('[saveUserSurveyData] New partial answers:', Object.keys(partialAnswers))

    // Calculate completion
    const completionPct = calculateSurveyCompletion(mergedAnswers)
    console.log('[saveUserSurveyData] Completion:', completionPct + '%')

    // Update survey response using admin client
    console.log('[saveUserSurveyData] Upserting data...')
    const { error: updateError, data: upsertData } = await adminClient
      .from('user_survey_responses')
      .upsert({
        user_id: user.id,
        answers_json: mergedAnswers,
        completion_pct: completionPct,
        current_step: currentQuestionIndex,
        completed_sections: completedSections
      }, {
        onConflict: 'user_id'
      })
      .select()

    if (updateError) {
      console.error('[saveUserSurveyData] Update error:', updateError)
      console.error('[saveUserSurveyData] Error details:', JSON.stringify(updateError, null, 2))
      return { success: false, error: updateError.message }
    }

    console.log('[saveUserSurveyData] Upsert successful:', upsertData)

    // If 100% complete, update profile using admin client
    if (completionPct === 100) {
      await adminClient
        .from('profiles')
        .update({ survey_complete: true })
        .eq('user_id', user.id)
    }

    console.log('[saveUserSurveyData] Saved successfully:', {
      userId: user.id,
      completionPct,
      currentStep: currentQuestionIndex
    })

    return { success: true, error: null }
  } catch (error) {
    console.error('[saveUserSurveyData] Error:', error)
    return { success: false, error: 'Failed to save survey data' }
  }
}