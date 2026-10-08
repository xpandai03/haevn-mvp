/**
 * Cohort operations + compute end to end against the in-memory store:
 * pair counts (3/8/47), gate-to-zero, re-finalization wipe, coverage
 * adversarial rows, idempotent create/associate, status derivation, partial
 * results before ready.
 * Run: npx tsx lib/goose/__tests__/compute.test.ts
 */
import { eq, ok, report } from '@/lib/metrics/__tests__/_assert'
import { associateMember, createCohort, deriveStatus, finalizeCohort, getCohortResults, getCohortStatus } from '../cohorts'
import { computeGooseCohortOnce } from '../compute'
import { GOOSE_RESULT_KEYS } from '../serialize'
import { associateAll, base, gatedAgainstBase, mid, solo } from './fixtures'
import { createMemoryRepo, type MemoryRepo } from './memoryRepo'

const STARTS = '2026-12-31T20:00:00-05:00'

async function cohortWith(repo: MemoryRepo, eventId: string, n: number, offset = 0) {
  for (let i = 0; i < n; i++) repo.seed(solo(offset + i))
  const c = await createCohort(repo, { goose_event_id: eventId, event_name: 'TEST event', event_starts_at: STARTS })
  if (!c.ok) throw new Error('create failed')
  const ids = Array.from({ length: n }, (_, i) => mid(offset + i))
  await associateAll(repo, c.haevn_cohort_id, ids)
  return { id: c.haevn_cohort_id, ids }
}

