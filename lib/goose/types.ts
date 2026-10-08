/**
 * Goose cohort types. Pure module: no server/client deps.
 *
 * member_id everywhere = partnerships.id (the id survey ingest returns to the
 * event partner). A couple is ONE partnership, so two guests can resolve to the
 * same member_id; association and finalize dedupe on it.
 */

import type { GooseBand } from './gooseBandCopy'

/** Stored status. 'open' and 'processing' both read as "processing" to Goose. */
export type CohortStatus = 'open' | 'processing' | 'ready' | 'error'

/** The three states the contract exposes. */
export type GooseState = 'processing' | 'ready' | 'error'

/** Closed set of failure codes recorded on the cohort and in alerts. */
export type GooseErrorCode =
  | 'compute_exception'       // read / score / write threw
  | 'members_missing_survey'  // a finalized member has no completed HAEVN survey
  | 'member_not_found'        // a finalized id no longer resolves to a partnership
  | 'incomplete_coverage'     // run finished but completed < expected
  | 'stalled'                 // lease expired mid-compute (function killed)

export interface CohortRow {
  id: string
  goose_event_id: string
  event_name: string | null
  event_starts_at: string
  status: CohortStatus
  finalization_id: string | null
  finalized_at: string | null
  population_hash: string | null
  expected_pairs: number | null
  completed_pairs: number | null
  ready_at: string | null
  last_compute_ms: number | null
  last_compute_pairs: number | null
  compute_attempts: number
  compute_lease_until: string | null
  next_retry_at: string | null
  last_error_code: GooseErrorCode | null
  last_error_at: string | null
  alerted_at: string | null
  exhausted_alerted_at: string | null
}

export interface PairResultRow {
  cohort_id: string
  member_a: string
  member_b: string
  finalization_id: string
  score: number
  band: GooseBand
  gated: boolean
  engine_version: string
}

export interface Coverage {
  finalized_members: number
  expected_pairs: number
  completed_pairs: number
}

/** What the engine needs for one member, built exactly as the weekly path does. */
export interface ScorableMember {
  memberId: string
  raw: Record<string, unknown>
  isCouple: boolean
}

export class GooseComputeError extends Error {
  constructor(public code: GooseErrorCode, message: string, public detail: Record<string, number | string> = {}) {
    super(message)
    this.name = 'GooseComputeError'
  }
}
