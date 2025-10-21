import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateSurveyCompletion } from '@/lib/survey/questions'

export async function POST(request: NextRequest) {
  console.log('[API /survey/save] ===== SAVE REQUEST =====')

  // DEBUG: Check what cookies are available
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  console.log('[API /survey/save] Available cookies:', allCookies.map(c => c.name).join(', '))
  const sbCookies = allCookies.filter(c => c.name.startsWith('sb-'))
  console.log('[API /survey/save] Supabase cookies found:', sbCookies.length)

  const supabase = await createClient()

  // Check server-side session
  console.log('[API /survey/save] Calling getSession()...')
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  console.log('[API /survey/save] Session result:', {
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id,
    expiresAt: session?.expires_at,
    error: sessionError?.message
  })

  // Verify session is valid
  if (!session || !session.user) {
    console.error('[API /survey/save] ❌ NO SESSION FOUND')
    return NextResponse.json(
      { success: false, error: 'Not authenticated', code: 'NO_SESSION' },
      { status: 401 }
    )
  }

  const user = session.user
  console.log('[API /survey/save] ✅ User authenticated:', user.id)

  try {
    // Parse request body
    const body = await request.json()
    const { partialAnswers, currentQuestionIndex, completedSections = [] } = body

    console.log('[API /survey/save] Question index:', currentQuestionIndex)
    console.log('[API /survey/save] Answers:', Object.keys(partialAnswers || {}))

    if (!partialAnswers || typeof currentQuestionIndex !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient()

    // Get existing answers
    console.log('[API /survey/save] Fetching existing answers...')
    const { data: existing, error: selectError } = await adminClient
      .from('user_survey_responses')
      .select('answers_json')
      .eq('user_id', user.id)
      .maybeSingle()

    if (selectError) {
      console.error('[API /survey/save] Select error:', selectError)
      return NextResponse.json(
        { success: false, error: `Failed to fetch existing data: ${selectError.message}` },
        { status: 500 }
      )
    }

    console.log('[API /survey/save] Existing data:', existing ? 'found' : 'none')

    if (existing) {
      console.log('[API /survey/save] Existing answers count:', Object.keys(existing.answers_json || {}).length)
    }

    // Merge answers
    const mergedAnswers = {
      ...(existing?.answers_json as Record<string, any> || {}),
      ...partialAnswers
    }

    console.log('[API /survey/save] Merged answers count:', Object.keys(mergedAnswers).length)
    console.log('[API /survey/save] New partial answers:', Object.keys(partialAnswers))

    // Calculate completion
    const completionPct = calculateSurveyCompletion(mergedAnswers)
    console.log('[API /survey/save] Completion:', completionPct + '%')

    // Update survey response using admin client
    console.log('[API /survey/save] Upserting data...')
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
      console.error('[API /survey/save] Update error:', updateError)
      console.error('[API /survey/save] Error details:', JSON.stringify(updateError, null, 2))
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      )
    }

    console.log('[API /survey/save] Upsert successful:', upsertData)

    // If 100% complete, update profile using admin client
    if (completionPct === 100) {
      await adminClient
        .from('profiles')
        .update({ survey_complete: true })
        .eq('user_id', user.id)
    }

    console.log('[API /survey/save] Saved successfully:', {
      userId: user.id,
      completionPct,
      currentStep: currentQuestionIndex
    })

    return NextResponse.json({
      success: true,
      error: null
    })
  } catch (err) {
    console.error('[API /survey/save] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to save survey data' },
      { status: 500 }
    )
  }
}
