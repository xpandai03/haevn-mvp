import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/admin/allowlist'
import {
  extractSubmissions,
  mapEmergentSubmission,
  type EmergentSubmission,
} from '@/lib/import/emergentImport'

export const maxDuration = 300

function tempPassword(): string {
  // 24 random url-safe chars — users reset via email / Google OAuth.
  return randomBytes(18).toString('base64url')
}

function isDuplicateError(err: { message?: string; code?: string; status?: number }): boolean {
  const msg = (err?.message || '').toLowerCase()
  return (
    err?.code === 'email_exists' ||
    err?.status === 422 ||
    msg.includes('already been registered') ||
    msg.includes('already registered') ||
    msg.includes('already exists')
  )
}

interface ImportResults {
  total: number
  eligible: number
  imported: number
  skippedExisting: number
  skippedIneligible: number
  errors: string[]
  markets: Record<string, number>
  honeypotImported: number
  matchesComputed: number
}

export async function POST(request: NextRequest) {
  // --- Admin gate (logged-in allowlisted user) ---
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminUser(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Accept { users: [...] } or a bare array, or { dryRun, computeMatches }
  const body = (payload || {}) as {
    users?: unknown
    submissions?: unknown
    dryRun?: boolean
    computeMatches?: boolean
  }
  const source = body.users ?? body.submissions ?? payload
  const submissions: EmergentSubmission[] = extractSubmissions(source)

  if (submissions.length === 0) {
    return NextResponse.json({ error: 'No submissions found in payload' }, { status: 400 })
  }

  const dryRun = body.dryRun === true
  const computeMatches = body.computeMatches === true

  const results: ImportResults = {
    total: submissions.length,
    eligible: 0,
    imported: 0,
    skippedExisting: 0,
    skippedIneligible: 0,
    errors: [],
    markets: {},
    honeypotImported: 0,
    matchesComputed: 0,
  }

  const admin = createAdminClient()

  for (const sub of submissions) {
    const mapped = mapEmergentSubmission(sub)
    if (!mapped.eligible) {
      results.skippedIneligible++
      continue
    }
    results.eligible++

    if (dryRun) continue

    try {
      // 1. Auth user (auto-confirmed; random password)
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: mapped.email,
        password: tempPassword(),
        email_confirm: true,
        user_metadata: {
          full_name: mapped.fullName,
          first_name: mapped.firstName,
          source: 'emergent_import',
        },
      })

      if (authError || !authData?.user) {
        if (authError && isDuplicateError(authError)) {
          results.skippedExisting++
        } else {
          results.errors.push(`${mapped.email}: ${authError?.message || 'createUser failed'}`)
        }
        continue
      }

      const userId = authData.user.id

      // 2. profiles (trigger inserts a base row; enrich it)
      await admin
        .from('profiles')
        .upsert(
          {
            user_id: userId,
            full_name: mapped.profile.full_name,
            city: mapped.profile.city,
            msa_status: mapped.profile.msa_status,
            survey_complete: mapped.profile.survey_complete,
          },
          { onConflict: 'user_id' }
        )

      // 3. partnerships — minimal proven insert first
      const { data: partnership, error: partErr } = await admin
        .from('partnerships')
        .insert({
          owner_id: userId,
          city: mapped.partnership.city,
          membership_tier: 'free',
          advocate_mode: false,
          profile_state: mapped.partnership.profile_state,
        })
        .select('id')
        .single()

      if (partErr || !partnership) {
        results.errors.push(`${mapped.email}: partnership insert — ${partErr?.message}`)
        continue
      }
      const partnershipId = partnership.id

      // 3b. Best-effort enrichment of display/derived columns (non-fatal)
      const { error: enrichErr } = await admin
        .from('partnerships')
        .update({
          display_name: mapped.partnership.display_name,
          state: mapped.partnership.state,
          zip_code: mapped.partnership.zip_code,
          age: mapped.partnership.age,
          identity: mapped.partnership.identity,
          phone: mapped.partnership.phone,
          profile_type: mapped.partnership.profile_type,
          orientation: mapped.partnership.orientation,
          structure: mapped.partnership.structure,
          intentions: mapped.partnership.intentions,
        })
        .eq('id', partnershipId)
      if (enrichErr) {
        console.warn('[import] partnership enrich skipped:', mapped.email, enrichErr.message)
      }

      // 4. partnership_members (owner)
      const { error: memberErr } = await admin.from('partnership_members').insert({
        partnership_id: partnershipId,
        user_id: userId,
        role: 'owner',
      })
      if (memberErr) {
        results.errors.push(`${mapped.email}: member insert — ${memberErr.message}`)
        // Roll back the partnership to avoid an orphan.
        await admin.from('partnerships').delete().eq('id', partnershipId)
        continue
      }

      // 5. survey responses (mapped HAEVN answers)
      const { error: surveyErr } = await admin.from('user_survey_responses').upsert(
        {
          user_id: userId,
          partnership_id: partnershipId,
          answers_json: mapped.answers,
          completion_pct: mapped.completionPct,
          current_step: 0,
        },
        { onConflict: 'user_id' }
      )
      if (surveyErr) {
        results.errors.push(`${mapped.email}: survey insert — ${surveyErr.message}`)
      }

      // 5b. Fire-and-forget: generate AI summaries for the imported partnership
      // (non-blocking, skip-if-present). Mirrors app/api/survey/save/route.ts so
      // future imports populate connection_summary/haevn_insight without the
      // backfill. Note: for large bulk imports the backfill remains the reliable
      // path — a serverless function may return before all background calls finish.
      ;(async () => {
        try {
          const { isFallbackInsight } = await import('@/lib/ai/fallbacks')
          const { data: existingP } = await admin
            .from('partnerships')
            .select('haevn_insight, connection_summary')
            .eq('id', partnershipId)
            .single()
          const insight = existingP?.haevn_insight as string | null | undefined
          const summary = existingP?.connection_summary as string | null | undefined
          if (insight?.trim() && !isFallbackInsight(insight) && summary?.trim()) {
            return
          }
          const { normalizeAnswers } = await import('@/lib/matching/utils/normalizeAnswers')
          const { buildSummaryInput } = await import('@/lib/ai/buildSummaryInput')
          const { generateSummaries } = await import('@/lib/ai/generateSummaries')
          const normalized = normalizeAnswers(mapped.answers as any)
          const summaryInput = buildSummaryInput({
            answers: normalized,
            displayName: mapped.partnership.display_name || 'This user',
          })
          const result = await generateSummaries(summaryInput)
          if (result.error) {
            console.error('[import] AI summary unavailable (non-blocking):', result.error.code)
            return
          }
          await admin
            .from('partnerships')
            .update({
              connection_summary: result.connection_summary,
              haevn_insight: result.haevn_insight,
              summaries_version: 'v1',
              summaries_generated_at: new Date().toISOString(),
            })
            .eq('id', partnershipId)
        } catch (aiErr: any) {
          console.error('[import] AI summary generation failed (non-blocking):', aiErr?.message)
        }
      })()

      // 6. Optional inline match computation (defaults off → Match Monday cron)
      if (computeMatches && mapped.partnership.profile_state === 'live') {
        try {
          const { computeMatchesForPartnership } = await import(
            '@/lib/services/computeMatches'
          )
          await computeMatchesForPartnership(partnershipId)
          results.matchesComputed++
        } catch (e: any) {
          console.warn('[import] match compute failed:', mapped.email, e?.message)
        }
      }

      results.imported++
      if (mapped.flags.honeypot) results.honeypotImported++
      const mk = mapped.flags.market || 'Unknown'
      results.markets[mk] = (results.markets[mk] || 0) + 1
    } catch (e: any) {
      results.errors.push(`${mapped.email}: ${e?.message || 'unexpected error'}`)
    }
  }

  return NextResponse.json({ ok: true, dryRun, ...results })
}
