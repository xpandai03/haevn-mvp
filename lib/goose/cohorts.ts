/**
 * Goose cohort operations — the internal functions behind the five contract
 * endpoints (contract v1.0). PR 2 wraps each in an authenticated route; this
 * PR exercises them through the QA harness and the tests. No HTTP here.
 *
 *   1. createCohort       POST /cohorts
 *   2. associateMember    POST /cohorts/{id}/members
 *   3. finalizeCohort     POST /cohorts/{id}/finalize   (caller then runs runGooseCompute)
 *   4. getCohortStatus    GET  /cohorts/{id}/status
 *   5. getCohortResults   GET  /cohorts/{id}/results
 *
 * member_id = partnerships.id. A couple is one member_id, so two guests may
 * associate the same id: association is idempotent on (cohort, member) and
 * finalize dedupes, so a repeated id never inflates the population.
 */

import { populationHash } from './pairs'
import { GooseFinalizeError, type GooseRepo } from './repo'
import { findForbiddenGooseKeys, serializeGoosePair, type GoosePairResult } from './serialize'
import type { CohortRow, GooseState } from './types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── 1. Create ────────────────────────────────────────────────────────────────

export interface CreateCohortInput {
  goose_event_id: string
  event_name?: string | null
  event_starts_at: string
}

export type CreateCohortResult =
  | { ok: true; haevn_cohort_id: string; created: boolean }
  | { ok: false; error: 'invalid_input'; detail: string }

/** Idempotent on goose_event_id: a repeat returns the same cohort, never a duplicate. */
export async function createCohort(repo: GooseRepo, input: CreateCohortInput): Promise<CreateCohortResult> {
  const eventId = typeof input.goose_event_id === 'string' ? input.goose_event_id.trim() : ''
  if (!eventId) return { ok: false, error: 'invalid_input', detail: 'goose_event_id required' }
  const startsMs = Date.parse(input.event_starts_at)
  if (!Number.isFinite(startsMs)) return { ok: false, error: 'invalid_input', detail: 'event_starts_at must be ISO 8601' }

  const existing = await repo.findCohortByEventId(eventId)
  if (existing) return { ok: true, haevn_cohort_id: existing.id, created: false }
  const inserted = await repo.insertCohort({
    goose_event_id: eventId,
    event_name: input.event_name?.trim() || null,
    event_starts_at: new Date(startsMs).toISOString(),
  })
  if (inserted) {
    await repo.logEvent('goose_cohort_created', { cohort_id: inserted.id })
    return { ok: true, haevn_cohort_id: inserted.id, created: true }
  }
  // Lost a race with a concurrent create of the same event: return the winner.
  const winner = await repo.findCohortByEventId(eventId)
  if (!winner) throw new Error('goose cohort insert conflicted but no row found')
  return { ok: true, haevn_cohort_id: winner.id, created: false }
}

// ── 2. Associate ─────────────────────────────────────────────────────────────

export type AssociateInput = { member_id: string } | { member_email: string }

export type AssociateResult =
  | { ok: true; member_id: string; associated: true; survey_complete: boolean }
  | { ok: false; error: 'member_not_found' | 'cohort_not_found' | 'invalid_input' }

/**
 * Idempotent: re-association returns the same success. survey_complete is
 * informational only — association never implies eligibility.
 */
export async function associateMember(repo: GooseRepo, cohortId: string, input: AssociateInput): Promise<AssociateResult> {
  if (!UUID_RE.test(cohortId) || !(await repo.getCohort(cohortId))) return { ok: false, error: 'cohort_not_found' }

  let memberId: string | null = null
  if ('member_id' in input && typeof input.member_id === 'string') {
    const id = input.member_id.trim()
    memberId = UUID_RE.test(id) && (await repo.partnershipExists(id)) ? id : null
  } else if ('member_email' in input && typeof input.member_email === 'string') {
    memberId = await repo.findMemberIdByEmail(input.member_email)
  } else {
    return { ok: false, error: 'invalid_input' }
  }
  if (!memberId) return { ok: false, error: 'member_not_found' }

  await repo.associate(cohortId, memberId)
  const survey_complete = await repo.hasCompletedSurvey(memberId)
  return { ok: true, member_id: memberId, associated: true, survey_complete }
}

// ── 3. Finalize ──────────────────────────────────────────────────────────────

