/**
 * Read-only snapshot-history helper for the dashboard's WoW deltas + sparklines.
 * Additive — no behavior change to the metrics engine.
 *
 * The network row is stored with market_name IS NULL; a market row with
 * market_name = the exact market_name. History is returned oldest→newest so the
 * UI can draw a left-to-right sparkline and pick the prior-week row by date.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { Scope, SnapshotPayload } from './types'

export interface SnapshotHistoryRow {
  snapshot_date: string // 'YYYY-MM-DD'
  market_name: string | null
  metrics: SnapshotPayload
}

export async function getSnapshotHistory(
  scope: Scope,
  limit = 12
): Promise<SnapshotHistoryRow[]> {
  const admin = createAdminClient()

  let q = admin
    .from('network_snapshots')
    .select('snapshot_date, market_name, metrics')
    .order('snapshot_date', { ascending: false })
    .limit(limit)

  if (scope === 'network') q = q.is('market_name', null)
  else q = q.eq('market_name', scope.market)

  const { data, error } = await q
  if (error) {
    // Most likely: migration 045 not applied yet. Degrade to "no history" rather
    // than failing the whole dashboard load.
    console.error('[getSnapshotHistory] read failed:', error.message)
    return []
  }

  // Reverse to ascending (oldest first) for the sparkline / prior-week lookup.
  return ((data ?? []) as SnapshotHistoryRow[]).slice().reverse()
}
