/**
 * runNetworkSnapshot — the shared snapshot writer, called by BOTH the weekly
 * cron (app/api/cron/snapshot-network) and the admin manual-trigger route
 * (app/api/admin/snapshot-network). Computes metrics + composition for the
 * network and each LIVE market, then upserts one network_snapshots row per scope.
 *
 * Upsert (not insert) so re-running within the same week updates rather than
 * duplicates — the (snapshot_date, market_name) index is NULLS NOT DISTINCT so
 * the network row (market_name IS NULL) is covered too.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { loadMarketIndex } from '@/lib/markets/releaseGate'
import { currentReportingWeek, type ReportingWeek } from './reportingWeek'
import { getComposition, getMetrics } from './getMetrics'
import type { Scope, SnapshotPayload } from './types'

export interface SnapshotScopeOutcome {
  scopeLabel: string
  marketName: string | null
  ok: boolean
  error?: string
}

export interface SnapshotRunResult {
  weekEnding: string
  written: number
  scopes: SnapshotScopeOutcome[]
}

export async function runNetworkSnapshot(opts?: {
  week?: ReportingWeek
}): Promise<SnapshotRunResult> {
  const week = opts?.week ?? currentReportingWeek()
  const admin = createAdminClient()

  // Target scopes: network-wide + every LIVE market. If the market index can't be
  // built we still write the network row (the index failure is logged loudly by
  // loadMarketIndex); per-market rows are simply skipped that run.
  const idx = await loadMarketIndex(true)
  const liveMarkets = [...idx.liveMarkets]
  const scopes: { scope: Scope; marketName: string | null }[] = [
    { scope: 'network', marketName: null },
    ...liveMarkets.map((m) => ({ scope: { market: m } as Scope, marketName: m })),
  ]

  const outcomes: SnapshotScopeOutcome[] = []
  let written = 0

  for (const { scope, marketName } of scopes) {
    try {
      const [metrics, composition] = await Promise.all([
        getMetrics({ scope, week }),
        getComposition({ scope }),
      ])

      const payload: SnapshotPayload = {
        scopeLabel: metrics.scopeLabel,
        weekEnding: week.weekEnding,
        partnershipsInScope: metrics.partnershipsInScope,
        snapshot: metrics.snapshot,
        weekly: metrics.weekly,
        composition,
        generatedAt: metrics.generatedAt,
      }

      const { error } = await admin.from('network_snapshots').upsert(
        {
          snapshot_date: week.weekEnding,
          market_name: marketName,
          metrics: payload,
        },
        { onConflict: 'snapshot_date,market_name' }
      )
      if (error) throw new Error(error.message)

      written++
      outcomes.push({ scopeLabel: metrics.scopeLabel, marketName, ok: true })
    } catch (err: any) {
      outcomes.push({
        scopeLabel: marketName ?? 'network',
        marketName,
        ok: false,
        error: err?.message ?? String(err),
      })
    }
  }

  return { weekEnding: week.weekEnding, written, scopes: outcomes }
}
