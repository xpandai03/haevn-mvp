/**
 * Goose persistence. Every read and write the cohort pipeline makes goes
 * through this interface, so the pipeline runs unchanged against Supabase
 * (createSupabaseGooseRepo) and against the in-memory store the tests use.
 *
 * Tables touched: goose_cohorts, goose_cohort_members, goose_pair_results
 * (read/write); partnerships, partnership_members, user_survey_responses,
 * profiles, partnership_photos (read only); system_events (insert only).
 * Nothing else — in particular never computed_matches or any notify table.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { pickPrimaryPhotos, type PhotoRow } from './photos'
import { buildScorableMember, type MemberLink, type PartnershipInput, type SurveyInput } from './score'
import type { CohortRow, Coverage, PairResultRow, ScorableMember } from './types'
import type { SerializableRow } from './serialize'

export class GooseFinalizeError extends Error {
  constructor(public code: 'cohort_not_found' | 'unknown_members', message: string) {
    super(message)
    this.name = 'GooseFinalizeError'
  }
}

export type CohortPatch = Partial<Omit<CohortRow, 'id' | 'goose_event_id'>>

export interface NewCohort {
  goose_event_id: string
  event_name: string | null
  event_starts_at: string
}

export interface LoadedInputs {
  inputs: Map<string, ScorableMember | null>
  /** Finalized ids with no partnership row any more. */
  missingPartnerships: string[]
  /** Finalized ids whose partnership has no completed survey. */
  missingSurvey: string[]
}

export interface GooseRepo {
  getCohort(id: string): Promise<CohortRow | null>
  findCohortByEventId(gooseEventId: string): Promise<CohortRow | null>
  /** Insert; returns null when goose_event_id already exists. */
  insertCohort(c: NewCohort): Promise<CohortRow | null>
  /** Patch a cohort. With guardFinalizationId, applies only if it is still current. */
  updateCohort(id: string, patch: CohortPatch, guardFinalizationId?: string): Promise<boolean>

  partnershipExists(memberId: string): Promise<boolean>
  findMemberIdByEmail(email: string): Promise<string | null>
  associate(cohortId: string, memberId: string): Promise<void>
  hasCompletedSurvey(memberId: string): Promise<boolean>
  /** Atomic population swap (goose_finalize_cohort). Throws GooseFinalizeError. */
  finalize(cohortId: string, memberIds: string[], populationHash: string): Promise<{ finalization_id: string; expected_pairs: number }>
  finalizedMemberIds(cohortId: string): Promise<string[]>

  /** Take the single-flight compute lease for this finalization; false if held or superseded. */
  claimLease(cohortId: string, finalizationId: string, nowIso: string, untilIso: string): Promise<boolean>
  loadScorableMembers(memberIds: string[]): Promise<LoadedInputs>
  deleteStaleResults(cohortId: string, finalizationId: string): Promise<void>
  upsertResults(rows: PairResultRow[]): Promise<void>
  coverage(cohortId: string): Promise<Coverage>
  /** Set alerted_at if unset for this finalization; true = this caller owns the alert. */
  claimAlert(cohortId: string, finalizationId: string, nowIso: string): Promise<boolean>
  releaseAlert(cohortId: string, finalizationId: string): Promise<void>
  claimExhaustedAlert(cohortId: string, finalizationId: string, nowIso: string): Promise<boolean>

