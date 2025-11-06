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

    // Get user's partnership (or create one if doesn't exist)
    console.log('[API /survey/save] Fetching user partnership...')
    const { data: membership, error: membershipError } = await adminClient
      .from('partnership_members')
      .select('partnership_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    let partnershipId: string
    let userRole: string

    if (membershipError) {
      console.error('[API /survey/save] Error fetching partnership:', membershipError)
      return NextResponse.json(
        { success: false, error: `Database error: ${membershipError.message}` },
        { status: 500 }
      )
    }

    if (!membership) {
      // NEW USER: No partnership exists yet - create one automatically
      console.log('[API /survey/save] 🆕 New user detected - creating partnership...')

      try {
        // Create a new partnership
        const { data: newPartnership, error: createError } = await adminClient
          .from('partnerships')
          .insert({
            created_by: user.id,
            partnership_type: 'single' // Default to single, can be changed later
          })
          .select('id')
          .single()

        if (createError || !newPartnership) {
          console.error('[API /survey/save] Failed to create partnership:', createError)
          return NextResponse.json(
            { success: false, error: 'Failed to create partnership' },
            { status: 500 }
          )
        }

        partnershipId = newPartnership.id
        console.log('[API /survey/save] ✅ Created partnership:', partnershipId)

        // Add user as owner of the partnership
        const { error: memberError } = await adminClient
          .from('partnership_members')
          .insert({
            partnership_id: partnershipId,
            user_id: user.id,
            role: 'owner',
            invite_status: 'accepted'
          })

        if (memberError) {
          console.error('[API /survey/save] Failed to create membership:', memberError)
          // Clean up the partnership if member creation failed
          await adminClient
            .from('partnerships')
            .delete()
            .eq('id', partnershipId)

          return NextResponse.json(
            { success: false, error: 'Failed to create partnership membership' },
            { status: 500 }
          )
        }

        userRole = 'owner'
        console.log('[API /survey/save] ✅ Added user as owner')
      } catch (createErr) {
        console.error('[API /survey/save] Unexpected error creating partnership:', createErr)
        return NextResponse.json(
          { success: false, error: 'Failed to initialize user partnership' },
          { status: 500 }
        )
      }
    } else {
      // EXISTING USER: Use their existing partnership
      partnershipId = membership.partnership_id
      userRole = membership.role
      console.log('[API /survey/save] ✅ Using existing partnership:', partnershipId)
    }

    // DEFENSIVE GUARD: Validate partnership_id before querying
    if (!partnershipId || typeof partnershipId !== 'string' || partnershipId.length < 10) {
      console.error('[API /survey/save] ⚠️ Missing or invalid partnershipId:', partnershipId)
      console.error('[API /survey/save] Guard active before user_survey_responses query')
      return NextResponse.json(
        { success: false, error: 'Invalid partnership. Please complete onboarding first.' },
        { status: 400 }
      )
    }

    console.log('[API /survey/save] ✅ Using partnership_id:', partnershipId)
    console.log('[API /survey/save] User ID:', user.id)
    console.log('[API /survey/save] User role:', userRole)

    // Get existing answers for THIS USER (multi-user partnerships = one survey per user)
    console.log('[API /survey/save] Fetching existing user survey...')
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

    // Update survey response for THIS USER (multi-user partnerships = one survey per user)
    console.log('[API /survey/save] Upserting survey for user:', user.id, 'in partnership:', partnershipId)

    // Prepare update data - each user has their own survey record
    const updateData = {
      partnership_id: partnershipId,  // Links to shared partnership
      user_id: user.id,               // Each user has their own record
      answers_json: mergedAnswers,
      completion_pct: completionPct,
      current_step: currentQuestionIndex,
      completed_sections: completedSections
    }

    console.log('[API /survey/save] Update data prepared:', {
      user_id: user.id,
      partnership_id: partnershipId,
      answers_count: Object.keys(mergedAnswers).length,
      completion_pct: completionPct
    })

    // Upsert by user_id (unique per user, NOT per partnership)
    const { error: updateError, data: upsertData } = await adminClient
      .from('user_survey_responses')
      .upsert(updateData)
      .eq('user_id', user.id)
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

    // Auto-mark owner as having reviewed the survey (they created it)
    if (userRole === 'owner') {
      console.log('[API /survey/save] Auto-marking owner as reviewed')
      await adminClient
        .from('partnership_members')
        .update({
          survey_reviewed: true,
          survey_reviewed_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('partnership_id', partnershipId)
    }

    // If 100% complete, update profile using admin client
    if (completionPct === 100) {
      await adminClient
        .from('profiles')
        .update({ survey_complete: true })
        .eq('user_id', user.id)
    }

    console.log('[API /survey/save] Saved successfully:', {
      partnershipId,
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