async function main() {
  // ── Pair counts 3 / 8 / 47 → ready on exact coverage ───────────────────────
  for (const [n, expected] of [[3, 3], [8, 28], [47, 1081]] as const) {
    const repo = createMemoryRepo()
    const { id, ids } = await cohortWith(repo, `evt-${n}`, n)
    const fin = await finalizeCohort(repo, id, ids)
    ok(fin.ok && fin.expected_pairs === expected, `${n} members: finalize expects ${expected}`)
    eq((await getCohortStatus(repo, id))?.status, 'processing', `${n}: processing before compute`)
    const t0 = Date.now()
    const out = await computeGooseCohortOnce(repo, id)
    const ms = Date.now() - t0
    eq(out.kind, 'ready', `${n}: compute → ready`)
    eq(repo.results.size, expected, `${n}: exactly ${expected} rows written`)
    const st = await getCohortStatus(repo, id)
    eq([st?.status, st?.expected_pairs, st?.completed_pairs], ['ready', expected, expected], `${n}: status ready ${expected}/${expected}`)
    const c = repo.cohorts.get(id)!
    eq([c.last_compute_pairs, typeof c.last_compute_ms], [expected, 'number'], `${n}: wall time + pair count recorded`)
    ok(ms < 5000, `${n}: computed in ${ms}ms`)
  }

  // ── Hard gate → 0 with the 0-59 copy; no floor, no omission ────────────────
  {
    const repo = createMemoryRepo()
    repo.seed(solo(1))
    repo.seed(solo(2))
    repo.seed(solo(3, gatedAgainstBase(3)))
    const c = await createCohort(repo, { goose_event_id: 'evt-gate', event_starts_at: STARTS })
    const id = c.ok ? c.haevn_cohort_id : ''
    await associateAll(repo, id, [mid(1), mid(2), mid(3)])
    await finalizeCohort(repo, id, [mid(1), mid(2), mid(3)])
    eq((await computeGooseCohortOnce(repo, id)).kind, 'ready', 'gated cohort still reaches ready')
    const rows = [...repo.results.values()]
    eq(rows.length, 3, 'gated pairs are written, not omitted')
    const gated = rows.filter((r) => r.member_a === mid(3) || r.member_b === mid(3))
    ok(gated.length === 2 && gated.every((r) => r.gated && r.score === 0 && r.band === 'meaningful_differences'), 'both gated pairs: score 0, gated, 0-59 band')
    const ungated = rows.find((r) => r.member_a === mid(1) && r.member_b === mid(2))!
    ok(!ungated.gated && ungated.score > 0, `ungated pair keeps its real score (${ungated.score})`)
    const res = await getCohortResults(repo, id)
    const g = res!.pairs.find((p) => p.member_id_b === mid(3) && p.member_id_a === mid(1))!
    eq([g.compatibility_pct, g.classification, g.headline], [0, 'Meaningful Differences', 'A LONG-SHOT MATCH'], 'gated pair serializes as 0% long-shot')
    ok(res!.pairs.every((p) => Object.keys(p).join() === GOOSE_RESULT_KEYS.join()), 'every result row has exactly the contract keys')
  }

  // ── Re-finalization wipes and recomputes; stale rows can never count ───────
  {
    const repo = createMemoryRepo()
    const { id } = await cohortWith(repo, 'evt-refin', 6)
    await finalizeCohort(repo, id, [mid(0), mid(1), mid(2), mid(3)])
    await computeGooseCohortOnce(repo, id)
    eq(repo.results.size, 6, 'first population: 4 members → 6 rows')
    const oldFid = repo.cohorts.get(id)!.finalization_id!

    const fin2 = await finalizeCohort(repo, id, [mid(2), mid(3), mid(4), mid(5), mid(4)]) // dup id ignored
    ok(fin2.ok && fin2.expected_pairs === 6, 're-finalize: 4 distinct members → 6 expected')
    eq(repo.results.size, 0, 're-finalize wipes every prior row')
    ok(fin2.ok && fin2.finalization_id !== oldFid, 're-finalize starts a fresh finalization')
    eq((await getCohortStatus(repo, id))?.status, 'processing', 're-finalize resets to processing')

    // A row from the old finalization for a pair that is ALSO in the new population.
    repo.rawInsertResult({ cohort_id: id, member_a: mid(2), member_b: mid(3), finalization_id: oldFid, score: 99, band: 'exceptional', gated: false, engine_version: 'x' })
    eq((await repo.coverage(id)).completed_pairs, 0, 'stale-finalization row does not count')
    await computeGooseCohortOnce(repo, id)
    eq((await getCohortStatus(repo, id))?.status, 'ready', 'recomputed population ready')
    const newFid = fin2.ok ? fin2.finalization_id : 'missing'
    ok([...repo.results.values()].every((r) => r.finalization_id === newFid), 'no row of the old finalization survives the recompute')
    eq(repo.members.get(`${id}|${mid(0)}`)?.finalized, false, 'dropped member: still associated, no longer finalized')
    const res = await getCohortResults(repo, id)
    ok(!res!.pairs.some((p) => [p.member_id_a, p.member_id_b].includes(mid(0))), 'dropped member absent from results')
  }

  // ── Coverage adversarial rows against a live cohort ─────────────────────────
  {
    const repo = createMemoryRepo()
    const { id, ids } = await cohortWith(repo, 'evt-adv', 4)
    repo.seed(solo(90))
    await finalizeCohort(repo, id, ids)
    await computeGooseCohortOnce(repo, id)
    const fid = repo.cohorts.get(id)!.finalization_id!
    const victim = [...repo.results.values()][0]
    repo.results.delete(`${id}|${victim.member_a}|${victim.member_b}`)
    eq((await repo.coverage(id)).completed_pairs, 5, 'one pair removed → 5/6')

    let mirrorRejected = false
    try {
      repo.rawInsertResult({ ...victim, member_a: victim.member_b, member_b: victim.member_a })
    } catch {
      mirrorRejected = true
    }
    ok(mirrorRejected, 'mirrored row rejected by the CHECK')
    repo.rawInsertResult({ ...victim, member_a: mid(0), member_b: mid(90), finalization_id: fid }) // outsider
    eq((await repo.coverage(id)).completed_pairs, 5, 'outsider row does not count')
    const dupe = [...repo.results.values()][0]
    repo.rawInsertResult({ ...dupe }) // same PK: overwrites, never a second row
    eq((await repo.coverage(id)).completed_pairs, 5, 'duplicate pair cannot count twice')
    eq(deriveStatus({ ...repo.cohorts.get(id)!, status: 'ready' }, await repo.coverage(id)).status, 'processing', 'stored ready + live shortfall → NOT ready')
  }

  // ── Missing survey → error, partial results served with status echoed ──────
  {
    const repo = createMemoryRepo()
    const { id, ids } = await cohortWith(repo, 'evt-miss', 3)
    repo.seed(solo(3, null)) // associated guest whose survey never reached HAEVN
    await associateAll(repo, id, [mid(3)])
    await finalizeCohort(repo, id, [...ids, mid(3)])
    const out = await computeGooseCohortOnce(repo, id)
    ok(out.kind === 'failed' && out.code === 'members_missing_survey', 'missing survey → members_missing_survey')
    const st = await getCohortStatus(repo, id)
    eq([st?.status, st?.expected_pairs, st?.completed_pairs], ['error', 6, 3], 'status error 3/6')
    const res = await getCohortResults(repo, id)
    eq([res?.status, res?.pairs.length], ['error', 3], 'partial set returned with status echoed')
  }

  // ── Create / associate idempotency, couples, email path ─────────────────────
  {
    const repo = createMemoryRepo()
    const c1 = await createCohort(repo, { goose_event_id: 'evt-idem', event_name: 'A', event_starts_at: STARTS })
    const c2 = await createCohort(repo, { goose_event_id: 'evt-idem', event_name: 'B', event_starts_at: STARTS })
    ok(c1.ok && c2.ok && c1.haevn_cohort_id === c2.haevn_cohort_id, 'create is idempotent on goose_event_id')
    eq(repo.cohorts.size, 1, 'repeat create never duplicates')
    eq((await createCohort(repo, { goose_event_id: ' ', event_starts_at: STARTS })).ok, false, 'blank event id rejected')
    eq((await createCohort(repo, { goose_event_id: 'x', event_starts_at: 'tomorrow-ish' })).ok, false, 'bad timestamp rejected')
    const id = c1.ok ? c1.haevn_cohort_id : ''

    repo.seed({
      id: mid(50),
      profile_type: 'couple',
      users: [
        { user_id: 'u-50-owner', role: 'owner', email: 'test-goose-50a@qa.haevn.invalid', answers: base(50) },
        { user_id: 'u-50-partner', role: 'member', email: 'test-goose-50b@qa.haevn.invalid', answers: null },
      ],
    })
    repo.seed(solo(51, null))
    const byId = await associateMember(repo, id, { member_id: mid(50) })
    const again = await associateMember(repo, id, { member_id: mid(50) })
    const partner = await associateMember(repo, id, { member_email: 'TEST-GOOSE-50B@qa.haevn.invalid' })
    eq(byId, { ok: true, member_id: mid(50), associated: true, survey_complete: true }, 'associate by id')
    eq(again, byId, 're-association returns the same success')
    eq(partner, byId, "couple partner's email (non-owner, any case) resolves to the shared member_id")
    eq([...repo.members.values()].length, 1, 'couple + repeats → one association row')
    eq(await associateMember(repo, id, { member_id: mid(51) }), { ok: true, member_id: mid(51), associated: true, survey_complete: false }, 'survey_complete false when no survey')
    eq(await associateMember(repo, id, { member_email: 'nobody@qa.haevn.invalid' }), { ok: false, error: 'member_not_found' }, 'unknown email → member_not_found')
    eq(await associateMember(repo, id, { member_id: mid(77) }), { ok: false, error: 'member_not_found' }, 'unknown id → member_not_found')
    eq(await associateMember(repo, id, { member_id: 'not-a-uuid' }), { ok: false, error: 'member_not_found' }, 'malformed id → member_not_found')
    eq(await associateMember(repo, mid(999), { member_id: mid(50) }), { ok: false, error: 'cohort_not_found' }, 'unknown cohort')
    const fin = await finalizeCohort(repo, id, [mid(50), mid(50)])
    ok(fin.ok && fin.expected_pairs === 0, 'couple listed twice → one member, 0 pairs')
    // Contract addendum: never-associated ids → unknown_members, all-or-nothing.
    repo.seed(solo(52)) // a real member, just never associated with this cohort
    const finBefore = repo.cohorts.get(id)!
    const rej = await finalizeCohort(repo, id, [mid(50), mid(51), mid(88), mid(52), 'junk'])
    eq(rej, { ok: false, error: 'unknown_members', unknown_member_ids: [mid(88), mid(52), 'junk'] }, 'finalize lists every never-associated id (incl. non-existent + malformed)')
    const finAfter = repo.cohorts.get(id)!
    eq([finAfter.finalization_id, finAfter.population_hash, finAfter.expected_pairs], [finBefore.finalization_id, finBefore.population_hash, finBefore.expected_pairs], 'rejected finalize leaves the population unchanged')
    eq([...repo.members.values()].filter((m) => m.finalized).map((m) => m.member_id), [mid(50)], 'finalized flags untouched by a rejected finalize')
    eq(repo.members.has(`${id}|${mid(52)}`), false, 'a rejected finalize associates nobody')
    eq(await finalizeCohort(repo, mid(999), [mid(50)]), { ok: false, error: 'cohort_not_found' }, 'finalize on unknown cohort → cohort_not_found')
    eq(deriveStatus({ status: 'open', finalization_id: null, finalized_at: null, ready_at: null }, null).status, 'processing', 'open (never finalized) reads processing')
  }

  report('goose compute + cohort ops')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
