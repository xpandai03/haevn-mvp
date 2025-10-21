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

    // Try to get existing survey data
    console.log('[API /survey/load] Querying user_survey_responses for user_id:', user.id)
    const { data, error } = await adminClient
      .from('user_survey_responses')
      .select('answers_json, completion_pct, current_step, completed_sections')
      .eq('user_id', user.id)
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
      console.log('[API /survey/load] No existing data found - creating empty survey for user:', user.id)

      // Create initial empty survey response
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
        console.error('[API /survey/load] Insert error:', insertError)
        // Return empty data even if insert fails
        return NextResponse.json({
          data: {
            answers_json: {},
            completion_pct: 0,
            current_step: 0
          },
          error: null
        })
      }

      console.log('[API /survey/load] Created empty survey response')
      return NextResponse.json({
        data: {
          answers_json: {},
          completion_pct: 0,
          current_step: 0
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
