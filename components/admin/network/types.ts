import type { Composition, MetricsResult, SnapshotPayload } from '@/lib/metrics/types'

/** The /api/admin/network-metrics response shape (client contract). */
export interface NetworkMetricsPayload {
  scopeLabel: string
  /** When this payload was computed (ISO) — drives the freshness footer. */
  generatedAt: string
  currentWeekEnding: string
  currentPriorWeekEnding: string
  selectedWeek: {
    weekEnding: string
    start: string
    end: string
    label: string
    priorWeekEnding: string
    priorLabel: string
    isCurrent: boolean
  }
  metrics: MetricsResult
  composition: Composition
  surveyedInScope: number
  history: Array<{
    snapshot_date: string
    market_name: string | null
    metrics: SnapshotPayload
  }>
}

/** Market option from /api/admin/markets (only is_live ones are offered). */
export interface MarketOption {
  market_name: string
  is_live: boolean
  liveMemberCount: number
}
