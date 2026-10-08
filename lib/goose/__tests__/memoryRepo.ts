/**
 * In-memory GooseRepo for tests. Mirrors migration 062's guarantees so the
 * pipeline is exercised against the same rules the database enforces:
 *   - goose_event_id unique; (cohort, member) association unique
 *   - pair rows: PK (cohort, a, b) upsert-overwrites; CHECK member_a < member_b throws
 *   - coverage = countCoverage over the current finalization (the SQL function's rule)
 *   - finalize = atomic population swap + wipe + fresh finalization id
 * Failure hooks let a test break a specific call N times.
 */

import { randomUUID } from 'crypto'
import { countCoverage, expectedPairs } from '../pairs'
import { pickPrimaryPhotos, type PhotoRow } from '../photos'
import { GooseFinalizeError, type CohortPatch, type GooseRepo, type LoadedInputs, type NewCohort } from '../repo'
import { buildScorableMember, type SurveyInput } from '../score'
import type { SerializableRow } from '../serialize'
import type { CohortRow, PairResultRow, ScorableMember } from '../types'

export interface SeedMember {
  id: string
  profile_type?: 'solo' | 'couple'
  /** users: [user_id, role, answers|null] */
  users: Array<{ user_id: string; role: 'owner' | 'member'; email?: string; answers: Record<string, unknown> | null }>
  photos?: PhotoRow[]
}

export interface MemoryRepo extends GooseRepo {
  seed(m: SeedMember): void
  /** Raw table access for adversarial tests. */
  results: Map<string, PairResultRow>
  cohorts: Map<string, CohortRow>
  members: Map<string, { cohort_id: string; member_id: string; finalized: boolean }>
  events: Array<{ type: string; metadata: Record<string, unknown> }>
  /** Insert a raw row, enforcing the table CHECK exactly like Postgres would. */
  rawInsertResult(row: PairResultRow): void
  /** Make the next n calls of a method throw. */
  failNext(method: keyof GooseRepo, n: number, message?: string): void
  /** Called at the start of every compute lease claim (attempt boundary). */
  onClaimLease?: (attempt: number) => void
  leaseClaims: number
}