  /** Current-finalization rows with both members in the finalized set. */
  listResults(cohortId: string): Promise<SerializableRow[]>
  primaryPhotos(memberIds: string[]): Promise<Map<string, string>>
  listActiveCohorts(): Promise<CohortRow[]>
  logEvent(eventType: string, metadata: Record<string, unknown>): Promise<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase implementation
// ─────────────────────────────────────────────────────────────────────────────

type Admin = ReturnType<typeof createAdminClient>

// A single ~500-id .in() overflows the request URL (see buildRecomputeContext).
const IN_CHUNK = 150
const UPSERT_CHUNK = 500
const PAGE = 1000

async function inChunks<T>(ids: readonly string[], run: (slice: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { data, error } = await run(ids.slice(i, i + IN_CHUNK))
    if (error) throw new Error(error.message)
    if (data) out.push(...data)
  }
  return out
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export function createSupabaseGooseRepo(admin: Admin = createAdminClient()): GooseRepo {
  const cohorts = () => admin.from('goose_cohorts')

  async function memberLinks(memberIds: readonly string[]) {
    return inChunks<{ partnership_id: string; user_id: string; role: string | null }>(memberIds, (s) =>
      admin.from('partnership_members').select('partnership_id, user_id, role').in('partnership_id', s)
    )
  }

  async function surveys(userIds: readonly string[]) {
    return inChunks<{ user_id: string; answers_json: unknown; completion_pct: number | null }>(userIds, (s) =>
      admin.from('user_survey_responses').select('user_id, answers_json, completion_pct').in('user_id', s)
    )
  }

  const repo: GooseRepo = {
    async getCohort(id) {
      const { data, error } = await cohorts().select('*').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      return (data as CohortRow | null) ?? null
    },

    async findCohortByEventId(gooseEventId) {
      const { data, error } = await cohorts().select('*').eq('goose_event_id', gooseEventId).maybeSingle()
      if (error) throw new Error(error.message)
      return (data as CohortRow | null) ?? null
    },

    async insertCohort(c) {
      const { data, error } = await cohorts().insert(c).select('*').single()
      if (error) {
        if ((error as { code?: string }).code === '23505') return null
        throw new Error(error.message)
      }
      return data as CohortRow
    },

    async updateCohort(id, patch, guardFinalizationId) {
      let q = cohorts().update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
      if (guardFinalizationId) q = q.eq('finalization_id', guardFinalizationId)
      const { data, error } = await q.select('id')
      if (error) throw new Error(error.message)
      return (data?.length ?? 0) > 0
    },

    async partnershipExists(memberId) {
      const { data, error } = await admin.from('partnerships').select('id').eq('id', memberId).maybeSingle()
      if (error) {
        // A malformed uuid is "not found", not a server error.
        if ((error as { code?: string }).code === '22P02') return false
        throw new Error(error.message)
      }
      return !!data
    },

    async findMemberIdByEmail(email) {
      const normalized = email.trim()
      if (!normalized) return null
      const { data: profiles, error } = await admin.from('profiles').select('user_id').ilike('email', escapeLike(normalized))
      if (error) throw new Error(error.message)
      const userIds = (profiles ?? []).map((p: { user_id: string }) => p.user_id)
      if (userIds.length === 0) return null
      // Any role (a couple's second member resolves too). Owner first, then a
      // stable order — multiple-email resolution is out of scope for v1.
      const links = await inChunks<{ partnership_id: string; role: string | null }>(userIds, (s) =>
        admin.from('partnership_members').select('partnership_id, role').in('user_id', s)
      )
      links.sort((a, b) => Number(b.role === 'owner') - Number(a.role === 'owner') || a.partnership_id.localeCompare(b.partnership_id))
      return links[0]?.partnership_id ?? null
    },

    async associate(cohortId, memberId) {
      const { error } = await admin
        .from('goose_cohort_members')
        .upsert({ cohort_id: cohortId, member_id: memberId }, { onConflict: 'cohort_id,member_id', ignoreDuplicates: true })
      if (error) throw new Error(error.message)
    },

    async hasCompletedSurvey(memberId) {
      const links = await memberLinks([memberId])
      if (links.length === 0) return false
      const rows = await surveys(links.map((l) => l.user_id))
      return rows.some((s) => (s.completion_pct ?? 0) >= 100 && !!s.answers_json)
    },

    async finalize(cohortId, memberIds, populationHash) {
      const { data, error } = await admin.rpc('goose_finalize_cohort', {
        p_cohort: cohortId,
        p_member_ids: memberIds,
        p_population_hash: populationHash,
      })
      if (error) {
        if (error.message.includes('goose_unknown_members')) throw new GooseFinalizeError('unknown_members', error.message)
        if (error.message.includes('goose_cohort_not_found')) throw new GooseFinalizeError('cohort_not_found', error.message)
        throw new Error(error.message)
      }
      const row = (Array.isArray(data) ? data[0] : data) as { finalization_id: string; expected_pairs: number }
      return row
    },

    async finalizedMemberIds(cohortId) {
      const out: string[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin
          .from('goose_cohort_members')
          .select('member_id')
          .eq('cohort_id', cohortId)
          .eq('finalized', true)
          .order('member_id')
          .range(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        out.push(...(data ?? []).map((r: { member_id: string }) => r.member_id))
        if ((data?.length ?? 0) < PAGE) break
      }
      return out
    },

    async claimLease(cohortId, finalizationId, nowIso, untilIso) {
      const { data, error } = await cohorts()
        .update({ compute_lease_until: untilIso, updated_at: nowIso })
        .eq('id', cohortId)
        .eq('finalization_id', finalizationId)
        .or(`compute_lease_until.is.null,compute_lease_until.lt."${nowIso}"`)
        .select('id')
      if (error) throw new Error(error.message)
      return (data?.length ?? 0) > 0
    },

    async loadScorableMembers(memberIds) {
      const parts = await inChunks<PartnershipInput>(memberIds, (s) =>
        admin.from('partnerships').select('id, profile_type, latitude, longitude').in('id', s)
      )
      const partById = new Map(parts.map((p) => [p.id, p]))
      const links = await memberLinks(memberIds)
      const linksByP = new Map<string, MemberLink[]>()
      for (const l of links) {
        const arr = linksByP.get(l.partnership_id) ?? []
        arr.push({ user_id: l.user_id, role: l.role })
        linksByP.set(l.partnership_id, arr)
      }
      const surveyRows = await surveys(links.map((l) => l.user_id))
      const surveyByUser = new Map<string, SurveyInput>(surveyRows.map((s) => [s.user_id, s]))

      const inputs = new Map<string, ScorableMember | null>()
      const missingPartnerships: string[] = []
      const missingSurvey: string[] = []
      for (const id of memberIds) {
        const p = partById.get(id)
        if (!p) {
          missingPartnerships.push(id)
          inputs.set(id, null)
          continue
        }
        const m = buildScorableMember(p, linksByP.get(id) ?? [], surveyByUser)
        if (!m) missingSurvey.push(id)
        inputs.set(id, m)
      }
      return { inputs, missingPartnerships, missingSurvey }
    },

    async deleteStaleResults(cohortId, finalizationId) {
      const { error } = await admin.from('goose_pair_results').delete().eq('cohort_id', cohortId).neq('finalization_id', finalizationId)
      if (error) throw new Error(error.message)
    },

    async upsertResults(rows) {
      for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
        const { error } = await admin
          .from('goose_pair_results')
          .upsert(rows.slice(i, i + UPSERT_CHUNK).map((r) => ({ ...r, computed_at: new Date().toISOString() })), {
            onConflict: 'cohort_id,member_a,member_b',
          })
        if (error) throw new Error(error.message)
      }
    },

    async coverage(cohortId) {
      const { data, error } = await admin.rpc('goose_cohort_coverage', { p_cohort: cohortId })
      if (error) throw new Error(error.message)
      const row = (Array.isArray(data) ? data[0] : data) as Coverage | undefined
      return row ?? { finalized_members: 0, expected_pairs: 0, completed_pairs: 0 }
    },

    async claimAlert(cohortId, finalizationId, nowIso) {
      const { data, error } = await cohorts()
        .update({ alerted_at: nowIso })
        .eq('id', cohortId)
        .eq('finalization_id', finalizationId)
        .is('alerted_at', null)
        .select('id')
      if (error) throw new Error(error.message)
      return (data?.length ?? 0) > 0
    },

    async releaseAlert(cohortId, finalizationId) {
      await cohorts().update({ alerted_at: null }).eq('id', cohortId).eq('finalization_id', finalizationId)
    },

    async claimExhaustedAlert(cohortId, finalizationId, nowIso) {
      const { data, error } = await cohorts()
        .update({ exhausted_alerted_at: nowIso })
        .eq('id', cohortId)
        .eq('finalization_id', finalizationId)
        .is('exhausted_alerted_at', null)
        .select('id')
      if (error) throw new Error(error.message)
      return (data?.length ?? 0) > 0
    },

    async listResults(cohortId) {
      const cohort = await repo.getCohort(cohortId)
      if (!cohort?.finalization_id) return []
      const finalized = new Set(await repo.finalizedMemberIds(cohortId))
      const out: SerializableRow[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin
          .from('goose_pair_results')
          // Named columns only — never '*'. gated/band/engine_version stay home.
          .select('member_a, member_b, score')
          .eq('cohort_id', cohortId)
          .eq('finalization_id', cohort.finalization_id)
          .order('member_a')
          .order('member_b')
          .range(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        for (const r of (data ?? []) as SerializableRow[]) {
          if (finalized.has(r.member_a) && finalized.has(r.member_b)) out.push(r)
        }
        if ((data?.length ?? 0) < PAGE) break
      }
      return out
    },

    async primaryPhotos(memberIds) {
      const rows = await inChunks<PhotoRow>(memberIds, (s) =>
        admin
          .from('partnership_photos')
          .select('partnership_id, photo_url, photo_type, is_primary, nsfw_flag, created_at')
          .in('partnership_id', s)
          .eq('photo_type', 'public')
      )
      return pickPrimaryPhotos(rows)
    },

    async listActiveCohorts() {
      const { data, error } = await cohorts().select('*').in('status', ['processing', 'error']).not('finalization_id', 'is', null)
      if (error) throw new Error(error.message)
      return (data ?? []) as CohortRow[]
    },

    async logEvent(eventType, metadata) {
      try {
        await admin.from('system_events').insert({ event_type: eventType, triggered_by: 'goose', metadata })
      } catch (e) {
        console.error(`[goose] system_events ${eventType} insert failed:`, e)
      }
    },
  }
  return repo
}
