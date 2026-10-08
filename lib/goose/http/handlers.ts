/**
 * HTTP layer for the Goose integration (contract v1.0 + addendum). The App
 * Router route files under app/api/goose/ are one-line wrappers around these,
 * so the whole surface is testable against the in-memory repo.
 *
 * Every request: auth (503 closed if unconfigured, 401 bodyless) → per-route
 * ceiling (429) → validate → PR 1's operation → one structured log line.
 * Logs carry route, status, cohort id, counts and timing — never a token,
 * never a raw email (sha256 prefix only), never a request body.
 */

import { createHash } from 'crypto'
import { associateMember, createCohort, finalizeCohort, getCohortResults, getCohortStatus } from '../cohorts'
import type { GooseRepo } from '../repo'
import { runGooseCompute } from '../run'
import { findForbiddenGooseKeys } from '../serialize'
import { checkGooseAuth } from './auth'
import { takeGooseRateToken, type GooseRouteClass } from './rateLimit'

export interface GooseHttpDeps {
  /** Lazy so 401/503/429/400 paths never construct a database client. */
  repo: () => GooseRepo
  /** Runs work after the response is sent (next/server `after` in routes). */
  schedule: (task: () => Promise<unknown>) => void
  /** Defaults to process.env.GOOSE_SHARED_SECRET. */
  secret?: string
}

/** Contract cap on one finalize population. */
export const MAX_FINALIZE_MEMBERS = 500
const MAX_BODY_BYTES = 64 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/

type Outcome = { status: number; body?: unknown; headers?: Record<string, string>; log?: Record<string, unknown> }

function respond(o: Outcome): Response {
  const headers: Record<string, string> = { 'cache-control': 'no-store', ...(o.headers ?? {}) }
  if (o.body === undefined) return new Response(null, { status: o.status, headers })
  return new Response(JSON.stringify(o.body), { status: o.status, headers: { ...headers, 'content-type': 'application/json' } })
}

const invalid = (detail: string): Outcome => ({ status: 400, body: { error: 'invalid_request', detail } })
const cohortNotFound = (): Outcome => ({ status: 404, body: { error: 'cohort_not_found' } })

function emailHash(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12)
}

async function readJson(req: Request): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; outcome: Outcome }> {
  const text = await req.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return { ok: false, outcome: invalid('body too large') }
  try {
    const v = JSON.parse(text)
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, outcome: invalid('body must be a JSON object') }
    return { ok: true, value: v as Record<string, unknown> }
  } catch {
    return { ok: false, outcome: invalid('body must be valid JSON') }
  }
}

/** Auth → rate limit → handler → log. Unexpected errors become a terse 500. */
async function endpoint(
  cls: GooseRouteClass,
  req: Request,
  deps: GooseHttpDeps,
  cohortId: string | null,
  handler: () => Promise<Outcome>
): Promise<Response> {
  const t0 = Date.now()
  let outcome: Outcome
  const auth = checkGooseAuth(req.headers.get('authorization'), deps.secret ?? process.env.GOOSE_SHARED_SECRET)
  if (auth === 'not_configured') {
    outcome = { status: 503, log: { reason: 'secret_not_configured' } }
  } else if (auth === 'unauthorized') {
    outcome = { status: 401 }
  } else {
    const wait = takeGooseRateToken(cls)
    if (wait !== null) {
      outcome = { status: 429, body: { error: 'rate_limited' }, headers: { 'retry-after': String(wait) } }
    } else {
      try {
        outcome = await handler()
      } catch (e) {
        outcome = { status: 500, body: { error: 'internal_error' }, log: { error: e instanceof Error ? e.message.slice(0, 200) : 'unknown' } }
      }
    }
  }
  const line = { goose_api: cls, method: req.method, status: outcome.status, cohort_id: cohortId, ms: Date.now() - t0, ...(outcome.log ?? {}) }
  if (outcome.status >= 500) console.error('[goose-api]', JSON.stringify(line))
  else console.log('[goose-api]', JSON.stringify(line))
  return respond({ ...outcome, log: undefined })
}

// ── 1. POST /cohorts ─────────────────────────────────────────────────────────

export function handleCreateCohort(req: Request, deps: GooseHttpDeps): Promise<Response> {
  return endpoint('create_cohort', req, deps, null, async () => {
    const parsed = await readJson(req)
    if (!parsed.ok) return parsed.outcome
    const { goose_event_id, event_name, event_starts_at } = parsed.value
    if (typeof goose_event_id !== 'string' || !goose_event_id.trim() || goose_event_id.length > 200) {
      return invalid('goose_event_id must be a non-empty string (max 200)')
    }
    if (event_name !== undefined && event_name !== null && (typeof event_name !== 'string' || event_name.length > 300)) {
      return invalid('event_name must be a string (max 300)')
    }
    if (typeof event_starts_at !== 'string' || !ISO_WITH_TZ.test(event_starts_at) || !Number.isFinite(Date.parse(event_starts_at))) {
      return invalid('event_starts_at must be ISO 8601 with a timezone')
    }
    const r = await createCohort(deps.repo(), { goose_event_id, event_name: (event_name as string | null | undefined) ?? null, event_starts_at })
    if (!r.ok) return invalid(r.detail)
    return { status: 200, body: { haevn_cohort_id: r.haevn_cohort_id }, log: { cohort_id: r.haevn_cohort_id, created: r.created } }
  })
}

// ── 2. POST /cohorts/{id}/members ───────────────────────────────────────────

