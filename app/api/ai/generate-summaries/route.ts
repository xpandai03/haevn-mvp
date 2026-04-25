/**
 * HAEVN AI Trust Layer — Summary Generation API
 *
 * POST /api/ai/generate-summaries
 *
 * Generates Connection Summary + HAEVN Insight for a partnership.
 *
 * Flow:
 * 1. Authenticate user
 * 2. Fetch partnership + survey answers
 * 3. Normalize answers → buildSummaryInput()
 * 4. Generate summaries via Claude
 * 5. Store in partnerships table
 * 6. Return summaries
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeAnswers } from '@/lib/matching/utils/normalizeAnswers'
import type { RawAnswers } from '@/lib/matching/types'
import { buildSummaryInput } from '@/lib/ai/buildSummaryInput'
import { generateSummaries } from '@/lib/ai/generateSummaries'

export async function POST(request: NextRequest) {
  console.log('[API /ai/generate-summaries] ===== REQUEST =====')

  // 1. Authenticate
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user || authError) {
    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    )
  }

  // 2. Parse request
  let partnershipId: string
  try {
    const body = await request.json()
    partnershipId = body.partnershipId
    if (!partnershipId || typeof partnershipId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'partnershipId is required' },
        { status: 400 }
      )
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    )
  }

  console.log('[API /ai/generate-summaries] Partnership:', partnershipId)

  try {
    const adminClient = createAdminClient()

    // 3. Verify user belongs to this partnership
    const { data: membership } = await adminClient
      .from('partnership_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('partnership_id', partnershipId)
      .single()

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Not a member of this partnership' },
        { status: 403 }
      )
    }

    // 4. Fetch partnership display name
    const { data: partnership, error: partnershipError } = await adminClient
      .from('partnerships')
      .select('display_name')
      .eq('id', partnershipId)
      .single()

    if (partnershipError || !partnership) {
      return NextResponse.json(
        { success: false, error: 'Partnership not found' },
        { status: 404 }
      )
    }

    // 5. Fetch survey answers
    const { data: surveyData, error: surveyError } = await adminClient
      .from('user_survey_responses')
      .select('answers_json')
      .eq('user_id', user.id)
      .eq('partnership_id', partnershipId)
      .single()

    if (surveyError || !surveyData?.answers_json) {
      return NextResponse.json(
        { success: false, error: 'No survey data found' },
        { status: 404 }
      )
    }

    console.log('[API /ai/generate-summaries] Survey answers loaded, normalizing...')

    // 6. Normalize answers (internal keys → CSV keys)
    const rawAnswers = surveyData.answers_json as RawAnswers
    const normalized = normalizeAnswers(rawAnswers)

    // 7. Build safe summary input
    const summaryInput = buildSummaryInput({
      answers: normalized,
      displayName: partnership.display_name || 'This user',
    })

    console.log('[API /ai/generate-summaries] Summary input built, generating...')

    // 8. Generate summaries
    const result = await generateSummaries(summaryInput)

    // If the AI call genuinely failed (quota, network, missing key) the
    // generator returns placeholder strings AND sets `result.error`.
    // Surface a 503 to the client and DO NOT persist the placeholder —
    // otherwise we'd write the deterministic fallback string into
    // partnerships.haevn_insight, which the profile page would then
    // detect as fallback and re-prompt the user to Generate again,
    // creating an infinite loop.
    if (result.error) {
      console.error(
        '[API /ai/generate-summaries] AI unavailable, skipping DB write:',
        result.error.code,
        result.error.detail || ''
      )
      return NextResponse.json(
        {
          success: false,
          error: result.error.code,
          message: result.error.message,
        },
        { status: 503 }
      )
    }

    console.log('[API /ai/generate-summaries] Generation complete:', {
      used_fallback: result.used_fallback,
      fields_populated: result.fields_populated,
      connection_summary_length: result.connection_summary.split(/\s+/).length,
      haevn_insight_length: result.haevn_insight.split(/\s+/).length,
    })

    // 9. Store in DB
    const { error: updateError } = await adminClient
      .from('partnerships')
      .update({
        connection_summary: result.connection_summary,
        haevn_insight: result.haevn_insight,
        summaries_version: 'v1',
        summaries_generated_at: new Date().toISOString(),
      })
      .eq('id', partnershipId)

    if (updateError) {
      console.error('[API /ai/generate-summaries] DB update failed:', updateError)
      // Still return the summaries even if storage fails
      return NextResponse.json({
        success: true,
        stored: false,
        warning: 'Summaries generated but storage failed',
        connection_summary: result.connection_summary,
        haevn_insight: result.haevn_insight,
        used_fallback: result.used_fallback,
        fields_populated: result.fields_populated,
      })
    }

    console.log('[API /ai/generate-summaries] ✅ Summaries stored successfully')

    return NextResponse.json({
      success: true,
      stored: true,
      connection_summary: result.connection_summary,
      haevn_insight: result.haevn_insight,
      used_fallback: result.used_fallback,
      fields_populated: result.fields_populated,
    })

  } catch (error) {
    console.error('[API /ai/generate-summaries] ❌ Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'summary_generation_failed',
        message: 'Failed to generate summary. Please try again.',
      },
      { status: 500 }
    )
  }
}
