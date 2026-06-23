/**
 * TEMPORARY admin-gated backfill endpoint for partnerships.connection_summary.
 * =============================================================================
 * ⚠️  DELETE THIS FILE after the one-off backfill run (step 6). It exists only
 * because OPENAI_API_KEY is server-only (Vercel env), so generation must run in
 * a deployed context rather than a local script.
 *
 * Reuses the EXACT generation + persistence flow from
 * app/api/ai/generate-summaries/route.ts (normalizeAnswers → buildSummaryInput →
 * generateSummaries → persist connection_summary/haevn_insight/summaries_version/
 * summaries_generated_at). The generator is NOT modified. Idempotent (skips
 * non-null), never persists on result.error, per-row failures collected.
 *
 * Auth: requires the one-off secret (?secret= or x-backfill-secret header). A
 * logged-in non-admin is additionally rejected. The OpenAI key is read from
 * server env only and never logged or returned.
 *
 * Usage (GET):
 *   /api/admin/backfill-summaries?secret=...            → count only (no writes)
 *   /api/admin/backfill-summaries?secret=...&mode=sample → process 5, return verbatim
 *   /api/admin/backfill-summaries?secret=...&mode=all    → process remaining eligible
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/admin/allowlist'
import { normalizeAnswers } from '@/lib/matching/utils/normalizeAnswers'
import { buildSummaryInput } from '@/lib/ai/buildSummaryInput'
import { generateSummaries } from '@/lib/ai/generateSummaries'
import type { RawAnswers } from '@/lib/matching/types'

export const maxDuration = 300

// One-off secret. This file is deleted after the run, so the literal goes with it.
const BACKFILL_SECRET = 'OCsBLScTC1wyhAOfnVuSycQV5JFiHWeh'
const SAMPLE_SIZE = 5
const CONCURRENCY = 5

function secretOk(provided: string | null): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(BACKFILL_SECRET)
  return a.length === b.length && timingSafeEqual(a, b)
}

interface RowResult {
  partnershipId: string
  status: 'persisted' | 'skipped' | 'failed'
  reason?: string
  name?: string
  connection_summary?: string
  haevn_insight?: string
}

export async function GET(request: NextRequest) {
  // ── Gate 1: one-off secret (works for curl; primary gate) ──
  const url = new URL(request.url)
  const provided = url.searchParams.get('secret') || request.headers.get('x-backfill-secret')
  if (!secretOk(provided)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Gate 2: if a session exists, it must be an admin (reject non-admins) ──
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user && !isAdminUser(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch {
    /* no session (curl) — secret already authorized */
  }

  const mode = url.searchParams.get('mode') // 'sample' | 'all' | null
  const admin = createAdminClient()

  // Eligible: live partnerships with NULL/empty connection_summary.
  const { data: parts, error } = await admin
    .from('partnerships')
    .select('id, display_name, connection_summary, profile_state')
    .eq('profile_state', 'live')
    .limit(3000)
  if (error) {
    return NextResponse.json({ error: `fetch partnerships: ${error.message}` }, { status: 500 })
  }
  const eligible = (parts ?? []).filter(
    (p: any) => !p.connection_summary || !String(p.connection_summary).trim()
  )

  if (mode !== 'sample' && mode !== 'all') {
    return NextResponse.json({
      mode: 'count',
      live: parts?.length ?? 0,
      null_connection_summary: eligible.length,
      hint: 'Re-call with &mode=sample (5 rows, returns verbatim) then &mode=all.',
    })
  }

  const targets = mode === 'sample' ? eligible.slice(0, SAMPLE_SIZE) : eligible

  async function processRow(p: any): Promise<RowResult> {
    try {
      // Idempotency re-check.
      const { data: fresh } = await admin
        .from('partnerships').select('connection_summary').eq('id', p.id).single()
      if (fresh?.connection_summary && String(fresh.connection_summary).trim()) {
        return { partnershipId: p.id, status: 'skipped', reason: 'already has summary' }
      }
      // Owner member → survey answers.
      const { data: owner } = await admin
        .from('partnership_members').select('user_id, role')
        .eq('partnership_id', p.id).order('role', { ascending: false }).limit(1).maybeSingle()
      if (!owner?.user_id) {
        return { partnershipId: p.id, status: 'failed', reason: 'no partnership member' }
      }
      const { data: survey } = await admin
        .from('user_survey_responses').select('answers_json')
        .eq('user_id', owner.user_id).eq('partnership_id', p.id).maybeSingle()
      if (!survey?.answers_json || Object.keys(survey.answers_json).length === 0) {
        return { partnershipId: p.id, status: 'failed', reason: 'no survey answers_json' }
      }
      // EXACT existing flow.
      const normalized = normalizeAnswers(survey.answers_json as RawAnswers)
      const input = buildSummaryInput({ answers: normalized, displayName: p.display_name || 'This user' })
      const result = await generateSummaries(input)
      if (result.error) {
        return { partnershipId: p.id, status: 'failed', reason: `ai_error:${result.error.code}` }
      }
      if (!result.connection_summary?.trim() || !result.haevn_insight?.trim()) {
        return { partnershipId: p.id, status: 'failed', reason: 'empty_output' }
      }
      const { error: upErr } = await admin
        .from('partnerships')
        .update({
          connection_summary: result.connection_summary,
          haevn_insight: result.haevn_insight,
          summaries_version: 'v1',
          summaries_generated_at: new Date().toISOString(),
        })
        .eq('id', p.id)
      if (upErr) {
        return { partnershipId: p.id, status: 'failed', reason: `persist:${upErr.message}` }
      }
      return {
        partnershipId: p.id,
        status: 'persisted',
        name: p.display_name || '(no name)',
        connection_summary: result.connection_summary,
        haevn_insight: result.haevn_insight,
      }
    } catch (e: any) {
      return { partnershipId: p.id, status: 'failed', reason: `exception:${e?.message || e}` }
    }
  }

  // Bounded concurrency so a full run fits within maxDuration.
  const results: RowResult[] = new Array(targets.length)
  let idx = 0
  async function worker() {
    while (idx < targets.length) {
      const i = idx++
      results[i] = await processRow(targets[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker))

  const persisted = results.filter((r) => r.status === 'persisted')
  const skipped = results.filter((r) => r.status === 'skipped')
  const failed = results.filter((r) => r.status === 'failed')

  return NextResponse.json({
    mode,
    eligible_total: eligible.length,
    processed: targets.length,
    persisted: persisted.length,
    skipped: skipped.length,
    failed: failed.length,
    failures: failed.map((f) => ({ id: f.partnershipId, reason: f.reason })),
    // Sample mode returns verbatim text for human quality review.
    samples:
      mode === 'sample'
        ? persisted.map((r) => ({
            id: r.partnershipId,
            name: r.name,
            connection_summary: r.connection_summary,
            haevn_insight: r.haevn_insight,
          }))
        : undefined,
  })
}
