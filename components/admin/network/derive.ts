/**
 * Pure metric-extraction for the dashboard cards: given the API payload, produce
 * each card's current value, prior-week value (for WoW), and sparkline series.
 * Extracted from the client so the WoW / graceful-degradation rules are unit-
 * testable without React or a DB.
 *
 * Degradation rules (launch state — network_snapshots may have 0–1 rows):
 *  - No prior-week snapshot row → prior = null → card shows "collecting history".
 *  - Snapshot section is cumulative-current and week-independent; its WoW compares
 *    live-now vs one week ago (currentPriorWeekEnding).
 *  - Weekly section is per selected week: current week → live; a past week → that
 *    week's snapshot row, or null (→ "no activity for this week") if none stored.
 */

import type { SnapshotMetrics, WeeklyMetrics } from '@/lib/metrics/types'
import type { NetworkMetricsPayload } from './types'

export type NumericSnapshotKey = {
  [K in keyof SnapshotMetrics]: SnapshotMetrics[K] extends number ? K : never
}[keyof SnapshotMetrics]

export interface DerivedMetric {
  value: number | null
  prior: number | null
  series: number[]
}

export function snapshotMetric(
  data: NetworkMetricsPayload,
  key: NumericSnapshotKey
): DerivedMetric {
  const value = data.metrics.snapshot[key]
  const priorRow = data.history.find((h) => h.snapshot_date === data.currentPriorWeekEnding)
  const prior = priorRow ? (priorRow.metrics.snapshot[key] as number) : null
  const series = data.history.map((h) => h.metrics.snapshot[key] as number)
  const newest = data.history[data.history.length - 1]
  if (!newest || newest.snapshot_date !== data.currentWeekEnding) series.push(value)
  return { value, prior, series }
}

export function weeklyMetric(
  data: NetworkMetricsPayload,
  key: keyof WeeklyMetrics
): DerivedMetric {
  const sel = data.selectedWeek
  let value: number | null
  if (sel.isCurrent) {
    value = data.metrics.weekly[key]
  } else {
    const row = data.history.find((h) => h.snapshot_date === sel.weekEnding)
    value = row ? (row.metrics.weekly[key] as number) : null
  }
  const priorRow = data.history.find((h) => h.snapshot_date === sel.priorWeekEnding)
  const prior = priorRow ? (priorRow.metrics.weekly[key] as number) : null
  const series = data.history.map((h) => h.metrics.weekly[key] as number)
  if (sel.isCurrent) series.push(data.metrics.weekly[key])
  return { value, prior, series }
}
