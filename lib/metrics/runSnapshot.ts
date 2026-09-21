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
import { SNAPSHOT_DEFINITIONS_VERSION } from './definitionsVersion'
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
      // COMPOSITION IS DEGRADABLE; THE SNAPSHOT IS NOT.
      //
      // These used to be awaited together, so a composition failure lost the
      // ENTIRE scope's row. That is exactly what happened: one member's survey
      // carried the birthdate "1989-04-31" — April has 30 days — and
      // get_composition_breakdown throws casting it. The member is in Gladstone,
      // so the Austin-scoped call never touched them and kept succeeding, while
      // the NETWORK scope threw every Saturday from 2026-08-29 onward. Four
      // weeks of network-wide history were lost to one impossible date, and
      // nothing surfaced it because the per-scope catch swallowed it into an
      // outcome nobody read.
      //
      // Composition is one section of the readout. Member counts, weekly deltas
      // and engagement are the time series itself, and losing those to a
      // breakdown failure is the wrong trade. Composition now fails on its own.
      const metrics = await getMetrics({ scope, week })
      let composition: Awaited<ReturnType<typeof getComposition>> | null = null
      let compositionError: string | null = null
      try {
        composition = await getComposition({ scope })
      } catch (e: any) {
        compositionError = e?.message ?? String(e)
        console.error(`[Snapshot] composition FAILED for ${marketName ?? 'network'} — writing the row without it:`, compositionError)
      }

      const payload: SnapshotPayload = {
        scopeLabel: metrics.scopeLabel,
        weekEnding: week.weekEnding,
        partnershipsInScope: metrics.partnershipsInScope,
        snapshot: metrics.snapshot,
        weekly: metrics.weekly,
        composition,
        // Recorded in the row itself, so a degraded snapshot is visible in the
        // data rather than only in a log line nobody reads.
        ...(compositionError ? { compositionError } : {}),
        engagement: metrics.engagement,
        definitionsVersion: SNAPSHOT_DEFINITIONS_VERSION,
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
      outcomes.push({
        scopeLabel: metrics.scopeLabel,
        marketName,
        ok: true,
        ...(compositionError ? { degraded: 'composition', error: compositionError } : {}),
      })
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
