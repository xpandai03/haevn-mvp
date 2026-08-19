/**
 * POST /api/admin/match-interpretation-sample — QA harness (NOT member-facing).
 *
 * Generates real match interpretations for explicitly-specified pairs and returns
 * the exact prompt + result + token usage/cost, WITHOUT persisting to the cache
 * (dry run). Purpose: review AI copy quality against the client's AI doc before
 * any UI exists. Gated on Authorization: Bearer ${CRON_SECRET} (server-secret,
 * same as the crons) so it can be exercised without a browser admin session.
 *
 * Body: { pairs: [{ viewer: <partnershipId>, match: <partnershipId>, label?: string }], includePrompt?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseSections } from '@/lib/matches/sectionMapping'
import { assembleInterpretationForPair } from '@/lib/matches/getMatchInterpretation'
import { generateMatchInterpretation } from '@/lib/ai/generateMatchInterpretation'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const pairs: Array<{ viewer: string; match: string; label?: string }> = Array.isArray(body?.pairs) ? body.pairs : []
  const includePrompt = body?.includePrompt !== false
  if (pairs.length === 0) return NextResponse.json({ error: 'no pairs provided' }, { status: 400 })

  const admin = createAdminClient()
  let systemPrompt: string | null = null
  let totalCost = 0
  const samples: any[] = []

  for (const p of pairs) {
    const { data: cm } = await admin
      .from('computed_matches')
      .select('score, breakdown')
      .or(
        `and(partnership_a.eq.${p.viewer},partnership_b.eq.${p.match}),` +
          `and(partnership_a.eq.${p.match},partnership_b.eq.${p.viewer})`
      )
      .limit(1)
      .maybeSingle()
    if (!cm) {
      samples.push({ label: p.label, error: 'no computed_matches row for pair' })
      continue
    }
    const sections = parseSections(cm.breakdown)
    const assembled = await assembleInterpretationForPair(admin, p.viewer, p.match, sections, cm.score ?? 0)
    if (!assembled) {
      samples.push({ label: p.label, error: 'could not assemble input (partnership/survey missing)' })
      continue
    }
    systemPrompt = assembled.systemPrompt
    const gen = await generateMatchInterpretation(assembled.input)
    if (gen.usage) totalCost += gen.usage.cost_usd

    samples.push({
      label: p.label,
      match_score: cm.score,
      section_scores: sections.map((s) => ({ category: s.displayName, score: s.score, band: s.band.label, coverage: s.coverage })),
      membership: assembled.membership,
      nudged: assembled.nudged,
      user_message: includePrompt ? assembled.userMessage : undefined,
      result: gen.result,
      degraded: !gen.result,
      error: gen.error,
      usage: gen.usage,
    })
  }

  return NextResponse.json({
    model: 'gpt-4o-mini',
    system_prompt: includePrompt ? systemPrompt : undefined,
    total_cost_usd: Number(totalCost.toFixed(6)),
    samples,
  })
}
