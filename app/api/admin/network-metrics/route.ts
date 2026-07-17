import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMetrics, getComposition } from '@/lib/metrics/getMetrics'
import { getSnapshotHistory } from '@/lib/metrics/getSnapshotHistory'
import { resolvePartnershipScope, userIdsForPartnerships } from '@/lib/metrics/scope'
import {
  currentReportingWeek,
  formatReportingWeek,
  priorWeek,
  weekFromEnding,
} from '@/lib/metrics/reportingWeek'
import type { Scope } from '@/lib/metrics/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * One-round-trip payload for the Network Performance dashboard.
 * GET ?scope=network|<market_name>&week=<YYYY-MM-DD weekEnding>
 *
 * Gated by the admin allowlist (requireAdminRoute). Service-role queries happen
 * inside getMetrics/getComposition/getSnapshotHistory. No CRON_SECRET here.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response

  const params = request.nextUrl.searchParams
  const scopeParam = params.get('scope') ?? 'network'
  const scope: Scope = scopeParam === 'network' ? 'network' : { market: scopeParam }

  const weekParam = params.get('week')
  const week = weekParam ? weekFromEnding(weekParam) : currentReportingWeek()
  const current = currentReportingWeek()
  const isCurrent = week.weekEnding === current.weekEnding
  const prior = priorWeek(week)

  try {
    const [metrics, composition, history, surveyedInScope] = await Promise.all([
      getMetrics({ scope, week }),
      // Composition degrades independently: if the RPC is missing (migration 045
      // not applied) the charts render "No data" rather than 500ing the page.
      getComposition({ scope }).catch((e) => {
        console.error('[network-metrics] composition unavailable:', e?.message ?? e)
        return { gender: [], orientation: [], relationshipIntent: [], age: [] }
      }),
      getSnapshotHistory(scope, 12),
      countSurveyedInScope(scope),
    ])

    return NextResponse.json({
      scopeLabel: metrics.scopeLabel,
      generatedAt: metrics.generatedAt,
      // Snapshot WoW compares live-now vs one week ago, independent of the week
      // selector (the Snapshot section is always cumulative-current).
      currentWeekEnding: current.weekEnding,
      currentPriorWeekEnding: priorWeek(current).weekEnding,
      selectedWeek: {
        weekEnding: week.weekEnding,
        start: week.start.toISOString(),
        end: week.end.toISOString(),
        label: formatReportingWeek(week),
        priorWeekEnding: prior.weekEnding,
        priorLabel: formatReportingWeek(prior),
        isCurrent,
      },
      metrics,
      composition,
      surveyedInScope,
      history,
    })
  } catch (err: any) {
    console.error('[network-metrics] failed:', err?.message ?? err)
    return NextResponse.json(
      { error: err?.message ?? 'Failed to load network metrics' },
      { status: 500 }
    )
  }
}

/** Survey responses in scope — denominator for the intent (multi-select) caption. */
async function countSurveyedInScope(scope: Scope): Promise<number> {
  const admin = createAdminClient()
  if (scope === 'network') {
    const { count } = await admin
      .from('user_survey_responses')
      .select('*', { count: 'exact', head: true })
    return count ?? 0
  }
  const resolution = await resolvePartnershipScope(scope)
  const userIds = await userIdsForPartnerships(resolution.partnershipIds)
  if (!userIds || userIds.size === 0) return 0
  const { data } = await admin.from('user_survey_responses').select('user_id').limit(100000)
  let n = 0
  for (const r of (data ?? []) as { user_id: string }[]) if (userIds.has(r.user_id)) n++
  return n
}
