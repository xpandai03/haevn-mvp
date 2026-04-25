/**
 * Admin API Route: Regenerate AI Summary
 *
 * Re-runs the full AI summary pipeline for a single partnership:
 * answers -> normalizeAnswers -> buildSummaryInput -> generateSummaries -> DB update
 *
 * Returns old and new summaries for comparison.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/admin/allowlist'
import { normalizeAnswers } from '@/lib/matching/utils/normalizeAnswers'
import { buildSummaryInput } from '@/lib/ai/buildSummaryInput'
import { generateSummaries } from '@/lib/ai/generateSummaries'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email || !isAdminUser(user.email)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { partnershipId } = body

    if (!partnershipId) {
      return NextResponse.json(
        { success: false, error: 'partnershipId is required' },
        { status: 400 }
      )
    }

    const adminClient = await createAdminClient()

    const { data: partnership } = await adminClient
      .from('partnerships')
      .select('display_name, connection_summary, haevn_insight')
      .eq('id', partnershipId)
      .single()

    if (!partnership) {
      return NextResponse.json(
        { success: false, error: 'Partnership not found' },
        { status: 404 }
      )
    }

    const oldSummary = partnership.connection_summary
    const oldInsight = partnership.haevn_insight

    const { data: members } = await adminClient
      .from('partnership_members')
      .select('user_id')
      .eq('partnership_id', partnershipId)
      .eq('role', 'owner')
      .limit(1)

    if (!members || members.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No owner found for partnership' },
        { status: 404 }
      )
    }

    const { data: survey } = await adminClient
      .from('user_survey_responses')
      .select('answers_json')
      .eq('user_id', members[0].user_id)
      .single()

    if (!survey?.answers_json) {
      return NextResponse.json(
        { success: false, error: 'No survey answers found' },
        { status: 404 }
      )
    }

    const normalized = normalizeAnswers(survey.answers_json as Record<string, any>)
    const summaryInput = buildSummaryInput({
      answers: normalized,
      displayName: partnership.display_name || 'Unknown',
    })

    console.log(`[API /admin/regenerate-summary] Admin ${user.email} regenerating for ${partnershipId}`)

    const result = await generateSummaries(summaryInput)

    // Same gate as the user-facing route: if AI was unavailable, return
    // 503 and skip the DB write so we don't overwrite an existing
    // summary with the deterministic fallback.
    if (result.error) {
      console.error(
        '[API /admin/regenerate-summary] AI unavailable, skipping DB write:',
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

    const now = new Date().toISOString()
    const { error: updateError } = await adminClient
      .from('partnerships')
      .update({
        connection_summary: result.connection_summary,
        haevn_insight: result.haevn_insight,
        summaries_generated_at: now,
        summaries_version: 'v1-admin-regen',
      })
      .eq('id', partnershipId)

    if (updateError) {
      console.error('[API /admin/regenerate-summary] DB update error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Generated but failed to save: ' + updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      old: {
        connection_summary: oldSummary,
        haevn_insight: oldInsight,
      },
      new: {
        connection_summary: result.connection_summary,
        haevn_insight: result.haevn_insight,
        used_fallback: result.used_fallback,
        fields_populated: result.fields_populated,
      },
      generated_at: now,
    })
  } catch (error: any) {
    console.error('[API /admin/regenerate-summary] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to regenerate summary' },
      { status: 500 }
    )
  }
}