export function createMemoryRepo(): MemoryRepo {
  const cohorts = new Map<string, CohortRow>()
  const members = new Map<string, { cohort_id: string; member_id: string; finalized: boolean }>()
  const results = new Map<string, PairResultRow>()
  const partnerships = new Map<string, { id: string; profile_type: string; latitude: null; longitude: null }>()
  const links: Array<{ partnership_id: string; user_id: string; role: string }> = []
  const surveys = new Map<string, SurveyInput>()
  const emails = new Map<string, string>() // lower(email) → user_id
  const photos: PhotoRow[] = []
  const events: Array<{ type: string; metadata: Record<string, unknown> }> = []
  const failures = new Map<string, { n: number; message: string }>()

  const key = (r: Pick<PairResultRow, 'cohort_id' | 'member_a' | 'member_b'>) => `${r.cohort_id}|${r.member_a}|${r.member_b}`
  const mkey = (c: string, m: string) => `${c}|${m}`

  function maybeFail(method: string) {
    const f = failures.get(method)
    if (f && f.n > 0) {
      f.n--
      throw new Error(f.message)
    }
  }

  function rawInsertResult(row: PairResultRow) {
    if (!(row.member_a < row.member_b)) throw new Error('violates check constraint goose_pair_results_check')
    if (!cohorts.has(row.cohort_id)) throw new Error('violates foreign key goose_pair_results_cohort_id_fkey')
    results.set(key(row), { ...row })
  }

  const finalizedIds = (cohortId: string) =>
    [...members.values()].filter((m) => m.cohort_id === cohortId && m.finalized).map((m) => m.member_id).sort()

  const repo: MemoryRepo = {
    results,
    cohorts,
    members,
    events,
    leaseClaims: 0,

    seed(m) {
      partnerships.set(m.id, { id: m.id, profile_type: m.profile_type ?? 'solo', latitude: null, longitude: null })
      for (const u of m.users) {
        links.push({ partnership_id: m.id, user_id: u.user_id, role: u.role })
        if (u.answers) surveys.set(u.user_id, { answers_json: u.answers, completion_pct: 100 })
        if (u.email) emails.set(u.email.toLowerCase(), u.user_id)
      }
      photos.push(...(m.photos ?? []))
    },

    rawInsertResult,

    failNext(method, n, message = `injected ${String(method)} failure`) {
      failures.set(String(method), { n, message })
    },

    async getCohort(id) {
      maybeFail('getCohort')
      const c = cohorts.get(id)
      return c ? { ...c } : null
    },

    async findCohortByEventId(gooseEventId) {
      for (const c of cohorts.values()) if (c.goose_event_id === gooseEventId) return { ...c }
      return null
    },

    async insertCohort(c: NewCohort) {
      for (const x of cohorts.values()) if (x.goose_event_id === c.goose_event_id) return null
      const row: CohortRow = {
        id: randomUUID(), goose_event_id: c.goose_event_id, event_name: c.event_name, event_starts_at: c.event_starts_at,
        status: 'open', finalization_id: null, finalized_at: null, population_hash: null, expected_pairs: null,
        completed_pairs: null, ready_at: null, last_compute_ms: null, last_compute_pairs: null, compute_attempts: 0,
        compute_lease_until: null, next_retry_at: null, last_error_code: null, last_error_at: null, alerted_at: null,
        exhausted_alerted_at: null,
      }
      cohorts.set(row.id, row)
      return { ...row }
    },

    async updateCohort(id, patch: CohortPatch, guard) {
      maybeFail('updateCohort')
      const c = cohorts.get(id)
      if (!c || (guard && c.finalization_id !== guard)) return false
      cohorts.set(id, { ...c, ...patch })
      return true
    },

    async partnershipExists(memberId) {
      return partnerships.has(memberId)
    },

    async findMemberIdByEmail(email) {
      const uid = emails.get(email.trim().toLowerCase())
      if (!uid) return null
      const l = links.filter((x) => x.user_id === uid)
      l.sort((a, b) => Number(b.role === 'owner') - Number(a.role === 'owner') || a.partnership_id.localeCompare(b.partnership_id))
      return l[0]?.partnership_id ?? null
    },

    async associate(cohortId, memberId) {
      const k = mkey(cohortId, memberId)
      if (!members.has(k)) members.set(k, { cohort_id: cohortId, member_id: memberId, finalized: false })
    },

    async hasCompletedSurvey(memberId) {
      return links.some((l) => l.partnership_id === memberId && (surveys.get(l.user_id)?.completion_pct ?? 0) >= 100)
    },

    async finalize(cohortId, memberIds, hash) {
      const c = cohorts.get(cohortId)
      if (!c) throw new GooseFinalizeError('cohort_not_found', 'goose_cohort_not_found')
      const ids = [...new Set(memberIds)]
      const unknown = ids.filter((id) => !partnerships.has(id)).length
      if (unknown > 0) throw new GooseFinalizeError('unknown_members', `goose_unknown_members:${unknown}`)
      for (const m of members.values()) if (m.cohort_id === cohortId) m.finalized = false
      for (const id of ids) members.set(mkey(cohortId, id), { cohort_id: cohortId, member_id: id, finalized: true })
      for (const [k, r] of results) if (r.cohort_id === cohortId) results.delete(k)
      const fid = randomUUID()
      const expected = expectedPairs(ids.length)
      cohorts.set(cohortId, {
        ...c, status: 'processing', finalization_id: fid, finalized_at: new Date().toISOString(), population_hash: hash,
        expected_pairs: expected, completed_pairs: 0, ready_at: null, compute_attempts: 0, compute_lease_until: null,
        next_retry_at: null, last_error_code: null, last_error_at: null, alerted_at: null, exhausted_alerted_at: null,
      })
      return { finalization_id: fid, expected_pairs: expected }
    },

    async finalizedMemberIds(cohortId) {
      return finalizedIds(cohortId)
    },

    async associatedMemberIds(cohortId) {
      return [...members.values()].filter((m) => m.cohort_id === cohortId).map((m) => m.member_id).sort()
    },

    async claimLease(cohortId, fid, nowIso, untilIso) {
      maybeFail('claimLease')
      const c = cohorts.get(cohortId)
      if (!c || c.finalization_id !== fid) return false
      if (c.compute_lease_until && c.compute_lease_until >= nowIso) return false
      cohorts.set(cohortId, { ...c, compute_lease_until: untilIso })
      repo.leaseClaims++
      repo.onClaimLease?.(repo.leaseClaims)
      return true
    },

    async loadScorableMembers(memberIds): Promise<LoadedInputs> {
      maybeFail('loadScorableMembers')
      const inputs = new Map<string, ScorableMember | null>()
      const missingPartnerships: string[] = []
      const missingSurvey: string[] = []
      for (const id of memberIds) {
        const p = partnerships.get(id)
        if (!p) {
          missingPartnerships.push(id)
          inputs.set(id, null)
          continue
        }
        const m = buildScorableMember(p, links.filter((l) => l.partnership_id === id), surveys)
        if (!m) missingSurvey.push(id)
        inputs.set(id, m)
      }
      return { inputs, missingPartnerships, missingSurvey }
    },

    async deleteStaleResults(cohortId, fid) {
      for (const [k, r] of results) if (r.cohort_id === cohortId && r.finalization_id !== fid) results.delete(k)
    },

    async upsertResults(rows) {
      maybeFail('upsertResults')
      for (const r of rows) rawInsertResult(r)
    },

    async coverage(cohortId) {
      maybeFail('coverage')
      const c = cohorts.get(cohortId)
      const rows = [...results.values()].filter((r) => r.cohort_id === cohortId)
      return countCoverage(finalizedIds(cohortId), rows, c?.finalization_id ?? null)
    },

    async claimAlert(cohortId, fid, nowIso) {
      const c = cohorts.get(cohortId)
      if (!c || c.finalization_id !== fid || c.alerted_at) return false
      cohorts.set(cohortId, { ...c, alerted_at: nowIso })
      return true
    },

    async releaseAlert(cohortId, fid) {
      const c = cohorts.get(cohortId)
      if (c && c.finalization_id === fid) cohorts.set(cohortId, { ...c, alerted_at: null })
    },

    async claimExhaustedAlert(cohortId, fid, nowIso) {
      const c = cohorts.get(cohortId)
      if (!c || c.finalization_id !== fid || c.exhausted_alerted_at) return false
      cohorts.set(cohortId, { ...c, exhausted_alerted_at: nowIso })
      return true
    },

    async listResults(cohortId): Promise<SerializableRow[]> {
      const c = cohorts.get(cohortId)
      if (!c?.finalization_id) return []
      const pop = new Set(finalizedIds(cohortId))
      return [...results.values()]
        .filter((r) => r.cohort_id === cohortId && r.finalization_id === c.finalization_id && pop.has(r.member_a) && pop.has(r.member_b))
        .sort((x, y) => x.member_a.localeCompare(y.member_a) || x.member_b.localeCompare(y.member_b))
        .map((r) => ({ member_a: r.member_a, member_b: r.member_b, score: r.score }))
    },

    async primaryPhotos(memberIds) {
      const set = new Set(memberIds)
      return pickPrimaryPhotos(photos.filter((p) => set.has(p.partnership_id)))
    },

    async listActiveCohorts() {
      return [...cohorts.values()].filter((c) => (c.status === 'processing' || c.status === 'error') && c.finalization_id).map((c) => ({ ...c }))
    },

    async logEvent(type, metadata) {
      events.push({ type, metadata })
    },
  }
  return repo
}
