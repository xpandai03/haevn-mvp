/**
 * Compute orchestration: retries and alerts.
 *
 * THE RULE (contract v1.0, "Failure and alerts"): on the first failure the
 * alert email and retry 1 start TOGETHER. The alert never waits for a retry,
 * and a retry never waits for the alert — Promise.allSettled over both.
 *
 *   attempt 1 ──fail──┬─ alert email (once per failure episode)
 *                     └─ retry 1 (immediately)
 *                         └─fail→ +20s retry 2 ─fail→ +60s retry 3 ─fail→ backstop cron
 *
 * After the in-run retries, the backstop cron (every 5 min, behind
 * GOOSE_BACKSTOP_ENABLED) keeps retrying until the event starts, then sends a
 * single "not ready at event start" alert. A success after an alert sends one
 * "recovered" email. One failure email per episode — never one per retry.
 */

import { sendGooseAlert, type AlertTransport } from './alerts'
import { computeGooseCohortOnce, type ComputeOutcome } from './compute'
import type { GooseRepo } from './repo'
import type { CohortRow, GooseErrorCode } from './types'

export const IN_RUN_RETRY_DELAYS_MS = [20_000, 60_000] as const
export const BACKSTOP_RETRY_AFTER_MS = 2 * 60_000

export interface RunDeps {
  transport?: AlertTransport
  /** Raw recipient list; defaults to process.env.GOOSE_ALERT_EMAILS. */
  recipients?: string
  sleep?: (ms: number) => Promise<void>
  now?: () => Date
  /** Delays for retries 2..n (retry 1 is always immediate, alongside the alert). */
  delays?: readonly number[]
}

export type AlertOutcome = 'none' | 'sent' | 'already_alerted' | 'undelivered'

