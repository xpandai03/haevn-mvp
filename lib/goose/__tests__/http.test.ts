/**
 * The Goose HTTP surface (contract v1.0 + addendum), driven through the real
 * handlers against the in-memory store: auth, idempotency, validation, the
 * addendum's 404/400 bodies, finalize replace semantics, the result field set
 * at the HTTP layer, log hygiene, rate limiting, and a full lifecycle.
 * Run: npx tsx lib/goose/__tests__/http.test.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { eq, ok, report } from '@/lib/metrics/__tests__/_assert'
import { handleAssociate, handleCreateCohort, handleFinalize, handleResults, handleStatus, MAX_FINALIZE_MEMBERS, type GooseHttpDeps } from '../http/handlers'
import { GOOSE_RATE_LIMITS, resetGooseRateLimits } from '../http/rateLimit'
import { GOOSE_RESULT_KEYS } from '../serialize'
import { base, gatedAgainstBase, mid, solo } from './fixtures'
import { createMemoryRepo, type MemoryRepo } from './memoryRepo'

const SECRET = 'test-secret-7f3c9a1e5b2d4c6a8e0f'
const BASE = 'https://www.haevn.app/api/goose'
const STARTS = '2026-12-31T20:00:00-05:00'

function harness(repo: MemoryRepo = createMemoryRepo(), secret: string | undefined = SECRET) {
  const tasks: Array<() => Promise<unknown>> = []
  const deps: GooseHttpDeps = { repo: () => repo, schedule: (t) => void tasks.push(t), secret }
  const runScheduled = async () => {
    while (tasks.length) await tasks.shift()!()
  }
  return { repo, deps, tasks, runScheduled }
}

function req(method: string, path: string, body?: unknown, token: string | null = SECRET): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token !== null) headers.authorization = `Bearer ${token}`
  return new Request(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })
}

async function json(res: Response): Promise<any> {
  const t = await res.text()
  return t ? JSON.parse(t) : null
}

function captureLogs() {
  const lines: string[] = []
  const orig = { log: console.log, error: console.error, warn: console.warn }
  console.log = (...a: unknown[]) => void lines.push(a.map(String).join(' '))
  console.error = (...a: unknown[]) => void lines.push(a.map(String).join(' '))
  console.warn = (...a: unknown[]) => void lines.push(a.map(String).join(' '))
  return { lines, restore: () => Object.assign(console, orig) }
}

async function create(h: ReturnType<typeof harness>, eventId = 'evt-1') {
  const r = await handleCreateCohort(req('POST', '/cohorts', { goose_event_id: eventId, event_name: 'TEST', event_starts_at: STARTS }), h.deps)
  return (await json(r)).haevn_cohort_id as string
}

async function main() {
  // ── Auth ───────────────────────────────────────────────────────────────────
  {
    resetGooseRateLimits()
    const h = harness()
    const none = await handleCreateCohort(req('POST', '/cohorts', { goose_event_id: 'a', event_starts_at: STARTS }, null), h.deps)
    eq([none.status, await none.text()], [401, ''], 'no token → 401, empty body')
    const wrong = await handleCreateCohort(req('POST', '/cohorts', { goose_event_id: 'a', event_starts_at: STARTS }, 'nope'), h.deps)
    eq([wrong.status, await wrong.text()], [401, ''], 'wrong token → 401, empty body')
    const almost = await handleCreateCohort(req('POST', '/cohorts', { goose_event_id: 'a', event_starts_at: STARTS }, SECRET + 'x'), h.deps)
    eq(almost.status, 401, 'secret + suffix → 401')
    const blank = await handleCreateCohort(new Request(`${BASE}/cohorts`, { method: 'POST', headers: { authorization: 'Bearer ' }, body: '{}' }), h.deps)
    eq(blank.status, 401, '"Bearer " with nothing → 401')
    const basic = await handleCreateCohort(new Request(`${BASE}/cohorts`, { method: 'POST', headers: { authorization: `Basic ${SECRET}` }, body: '{}' }), h.deps)
    eq(basic.status, 401, 'wrong scheme → 401')
    eq(h.repo.cohorts.size, 0, 'no unauthorized request touched the store')
    const right = await handleCreateCohort(req('POST', '/cohorts', { goose_event_id: 'a', event_starts_at: STARTS }), h.deps)
    eq(right.status, 200, 'right token → 200')

    // Absent env: every route 503s closed, before any database access.
    const saved = process.env.GOOSE_SHARED_SECRET
    delete process.env.GOOSE_SHARED_SECRET
    const closed: GooseHttpDeps = { repo: () => { throw new Error('repo must not be touched when unconfigured') }, schedule: () => {} }
    const id = mid(1)
    const results = await Promise.all([
      handleCreateCohort(req('POST', '/cohorts', { goose_event_id: 'a', event_starts_at: STARTS }), closed),
      handleAssociate(req('POST', `/cohorts/${id}/members`, { member_id: id }), id, closed),
      handleFinalize(req('POST', `/cohorts/${id}/finalize`, { member_ids: [] }), id, closed),
      handleStatus(req('GET', `/cohorts/${id}/status`), id, closed),
      handleResults(req('GET', `/cohorts/${id}/results`), id, closed),
    ])
    eq(results.map((r) => r.status), [503, 503, 503, 503, 503], 'GOOSE_SHARED_SECRET absent → all five routes 503 (closed, never open)')
    ok((await Promise.all(results.map((r) => r.text()))).every((t) => t === ''), '503s carry no body')
    if (saved !== undefined) process.env.GOOSE_SHARED_SECRET = saved
  }

  // ── 1. Create: idempotent + validation ─────────────────────────────────────
  {
    resetGooseRateLimits()
    const h = harness()
    const a = await create(h, 'evt-same')
    const b = await create(h, 'evt-same')
    ok(!!a && a === b, 'double create returns the same haevn_cohort_id')
    eq(h.repo.cohorts.size, 1, 'double create → one cohort')
    const shape = await json(await handleCreateCohort(req('POST', '/cohorts', { goose_event_id: 'evt-shape', event_name: 'x', event_starts_at: STARTS }), h.deps))
    eq(Object.keys(shape), ['haevn_cohort_id'], 'create response is exactly {haevn_cohort_id}')
    const bad = async (body: unknown) => {
      const r = await handleCreateCohort(req('POST', '/cohorts', body), h.deps)
      return [r.status, (await json(r))?.error]
    }
    eq(await bad({ goose_event_id: 'x', event_starts_at: '2026-12-31T20:00:00' }), [400, 'invalid_request'], 'timestamp without timezone → 400')
    eq(await bad({ goose_event_id: '', event_starts_at: STARTS }), [400, 'invalid_request'], 'blank event id → 400')
    eq(await bad({ event_starts_at: STARTS }), [400, 'invalid_request'], 'missing event id → 400')
    eq(await bad('{not json'), [400, 'invalid_request'], 'malformed JSON → 400')
    eq(await bad([1, 2]), [400, 'invalid_request'], 'non-object body → 400')
    eq(await bad({ goose_event_id: 'x'.repeat(201), event_starts_at: STARTS }), [400, 'invalid_request'], 'oversized event id → 400')
    eq(await bad({ goose_event_id: 'x', event_name: 'y'.repeat(70_000), event_starts_at: STARTS }), [400, 'invalid_request'], 'oversized body → 400')
  }

  // ── 2. Associate: email or id, idempotent, 404s ─────────────────────────────
  {
    resetGooseRateLimits()
    const h = harness()
    h.repo.seed(solo(1))
    h.repo.seed(solo(2, null))
    const id = await create(h)
    const post = (body: unknown, cid = id) => handleAssociate(req('POST', `/cohorts/${cid}/members`, body), cid, h.deps)
    const byEmail = await post({ member_email: 'TEST-GOOSE-1@qa.haevn.invalid' })
    const byEmailBody = await json(byEmail)
    eq([byEmail.status, byEmailBody], [200, { member_id: mid(1), associated: true, survey_complete: true }], 'associate by email (any case)')
    const again = await post({ member_email: 'test-goose-1@qa.haevn.invalid' })
    eq([again.status, await json(again)], [200, byEmailBody], 're-association returns the same success')
    const byId = await post({ member_id: mid(1) })
    eq(await json(byId), byEmailBody, 'same member by id → same success')
    eq([...h.repo.members.values()].length, 1, 'three associations → one row')
    eq(await json(await post({ member_id: mid(2) })), { member_id: mid(2), associated: true, survey_complete: false }, 'survey_complete false surfaces')
    const nf = await post({ member_email: 'nobody@qa.haevn.invalid' })
    eq([nf.status, await json(nf)], [404, { error: 'member_not_found' }], 'unknown email → 404 member_not_found')
    eq((await post({ member_id: mid(77) })).status, 404, 'unknown member_id → 404')
    const cnf = await post({ member_id: mid(1) }, mid(999))
    eq([cnf.status, await json(cnf)], [404, { error: 'cohort_not_found' }], 'unknown cohort → 404 cohort_not_found')
    eq((await post({ member_id: mid(1) }, 'not-a-uuid')).status, 404, 'malformed cohort id → 404 cohort_not_found')
    eq((await post({ member_id: mid(1), member_email: 'a@b.c' })).status, 400, 'both identifiers → 400')
    eq((await post({})).status, 400, 'neither identifier → 400')
    eq((await post({ member_email: 'not an email' })).status, 400, 'malformed email → 400')
  }

  // ── 3. Finalize: addendum 400, cap, replace semantics ──────────────────────
  {
    resetGooseRateLimits()
    const h = harness()
    for (let i = 0; i < 6; i++) h.repo.seed(solo(i))
    const id = await create(h)
    for (let i = 0; i < 5; i++) await handleAssociate(req('POST', `/cohorts/${id}/members`, { member_id: mid(i) }), id, h.deps)
    const fin = (ids: unknown, cid = id) => handleFinalize(req('POST', `/cohorts/${cid}/finalize`, { member_ids: ids }), cid, h.deps)

    const rej = await fin([mid(0), mid(1), mid(5), 'junk'])
    eq([rej.status, await json(rej)], [400, { error: 'unknown_members', unknown_member_ids: [mid(5), 'junk'] }], 'never-associated ids → 400 with the full offending list')
    eq(h.repo.cohorts.get(id)!.finalization_id, null, 'rejected finalize froze nothing')
    eq(h.tasks.length, 0, 'rejected finalize schedules no compute')

    const first = await fin([mid(0), mid(1), mid(2), mid(3)])
    eq([first.status, await json(first)], [200, { status: 'processing', expected_pairs: 6 }], 'finalize → 200 {status: processing, expected_pairs}')
    eq(h.tasks.length, 1, 'finalize schedules the compute after the response')
    await h.runScheduled()
    eq((await json(await handleStatus(req('GET', `/cohorts/${id}/status`), id, h.deps))).status, 'ready', 'first population ready')

    const second = await fin([mid(2), mid(3), mid(4), mid(4)])
    eq(await json(second), { status: 'processing', expected_pairs: 3 }, 're-finalize replaces the population (dupes collapse)')
    const mid1 = await json(await handleStatus(req('GET', `/cohorts/${id}/status`), id, h.deps))
    eq([mid1.status, mid1.completed_pairs, mid1.ready_at], ['processing', 0, null], 'replaced population reads processing, prior results gone')
    await h.runScheduled()
    const res = await json(await handleResults(req('GET', `/cohorts/${id}/results`), id, h.deps))
    eq(res.pairs.length, 3, 'results cover only the new population')
    ok(!res.pairs.some((p: any) => [p.member_id_a, p.member_id_b].some((m: string) => m === mid(0) || m === mid(1))), 'dropped members absent from results')

    eq((await fin('nope')).status, 400, 'member_ids not an array → 400')
    eq((await fin([1, 2])).status, 400, 'non-string ids → 400')
    const big = Array.from({ length: MAX_FINALIZE_MEMBERS + 1 }, (_, i) => mid(1000 + i))
    const over = await fin(big)
    eq([over.status, (await json(over)).error], [400, 'invalid_request'], `more than ${MAX_FINALIZE_MEMBERS} members → 400`)
    eq((await fin([mid(0)], mid(999))).status, 404, 'finalize unknown cohort → 404')
  }

  // ── 4/5. Status + results shapes, partial before ready ─────────────────────
  {
    resetGooseRateLimits()
    const h = harness()
    for (let i = 0; i < 3; i++) h.repo.seed(solo(i))
    const id = await create(h)
    const open = await json(await handleStatus(req('GET', `/cohorts/${id}/status`), id, h.deps))
    eq(Object.keys(open), ['status', 'expected_pairs', 'completed_pairs', 'finalized_at', 'ready_at'], 'status response is exactly the contract fields')
    eq(open.status, 'processing', 'never-finalized cohort reads processing')
    for (let i = 0; i < 3; i++) await handleAssociate(req('POST', `/cohorts/${id}/members`, { member_id: mid(i) }), id, h.deps)
    await handleFinalize(req('POST', `/cohorts/${id}/finalize`, { member_ids: [mid(0), mid(1), mid(2)] }), id, h.deps)
    const partial = await json(await handleResults(req('GET', `/cohorts/${id}/results`), id, h.deps))
    eq([Object.keys(partial), partial.status, partial.pairs.length], [['status', 'pairs'], 'processing', 0], 'before ready: partial set with status echoed')
    eq((await handleStatus(req('GET', `/cohorts/${mid(999)}/status`), mid(999), h.deps)).status, 404, 'status unknown cohort → 404')
    const rnf = await handleResults(req('GET', `/cohorts/${mid(999)}/results`), mid(999), h.deps)
    eq([rnf.status, await json(rnf)], [404, { error: 'cohort_not_found' }], 'results unknown cohort → 404 cohort_not_found')
  }

  // ── Full lifecycle over the HTTP layer ──────────────────────────────────────
  {
    resetGooseRateLimits()
    const h = harness()
    for (let i = 0; i < 5; i++) h.repo.seed(solo(i))
    h.repo.seed(solo(5, gatedAgainstBase(5)))
    const logs = captureLogs()
    let id: string
    let ready: any
    let results: any
    try {
      id = await create(h, 'evt-life')
      ok(id === (await create(h, 'evt-life')), 'lifecycle: create twice → same id')
      for (let i = 0; i < 6; i++) {
        const r = await handleAssociate(req('POST', `/cohorts/${id}/members`, { member_email: `test-goose-${i}@qa.haevn.invalid` }), id, h.deps)
        eq(r.status, 200, `lifecycle: associate guest ${i} by email`)
      }
      const fin = await json(await handleFinalize(req('POST', `/cohorts/${id}/finalize`, { member_ids: Array.from({ length: 6 }, (_, i) => mid(i)) }), id, h.deps))
      eq(fin, { status: 'processing', expected_pairs: 15 }, 'lifecycle: finalize 6 → 15 expected')
      const poll1 = await json(await handleStatus(req('GET', `/cohorts/${id}/status`), id, h.deps))
      eq(poll1.status, 'processing', 'lifecycle: first poll processing')
      await h.runScheduled() // the after() compute
      ready = await json(await handleStatus(req('GET', `/cohorts/${id}/status`), id, h.deps))
      results = await json(await handleResults(req('GET', `/cohorts/${id}/results`), id, h.deps))
    } finally {
      logs.restore()
    }
    eq([ready.status, ready.expected_pairs, ready.completed_pairs], ['ready', 15, 15], 'lifecycle: second poll ready 15/15')
    ok(!!ready.finalized_at && !!ready.ready_at, 'lifecycle: finalized_at + ready_at set')
    eq([results.status, results.pairs.length], ['ready', 15], 'lifecycle: 15 result rows')
    ok(results.pairs.every((p: any) => JSON.stringify(Object.keys(p)) === JSON.stringify([...GOOSE_RESULT_KEYS])), 'lifecycle: every row has exactly the 8 contract keys, nothing extra')
    ok(results.pairs.every((p: any) => Number.isInteger(p.compatibility_pct) && p.compatibility_pct >= 0 && p.compatibility_pct <= 100), 'lifecycle: integer pct 0-100')
    eq(results.pairs.filter((p: any) => p.compatibility_pct === 0 && p.headline === 'A LONG-SHOT MATCH').length, 5, 'lifecycle: the gated guest pairs at 0 with long-shot copy')
    const body = JSON.stringify(results)
    for (const needle of ['test-goose', 'qa.haevn.invalid', 'reason', 'gated', 'tier', 'q9', 'Casual fun', 'finalization']) {
      ok(!body.includes(needle), `lifecycle: results never contain "${needle}"`)
    }

    // Log hygiene over the whole lifecycle.
    const all = logs.lines.join('\n')
    ok(!all.includes(SECRET), 'no log line contains the token')
    ok(!/test-goose-\d@/i.test(all), 'no log line contains a raw member email')
    ok(/"email_hash":"[0-9a-f]{12}"/.test(all), 'association logs carry the email as a 12-char hash')
    ok(logs.lines.filter((l) => l.includes('"goose_api":')).length >= 10, 'every request logged one structured line')
  }

  // ── Rate limit ──────────────────────────────────────────────────────────────
  {
    resetGooseRateLimits()
    const h = harness()
    const n = GOOSE_RATE_LIMITS.create_cohort
    const logs = captureLogs()
    const statuses: number[] = []
    try {
      for (let i = 0; i <= n; i++) statuses.push((await handleCreateCohort(req('POST', '/cohorts', { goose_event_id: `e${i}`, event_starts_at: STARTS }), h.deps)).status)
    } finally {
      logs.restore()
    }
    eq(statuses.filter((s) => s === 200).length, n, `create: ${n} per minute allowed`)
    eq(statuses[n], 429, `create: request ${n + 1} → 429`)
    const r = await handleCreateCohort(req('POST', '/cohorts', { goose_event_id: 'x', event_starts_at: STARTS }), h.deps)
    ok(Number(r.headers.get('retry-after')) >= 1, '429 carries Retry-After')
    eq(await json(r), { error: 'rate_limited' }, '429 body')
    const unauth = await handleCreateCohort(req('POST', '/cohorts', {}, 'wrong'), h.deps)
    eq(unauth.status, 401, 'unauthenticated requests are rejected before (and never spend) the rate budget')
    resetGooseRateLimits()
  }

  // ── Route files are thin wrappers (auth can't be skipped by a route) ────────
  {
    const root = join(__dirname, '..', '..', '..')
    const files: Array<[string, string]> = [
      ['app/api/goose/cohorts/route.ts', 'handleCreateCohort'],
      ['app/api/goose/cohorts/[id]/members/route.ts', 'handleAssociate'],
      ['app/api/goose/cohorts/[id]/finalize/route.ts', 'handleFinalize'],
      ['app/api/goose/cohorts/[id]/status/route.ts', 'handleStatus'],
      ['app/api/goose/cohorts/[id]/results/route.ts', 'handleResults'],
    ]
    for (const [f, fn] of files) {
      const src = readFileSync(join(root, f), 'utf8')
      ok(new RegExp(`return ${fn}\\(`).test(src), `${f} delegates to ${fn} (auth enforced there)`)
      ok(!/console\./.test(src) && !/createAdminClient/.test(src), `${f} has no logging or DB access of its own`)
    }
    const handlers = readFileSync(join(root, 'lib/goose/http/handlers.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    ok(!/console\.[a-z]+\([^)]*(authorization|member_email\b)/.test(handlers), 'handlers never log the header or a raw email')
  }

  report('goose http')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
