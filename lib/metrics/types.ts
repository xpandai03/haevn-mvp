/**
 * Metrics type contract for the Network Performance dashboard.
 *
 * THIS IS THE CONTRACT the UI phase builds against. Changing a field here is a
 * breaking change for the dashboard — treat additively where possible.
 */

/** Query scope: the whole network, or one market by exact `market_name`. */
export type Scope = 'network' | { market: string }

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
  /**
   * Founding-promo partnerships whose membership has not expired
   * (plus_source = 'founding_member_promo', membership_expires_at null or in the
   * future). Same population as the Founding Members page, minus the expired.
   * Replaced plusMembers/plusConversion (2026-09-28): those read a Lemonsqueezy
   * tier nothing writes, and sat on the dashboard as "Unavailable".
   */
  activeFoundingMembers: number
  /** Of those, how many expire within the next 30 days (the page's amber window). */
  foundingExpiringSoon: number
  /**
   * Member-initiated account deletions, all time (account_deletions — one row
   * per deletion, city + hashed id only). Market scope matches on that city.
   */
  departures: number
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

/**
 * Engagement — are members entering the app? Partnership-level (a partnership is
 * "logged in" if ANY member has), with the person count for the tooltip.
 */
export interface EngagementMetrics {
  /** Partnerships with ≥1 member who has ever signed in. */
  loggedInEverPartnerships: number
  /** People (users) who have ever signed in — person framing for the tooltip. */
  loggedInEverPeople: number
  /** Partnerships in scope (denominator). */
  totalPartnerships: number
  /**
   * Partnerships with ≥1 member who signed in during the reporting week.
   * null = a PAST week: not computable live (last_sign_in_at holds only the
   * latest sign-in) — comes from snapshots instead.
   */
  activeThisWeekPartnerships: number | null
}

/** Latest re-notify run summary (network-wide) — the PR #8 admin GET shape. */
export interface RenotifyStatus {
  runDate: string
  dryRun: boolean | null
  total: number
  sent: { sms: number; email: number }
  suppressed: { login_detected: number; cap_reached: number }
  failures: number
  byVariant: { has_phone: number; no_phone: number }
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
  engagement: EngagementMetrics
  /** ISO timestamp the metrics were computed. */
  generatedAt: string
}

/**
 * Shape persisted to network_snapshots.metrics (jsonb). `engagement` and
 * `definitionsVersion` are additive (PR #9): rows written before this PR lack
 * them — readers must treat absent `engagement` as "no data" and absent
 * `definitionsVersion` as 1.
 */
export interface SnapshotPayload {
  scopeLabel: string
  weekEnding: string
  partnershipsInScope: number
  snapshot: SnapshotMetrics
  weekly: WeeklyMetrics
  /** Null when the composition RPC failed for this scope — the rest of the
   *  snapshot is still valid and still written. See runSnapshot. */
  composition: Composition | null
  /** Present only when composition was skipped, naming the reason. */
  compositionError?: string
  engagement?: EngagementMetrics
  definitionsVersion?: number
  generatedAt: string
}