export function handleAssociate(req: Request, cohortId: string, deps: GooseHttpDeps): Promise<Response> {
  return endpoint('associate', req, deps, cohortId, async () => {
    if (!UUID_RE.test(cohortId)) return cohortNotFound()
    const parsed = await readJson(req)
    if (!parsed.ok) return parsed.outcome
    const { member_email, member_id } = parsed.value
    const hasEmail = member_email !== undefined && member_email !== null
    const hasId = member_id !== undefined && member_id !== null
    if (hasEmail === hasId) return invalid('send exactly one of member_email or member_id')
    let input: { member_email: string } | { member_id: string }
    let log: Record<string, unknown>
    if (hasEmail) {
      if (typeof member_email !== 'string' || member_email.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(member_email.trim())) {
        return invalid('member_email must be an email address')
      }
      input = { member_email }
      log = { by: 'email', email_hash: emailHash(member_email) }
    } else {
      if (typeof member_id !== 'string' || member_id.length > 64) return invalid('member_id must be a string')
      input = { member_id }
      log = { by: 'member_id' }
    }
    const r = await associateMember(deps.repo(), cohortId, input)
    if (!r.ok) {
      if (r.error === 'cohort_not_found') return cohortNotFound()
      if (r.error === 'member_not_found') return { status: 404, body: { error: 'member_not_found' }, log }
      return invalid('send exactly one of member_email or member_id')
    }
    return {
      status: 200,
      body: { member_id: r.member_id, associated: true, survey_complete: r.survey_complete },
      log: { ...log, member_id: r.member_id, survey_complete: r.survey_complete },
    }
  })
}

// ── 3. POST /cohorts/{id}/finalize ──────────────────────────────────────────

/**
 * Replaces the population and returns `processing` at once; the compute runs
 * after the response (PR 1's runGooseCompute: retries + alerts). Status is the
 * source of truth — at V1 scale it reads ready within seconds.
 */
export function handleFinalize(req: Request, cohortId: string, deps: GooseHttpDeps): Promise<Response> {
  return endpoint('finalize', req, deps, cohortId, async () => {
    if (!UUID_RE.test(cohortId)) return cohortNotFound()
    const parsed = await readJson(req)
    if (!parsed.ok) return parsed.outcome
    const ids = parsed.value.member_ids
    if (!Array.isArray(ids) || !ids.every((m) => typeof m === 'string' && m.length <= 64)) {
      return invalid('member_ids must be an array of member_id strings')
    }
    if (new Set(ids).size > MAX_FINALIZE_MEMBERS) return invalid(`member_ids exceeds ${MAX_FINALIZE_MEMBERS}`)

    const repo = deps.repo()
    const r = await finalizeCohort(repo, cohortId, ids)
    if (!r.ok) {
      if (r.error === 'cohort_not_found') return cohortNotFound()
      if (r.error === 'unknown_members') {
        return { status: 400, body: { error: 'unknown_members', unknown_member_ids: r.unknown_member_ids }, log: { unknown: r.unknown_member_ids.length } }
      }
      return invalid('member_ids must be an array of member_id strings')
    }
    deps.schedule(async () => {
      const run = await runGooseCompute(repo, cohortId)
      console.log('[goose-api]', JSON.stringify({
        goose_api: 'compute', cohort_id: cohortId, outcome: run.outcome.kind, attempts: run.attempts, alert: run.alert,
        ...(run.outcome.kind === 'ready' ? { pairs: run.outcome.pairs, ms: run.outcome.ms } : {}),
        ...(run.outcome.kind === 'failed' ? { code: run.outcome.code } : {}),
      }))
    })
    return {
      status: 200,
      body: { status: 'processing', expected_pairs: r.expected_pairs },
      log: { members: new Set(ids).size, expected_pairs: r.expected_pairs },
    }
  })
}

// ── 4. GET /cohorts/{id}/status ─────────────────────────────────────────────

export function handleStatus(req: Request, cohortId: string, deps: GooseHttpDeps): Promise<Response> {
  return endpoint('status', req, deps, cohortId, async () => {
    if (!UUID_RE.test(cohortId)) return cohortNotFound()
    const st = await getCohortStatus(deps.repo(), cohortId)
    if (!st) return cohortNotFound()
    const body = {
      status: st.status,
      expected_pairs: st.expected_pairs,
      completed_pairs: st.completed_pairs,
      finalized_at: st.finalized_at,
      ready_at: st.ready_at,
    }
    return { status: 200, body, log: { state: st.status, completed: st.completed_pairs, expected: st.expected_pairs } }
  })
}

// ── 5. GET /cohorts/{id}/results ────────────────────────────────────────────

export function handleResults(req: Request, cohortId: string, deps: GooseHttpDeps): Promise<Response> {
  return endpoint('results', req, deps, cohortId, async () => {
    if (!UUID_RE.test(cohortId)) return cohortNotFound()
    const res = await getCohortResults(deps.repo(), cohortId)
    if (!res) return cohortNotFound()
    // Rebuild the envelope from named fields, then re-assert the allowlist at
    // the edge (defense in depth on top of getCohortResults' own check).
    const body = { status: res.status, pairs: res.pairs }
    const bad = findForbiddenGooseKeys(body)
    if (bad.length > 0) {
      return { status: 500, body: { error: 'internal_error' }, log: { serializer_violation: bad.slice(0, 5) } }
    }
    return { status: 200, body, log: { state: res.status, pairs: res.pairs.length } }
  })
}
