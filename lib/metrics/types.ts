/**
 * Metrics type contract for the Network Performance dashboard.
 *
 * THIS IS THE CONTRACT the UI phase builds against. Changing a field here is a
 * breaking change for the dashboard — treat additively where possible.
 */

/** Query scope: the whole network, or one market by exact `market_name`. */
export type Scope = 'network' | { market: string }

/** A metric that cannot be sourced yet, with a human reason (never a fake 0). */
export interface BlockedMetric {
  blocked: true
  reason: string
}

/** Snapshot (point-in-time) metrics. Counts are partnership-level unless noted. */
export interface SnapshotMetrics {
  /** Partnerships in scope. */
  totalMembers: number
  /**
   * People whose survey is not complete. Person-level (profiles.survey_complete);
   * see OPEN QUESTION in getMetrics — boolean col vs completion_pct can disagree.
   */
  incompleteSurveys: number
  /** People whose survey is complete (profiles.survey_complete = true). */
  completedSurveys: number
  /** Partnerships on the free tier (membership_tier = 'free'). */
  membersFree: number
  /**
   * Partnerships with NO row in computed_matches right now. This is
   * "no current match", NOT lifetime "never matched" — computed_matches is
   * rewritten weekly, so lifetime-never is unknowable without history retention.
   */
  noCurrentMatch: number
  /** Deferred — tier data is known-broken (Lemonsqueezy webhook), separate fix. */
  plusMembers: BlockedMetric
  /** Deferred — depends on plusMembers. */
  plusConversion: BlockedMetric
  /** Deferred — no meetup-share event is captured anywhere today. */
  meetupShares: BlockedMetric
}

/** Weekly-activity metrics, bucketed by the reporting week (Sun–Sat, UTC). */
export interface WeeklyMetrics {
  /** computed_matches with score >= 80 (MATCH_MIN_SCORE), computed_at in week. */
  matchesGenerated: number
  /** computed_matches with score 77–79 (REC band), computed_at in week. */
  recommendationsGenerated: number
  /** nudges.created_at in week. */
  nudgesSent: number
  /** ready_to_meet_signals.created_at in week. */
  readyToMeetSignals: number
  /** handshakes.created_at in week (mutual matches). */
  newConnections: number
  /** conversations.created_at in week. */
  conversationsStarted: number
}

/** One (dimension, bucket) count from the composition RPC. */
export interface CompositionBucket {
  dimension: string
  bucket: string
  count: number
}

/**
 * Composition distributions. `relationshipIntent` is multi-select, so its counts
 * intentionally do NOT sum to the member total.
 */
export interface Composition {
  gender: CompositionBucket[]
  orientation: CompositionBucket[]
  relationshipIntent: CompositionBucket[]
  age: CompositionBucket[]
}

/** The full result of getMetrics for one scope + week. */
export interface MetricsResult {
  scope: Scope
  /** 'network' or the market_name. */
  scopeLabel: string
  week: {
    weekEnding: string
    start: string
    end: string
  }
  /** Partnerships resolved into scope (network = all partnerships). */
  partnershipsInScope: number
  snapshot: SnapshotMetrics
  weekly: WeeklyMetrics
  /** ISO timestamp the metrics were computed. */
  generatedAt: string
}

/** Shape persisted to network_snapshots.metrics (jsonb). */
export interface SnapshotPayload {
  scopeLabel: string
  weekEnding: string
  partnershipsInScope: number
  snapshot: SnapshotMetrics
  weekly: WeeklyMetrics
  composition: Composition
  generatedAt: string
}