export type FinalizeResult =
  | { ok: true; status: 'processing'; expected_pairs: number; finalization_id: string }
  | { ok: false; error: 'cohort_not_found' | 'unknown_members' | 'invalid_input'; detail?: string }

/**
 * Replace the frozen population (atomically) and reset to processing. The
 * caller starts the compute: `after(() => runGooseCompute(repo, id))` in the
 * route; directly in the harness and tests.
 */
export async function finalizeCohort(repo: GooseRepo, cohortId: string, memberIds: unknown): Promise<FinalizeResult> {
  if (!UUID_RE.test(cohortId)) return { ok: false, error: 'cohort_not_found' }
  if (!Array.isArray(memberIds) || !memberIds.every((m) => typeof m === 'string')) {
    return { ok: false, error: 'invalid_input', detail: 'member_ids must be an array of strings' }
  }
  const ids = [...new Set((memberIds as string[]).map((m) => m.trim()))]
  const malformed = ids.filter((m) => !UUID_RE.test(m)).length
  if (malformed > 0) return { ok: false, error: 'unknown_members', detail: `${malformed} malformed id(s)` }

  try {
    const r = await repo.finalize(cohortId, ids, populationHash(ids))
    await repo.logEvent('goose_finalized', {
      cohort_id: cohortId, finalization_id: r.finalization_id, members: ids.length, expected_pairs: r.expected_pairs,
    })
    return { ok: true, status: 'processing', expected_pairs: r.expected_pairs, finalization_id: r.finalization_id }
  } catch (e) {
    if (e instanceof GooseFinalizeError) return { ok: false, error: e.code, detail: e.message }
    throw e
  }
}

// ── 4. Status ────────────────────────────────────────────────────────────────

export interface CohortStatus {
  status: GooseState
  expected_pairs: number
  completed_pairs: number
  finalized_at: string | null
  ready_at: string | null
}

/**
 * Status read. "ready" needs BOTH the stored ready AND live coverage exactly
 * complete right now — a later change (e.g. a member deleting their account)
 * can never leave a stale ready on display.
 */
export async function getCohortStatus(repo: GooseRepo, cohortId: string): Promise<CohortStatus | null> {
  if (!UUID_RE.test(cohortId)) return null
  const cohort = await repo.getCohort(cohortId)
  if (!cohort) return null
  return deriveStatus(cohort, cohort.finalization_id ? await repo.coverage(cohortId) : null)
}

export function deriveStatus(
  cohort: Pick<CohortRow, 'status' | 'finalization_id' | 'finalized_at' | 'ready_at'>,
  coverage: { expected_pairs: number; completed_pairs: number } | null
): CohortStatus {
  const expected = coverage?.expected_pairs ?? 0
  const completed = coverage?.completed_pairs ?? 0
  const complete = !!cohort.finalization_id && !!coverage && completed === expected
  const status: GooseState =
    cohort.status === 'error' ? 'error' : cohort.status === 'ready' && complete ? 'ready' : 'processing'
  return {
    status,
    expected_pairs: expected,
    completed_pairs: completed,
    finalized_at: cohort.finalized_at,
    ready_at: status === 'ready' ? cohort.ready_at : null,
  }
}

// ── 5. Results ───────────────────────────────────────────────────────────────

export interface CohortResults {
  status: GooseState
  pairs: GoosePairResult[]
}

/**
 * All current pairs, serialized through the allowlist. Before ready this is
 * the partial set with the status echoed (contract). Throws if the serialized
 * payload carries any key off the allowlist — it never ships.
 */
export async function getCohortResults(repo: GooseRepo, cohortId: string): Promise<CohortResults | null> {
  const st = await getCohortStatus(repo, cohortId)
  if (!st) return null
  const rows = await repo.listResults(cohortId)
  const ids = [...new Set(rows.flatMap((r) => [r.member_a, r.member_b]))]
  const photos = ids.length > 0 ? await repo.primaryPhotos(ids) : new Map<string, string>()
  const payload: CohortResults = { status: st.status, pairs: rows.map((r) => serializeGoosePair(r, photos)) }
  const bad = findForbiddenGooseKeys(payload)
  if (bad.length > 0) throw new Error(`goose serializer violation: ${bad.slice(0, 5).join(', ')}`)
  return payload
}
