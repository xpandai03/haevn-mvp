/**
 * One cohort compute attempt: score every unique pair of the CURRENT finalized
 * population and write it to goose_pair_results, then judge readiness by
 * coverage — never by a row count.
 *
 * Single-flight per finalization (lease). Every terminal write is guarded on
 * the finalization id, so an attempt overtaken by a re-finalize can neither
 * mark the new population ready nor overwrite its state.
 */

import { isComplete } from './pairs'
import type { GooseRepo } from './repo'
import { scoreCohortPairs } from './score'
import { GooseComputeError, type Coverage, type GooseErrorCode } from './types'

/** Lease covers one attempt with wide margin (an attempt takes seconds). */
export const COMPUTE_LEASE_MS = 5 * 60_000

export type ComputeOutcome =
  | { kind: 'ready'; finalizationId: string; coverage: Coverage; ms: number; pairs: number; gated: number }
  | {
      kind: 'failed'
      finalizationId: string
      code: GooseErrorCode
      message: string
      coverage: Coverage | null
      ms: number
      pairs: number
      detail: Record<string, number | string>
    }
  | { kind: 'skipped'; reason: 'not_found' | 'not_finalized' | 'lease_held' | 'superseded' }

export interface ComputeOpts {
  now?: () => Date
}

export async function computeGooseCohortOnce(repo: GooseRepo, cohortId: string, opts: ComputeOpts = {}): Promise<ComputeOutcome> {
  const now = opts.now ?? (() => new Date())
  const cohort = await repo.getCohort(cohortId)
  if (!cohort) return { kind: 'skipped', reason: 'not_found' }
  const fid = cohort.finalization_id
  if (!fid) return { kind: 'skipped', reason: 'not_finalized' }

  const startedAt = now()
  const leaseUntil = new Date(startedAt.getTime() + COMPUTE_LEASE_MS).toISOString()
  if (!(await repo.claimLease(cohortId, fid, startedAt.toISOString(), leaseUntil))) {
    return { kind: 'skipped', reason: 'lease_held' }
  }
  await repo.updateCohort(cohortId, { compute_attempts: (cohort.compute_attempts ?? 0) + 1 }, fid)

  const t0 = Date.now()
  let pairs = 0
  let coverage: Coverage | null = null
  try {
    const memberIds = await repo.finalizedMemberIds(cohortId)
    const loaded = await repo.loadScorableMembers(memberIds)
    await repo.deleteStaleResults(cohortId, fid)
    const scored = scoreCohortPairs(cohortId, fid, memberIds, loaded.inputs)
    await repo.upsertResults(scored.rows)
    pairs = scored.rows.length
    coverage = await repo.coverage(cohortId)
    const ms = Date.now() - t0

    if (isComplete(coverage)) {
      const applied = await repo.updateCohort(
        cohortId,
        {
          status: 'ready',
          expected_pairs: coverage.expected_pairs,
          completed_pairs: coverage.completed_pairs,
          ready_at: now().toISOString(),
          last_compute_ms: ms,
          last_compute_pairs: pairs,
          compute_lease_until: null,
          next_retry_at: null,
          last_error_code: null,
          last_error_at: null,
        },
        fid
      )
      if (!applied) return { kind: 'skipped', reason: 'superseded' }
      await repo.logEvent('goose_compute', {
        cohort_id: cohortId, finalization_id: fid, pairs, gated: scored.gated, ms, completed: true,
      })
      return { kind: 'ready', finalizationId: fid, coverage, ms, pairs, gated: scored.gated }
    }

    if (loaded.missingPartnerships.length > 0) {
      throw new GooseComputeError('member_not_found', 'finalized member no longer exists', {
        missing_members: loaded.missingPartnerships.length,
      })
    }
    if (loaded.missingSurvey.length > 0) {
      throw new GooseComputeError('members_missing_survey', 'finalized member has no completed survey', {
        missing_surveys: loaded.missingSurvey.length,
      })
    }
    throw new GooseComputeError('incomplete_coverage', 'coverage short after a full write')
  } catch (e) {
    const err =
      e instanceof GooseComputeError
        ? e
        : new GooseComputeError('compute_exception', e instanceof Error ? e.message : String(e))
    const ms = Date.now() - t0
    const applied = await repo
      .updateCohort(
        cohortId,
        {
          status: 'error',
          last_error_code: err.code,
          last_error_at: now().toISOString(),
          completed_pairs: coverage?.completed_pairs ?? null,
          expected_pairs: coverage?.expected_pairs ?? cohort.expected_pairs,
          last_compute_ms: ms,
          last_compute_pairs: pairs,
          compute_lease_until: null,
        },
        fid
      )
      .catch(() => false)
    if (!applied && !(await stillCurrent(repo, cohortId, fid))) return { kind: 'skipped', reason: 'superseded' }
    await repo.logEvent('goose_compute_failed', {
      cohort_id: cohortId, finalization_id: fid, code: err.code, ms, pairs, ...err.detail,
    })
    return { kind: 'failed', finalizationId: fid, code: err.code, message: err.message, coverage, ms, pairs, detail: err.detail }
  }
}

async function stillCurrent(repo: GooseRepo, cohortId: string, fid: string): Promise<boolean> {
  try {
    return (await repo.getCohort(cohortId))?.finalization_id === fid
  } catch {
    return true // can't tell — treat as a real failure so it is alerted, never swallowed
  }
}
