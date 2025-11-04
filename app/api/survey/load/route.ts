import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  console.log('[API /survey/load] ===== LOAD REQUEST =====')

  // DEBUG: Check what cookies are available
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  console.log('[API /survey/load] Available cookies:', allCookies.map(c => c.name).join(', '))
  const sbCookies = allCookies.filter(c => c.name.startsWith('sb-'))
  console.log('[API /survey/load] Supabase cookies found:', sbCookies.length)

  const supabase = await createClient()

  // Check server-side session
  console.log('[API /survey/load] Calling getSession()...')
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  console.log('[API /survey/load] Session result:', {
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id,
    expiresAt: session?.expires_at,
    error: sessionError?.message
  })

  // Verify session is valid
  if (!session || !session.user) {
    console.error('[API /survey/load] ❌ NO SESSION FOUND')
    return NextResponse.json(
      { data: null, error: 'Not authenticated', code: 'NO_SESSION' },
      { status: 401 }
    )
  }

  const user = session.user
  console.log('[API /survey/load] ✅ User authenticated:', user.id)

  try {
    // Use admin client to bypass RLS
    const adminClient = createAdminClient()

    // Get user's partnership
    console.log('[API /survey/load] Fetching user partnership...')
    const { data: membership, error: membershipError } = await adminClient
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError && membershipError.code !== 'PGRST116') {
      console.error('[API /survey/load] Partnership lookup error:', membershipError)
    }

    if (!membership || !membership.partnership_id) {
      console.log('[API /survey/load] No partnership found - returning empty survey')
      return NextResponse.json({
        data: {
          answers_json: {},
          completion_pct: 0,
          current_step: 0,
          completed_sections: []
        },
        error: null
      })
    }

    const partnershipId = membership.partnership_id

    // DEFENSIVE GUARD: Validate partnership_id before querying
    if (!partnershipId || typeof partnershipId !== 'string' || partnershipId.length < 10) {
      console.warn('[API /survey/load] ⚠️ Missing or invalid partnershipId:', partnershipId)
      console.warn('[API /survey/load] Guard active before user_survey_responses query')
      console.log('[API /survey/load] Returning empty survey to prevent 400 error')
      return NextResponse.json({
        data: {
          answers_json: {},
          completion_pct: 0,
          current_step: 0,
          completed_sections: []
        },
        error: null
      })
    }

    console.log('[API /survey/load] ✅ Guard active before user_survey_responses query:', partnershipId)

    // Try to get existing survey data for partnership
    console.log('[API /survey/load] Querying user_survey_responses for partnership_id:', partnershipId)
    const { data, error } = await adminClient
      .from('user_survey_responses')
      .select('answers_json, completion_pct, current_step, completed_sections')
      .eq('partnership_id', partnershipId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('[API /survey/load] Error:', error)
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      )
    }

    // Return survey data or empty survey
    if (!data) {
      console.log('[API /survey/load] No existing data found for partnership:', partnershipId)
      // Don't create empty record here - let saveUserSurveyData do it
      return NextResponse.json({
        data: {
          answers_json: {},
          completion_pct: 0,
          current_step: 0,
          completed_sections: []
        },
        error: null
      })
    }

    console.log('[API /survey/load] Found existing data for user:', user.id)
    console.log('[API /survey/load] Answers count:', Object.keys(data.answers_json || {}).length)
    console.log('[API /survey/load] Completion:', data.completion_pct + '%')

    return NextResponse.json({
      data: {
        answers_json: (data.answers_json as Record<string, any>) || {},
        completion_pct: data.completion_pct || 0,
        current_step: data.current_step || 0,
        completed_sections: (data.completed_sections as string[]) || []
      },
      error: null
    })
  } catch (err) {
    console.error('[API /survey/load] Unexpected error:', err)
    return NextResponse.json(
      { data: null, error: 'Failed to load survey data' },
      { status: 500 }
    )
  }
}