export interface RunResult {
  outcome: ComputeOutcome
  attempts: number
  alert: AlertOutcome
  recovered: boolean
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Compute a cohort with the full retry + alert policy. Never throws. */
export async function runGooseCompute(repo: GooseRepo, cohortId: string, deps: RunDeps = {}): Promise<RunResult> {
  const now = deps.now ?? (() => new Date())
  const first = await safeCompute(repo, cohortId, now)
  return continueAfter(repo, cohortId, first, 1, deps)
}

/**
 * Entry for a failure detected OUTSIDE a compute attempt (a stalled lease found
 * by the backstop): record it, then alert + retry together exactly as above.
 */
export async function failAndRetry(
  repo: GooseRepo,
  cohort: CohortRow,
  code: GooseErrorCode,
  deps: RunDeps = {}
): Promise<RunResult> {
  const now = deps.now ?? (() => new Date())
  const fid = cohort.finalization_id!
  await repo.updateCohort(
    cohort.id,
    { status: 'error', last_error_code: code, last_error_at: now().toISOString(), compute_lease_until: null },
    fid
  )
  await repo.logEvent('goose_compute_failed', { cohort_id: cohort.id, finalization_id: fid, code })
  const failed: ComputeOutcome = {
    kind: 'failed', finalizationId: fid, code, message: code, coverage: null, ms: 0, pairs: 0, detail: {},
  }
  return continueAfter(repo, cohort.id, failed, 0, deps)
}

async function continueAfter(
  repo: GooseRepo,
  cohortId: string,
  outcome: ComputeOutcome,
  attempts: number,
  deps: RunDeps
): Promise<RunResult> {
  const now = deps.now ?? (() => new Date())
  const sleep = deps.sleep ?? defaultSleep
  if (outcome.kind !== 'failed') {
    const recovered = outcome.kind === 'ready' ? await maybeRecovered(repo, cohortId, outcome.finalizationId, deps) : false
    return { outcome, attempts, alert: 'none', recovered }
  }

  // First failure: alert and retry 1 together.
  const [alertRes, retryRes] = await Promise.allSettled([
    alertOnFailure(repo, cohortId, outcome, deps),
    safeCompute(repo, cohortId, now),
  ])
  const alert: AlertOutcome = alertRes.status === 'fulfilled' ? alertRes.value : 'undelivered'
  let current: ComputeOutcome = retryRes.status === 'fulfilled' ? retryRes.value : outcome
  attempts++

  for (const delay of deps.delays ?? IN_RUN_RETRY_DELAYS_MS) {
    if (current.kind !== 'failed') break
    await sleep(delay)
    current = await safeCompute(repo, cohortId, now)
    attempts++
  }

  let recovered = false
  if (current.kind === 'ready') {
    recovered = await maybeRecovered(repo, cohortId, current.finalizationId, deps)
  } else if (current.kind === 'failed') {
    // Hand off to the backstop cron.
    await repo
      .updateCohort(cohortId, { next_retry_at: new Date(now().getTime() + BACKSTOP_RETRY_AFTER_MS).toISOString() }, current.finalizationId)
      .catch(() => false)
  }
  return { outcome: current, attempts, alert, recovered }
}

async function safeCompute(repo: GooseRepo, cohortId: string, now: () => Date): Promise<ComputeOutcome> {
  try {
    return await computeGooseCohortOnce(repo, cohortId, { now })
  } catch (e) {
    // computeGooseCohortOnce catches its own failures; this only fires if the
    // bookkeeping around it (cohort read / lease) throws.
    const cohort = await repo.getCohort(cohortId).catch(() => null)
    return {
      kind: 'failed',
      finalizationId: cohort?.finalization_id ?? '',
      code: 'compute_exception',
      message: e instanceof Error ? e.message : String(e),
      coverage: null,
      ms: 0,
      pairs: 0,
      detail: {},
    }
  }
}

async function alertOnFailure(
  repo: GooseRepo,
  cohortId: string,
  failed: Extract<ComputeOutcome, { kind: 'failed' }>,
  deps: RunDeps
): Promise<AlertOutcome> {
  const now = deps.now ?? (() => new Date())
  if (!failed.finalizationId) return 'undelivered'
  if (!(await repo.claimAlert(cohortId, failed.finalizationId, now().toISOString()))) return 'already_alerted'
  const cohort = await repo.getCohort(cohortId)
  if (!cohort) return 'undelivered'
  const res = await sendGooseAlert(
    'failure',
    {
      cohort,
      code: failed.code,
      expected: failed.coverage?.expected_pairs ?? cohort.expected_pairs,
      completed: failed.coverage?.completed_pairs ?? cohort.completed_pairs,
      detail: failed.detail,
    },
    deps.transport,
    deps.recipients ?? process.env.GOOSE_ALERT_EMAILS
  )
  if (res.delivered === 0) {
    // Nobody got it: release the claim so the NEXT failure tries again.
    await repo.releaseAlert(cohortId, failed.finalizationId)
    await repo.logEvent('goose_alert_failed', { cohort_id: cohortId, kind: 'failure', recipients: res.recipients })
    return 'undelivered'
  }
  await repo.logEvent('goose_alert_sent', { cohort_id: cohortId, kind: 'failure', code: failed.code, delivered: res.delivered })
  return 'sent'
}

async function maybeRecovered(repo: GooseRepo, cohortId: string, fid: string, deps: RunDeps): Promise<boolean> {
  const cohort = await repo.getCohort(cohortId)
  if (!cohort || cohort.finalization_id !== fid || !cohort.alerted_at) return false
  const res = await sendGooseAlert(
    'recovered',
    { cohort, expected: cohort.expected_pairs, completed: cohort.completed_pairs },
    deps.transport,
    deps.recipients ?? process.env.GOOSE_ALERT_EMAILS
  )
  await repo.logEvent(res.delivered > 0 ? 'goose_alert_sent' : 'goose_alert_failed', { cohort_id: cohortId, kind: 'recovered' })
  return res.delivered > 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Backstop (cron)
// ─────────────────────────────────────────────────────────────────────────────

/** A finalized cohort whose compute never started is picked up after this long. */
export const BACKSTOP_UNSTARTED_GRACE_MS = 2 * 60_000

export interface BackstopSummary {
  examined: number
  retried: number
  stalled: number
  exhausted_alerts: number
  became_ready: number
}

export async function runGooseBackstop(repo: GooseRepo, deps: RunDeps = {}): Promise<BackstopSummary> {
  const now = deps.now ?? (() => new Date())
  const summary: BackstopSummary = { examined: 0, retried: 0, stalled: 0, exhausted_alerts: 0, became_ready: 0 }
  // The backstop itself makes one attempt per cohort per tick (plus the
  // alert-paired retry on a fresh failure); the cron cadence is the delay.
  const tickDeps: RunDeps = { ...deps, delays: [] }

  for (const c of await repo.listActiveCohorts()) {
    summary.examined++
    const fid = c.finalization_id
    if (!fid) continue
    const t = now().getTime()

    if (new Date(c.event_starts_at).getTime() <= t) {
      // Event started: retries stop. Say so once.
      if (await repo.claimExhaustedAlert(c.id, fid, now().toISOString())) {
        const cov = await repo.coverage(c.id).catch(() => null)
        await sendGooseAlert(
          'exhausted',
          { cohort: c, code: c.last_error_code ?? undefined, expected: cov?.expected_pairs, completed: cov?.completed_pairs },
          deps.transport,
          deps.recipients ?? process.env.GOOSE_ALERT_EMAILS
        )
        await repo.logEvent('goose_alert_sent', { cohort_id: c.id, kind: 'exhausted' })
        summary.exhausted_alerts++
      }
      continue
    }

    const lease = c.compute_lease_until ? new Date(c.compute_lease_until).getTime() : null
    if (lease !== null && lease >= t) continue // an attempt is running right now

    let res: RunResult | null = null
    if (lease !== null && lease < t) {
      summary.stalled++
      res = await failAndRetry(repo, c, 'stalled', tickDeps)
    } else if (c.status === 'error') {
      if (c.next_retry_at && new Date(c.next_retry_at).getTime() > t) continue
      summary.retried++
      res = await runGooseCompute(repo, c.id, tickDeps)
    } else if (c.status === 'processing') {
      const since = c.finalized_at ? t - new Date(c.finalized_at).getTime() : Infinity
      if (since < BACKSTOP_UNSTARTED_GRACE_MS) continue
      summary.retried++
      res = await runGooseCompute(repo, c.id, tickDeps)
    }
    if (res?.outcome.kind === 'ready') summary.became_ready++
  }
  return summary
}
