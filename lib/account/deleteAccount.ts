/**
 * Member-initiated account deletion pipeline.
 *
 *   1. Build the anonymized survey copy (lib/account/anonymizeSurvey.ts).
 *   2. Remove the member's files through the Storage API — photos under
 *      <partnershipId>/ in every photo bucket, chat images under
 *      <handshakeId>/ in chat-media. Supabase forbids deleting storage.objects
 *      from SQL, so this can't sit inside the DB transaction. It runs FIRST so
 *      a storage failure aborts before anything else changes (retry is safe);
 *      the reverse order would leave orphaned photos nobody could find.
 *   3. delete_member_account() (migration 059): in ONE transaction, insert the
 *      anonymized copy, then delete every PII row and the auth user.
 *
 * The store is injected so the whole sequence runs against fixtures in tests.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { anonymizeSurveyAnswers, ANON_SCHEMA_VERSION } from './anonymizeSurvey'

export const PHOTO_BUCKETS = ['public-photos', 'private-photos', 'partnership-photos'] as const
export const CHAT_BUCKET = 'chat-media'

export interface SurveyRow {
  answers_json: unknown
  completion_pct: number | null
  updated_at: string
}

export interface AnonymizedPayload {
  answers: Record<string, unknown>
  completion_pct: number | null
  schema_version: number
}

export type DeletionOutcome =
  | { status: 'deleted'; filesRemoved: number; surveyRetained: boolean }
  | { status: 'already_deleted' }
  | { status: 'shared_partnership' }

export interface DeletionStore {
  userExists(userId: string): Promise<boolean>
  readSurvey(userId: string): Promise<SurveyRow | null>
  partnershipIds(userId: string): Promise<string[]>
  hasOtherMembers(partnershipIds: string[], userId: string): Promise<boolean>
  handshakeIds(partnershipIds: string[]): Promise<string[]>
  listFiles(bucket: string, prefix: string): Promise<string[]>
  removeFiles(bucket: string, paths: string[]): Promise<void>
  /** The migration-059 RPC. Resolves with its status; rejects with the
   *  Postgres message ('survey_changed', 'shared_partnership', …). */
  runDeletion(
    userId: string,
    anonymized: AnonymizedPayload | null,
    surveyUpdatedAt: string | null
  ): Promise<{ status: 'deleted' | 'already_deleted' }>
}

export function buildAnonymizedPayload(row: SurveyRow, now: Date): AnonymizedPayload {
  return {
    answers: anonymizeSurveyAnswers(row.answers_json, now).answers,
    completion_pct: row.completion_pct ?? null,
    schema_version: ANON_SCHEMA_VERSION,
  }
}

async function removeStorage(store: DeletionStore, partnershipIds: string[], handshakeIds: string[]): Promise<number> {
  const targets: Array<[string, string]> = [
    ...partnershipIds.flatMap((p) => PHOTO_BUCKETS.map((b) => [b, p] as [string, string])),
    ...handshakeIds.map((h) => [CHAT_BUCKET, h] as [string, string]),
  ]
  let removed = 0
  for (const [bucket, prefix] of targets) {
    const paths = await store.listFiles(bucket, prefix)
    if (paths.length === 0) continue
    await store.removeFiles(bucket, paths)
    removed += paths.length
  }
  return removed
}

const MAX_SURVEY_RACE_RETRIES = 2

export async function deleteMemberAccount(
  store: DeletionStore,
  userId: string,
  now: Date = new Date()
): Promise<DeletionOutcome> {
  if (!(await store.userExists(userId))) return { status: 'already_deleted' }

  const partnershipIds = await store.partnershipIds(userId)
  if (await store.hasOtherMembers(partnershipIds, userId)) return { status: 'shared_partnership' }

  const handshakeIds = await store.handshakeIds(partnershipIds)
  const filesRemoved = await removeStorage(store, partnershipIds, handshakeIds)

  for (let attempt = 0; ; attempt++) {
    const survey = await store.readSurvey(userId)
    const payload = survey ? buildAnonymizedPayload(survey, now) : null
    try {
      const res = await store.runDeletion(userId, payload, survey?.updated_at ?? null)
      if (res.status === 'already_deleted') return { status: 'already_deleted' }
      return { status: 'deleted', filesRemoved, surveyRetained: survey !== null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('shared_partnership')) return { status: 'shared_partnership' }
      // The survey row changed between our read and the transaction (e.g. an
      // autosave from another tab). Rebuild the copy from the new row.
      if (msg.includes('survey_changed') && attempt < MAX_SURVEY_RACE_RETRIES) continue
      throw err
    }
  }
}

// ── Supabase-backed store ────────────────────────────────────────────────────

export function supabaseDeletionStore(admin: SupabaseClient): DeletionStore {
  return {
    async userExists(userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId)
      if (error && !/not.?found/i.test(error.message)) throw new Error(`getUserById: ${error.message}`)
      return !!data?.user
    },

    async readSurvey(userId) {
      const { data, error } = await admin
        .from('user_survey_responses')
        .select('answers_json, completion_pct, updated_at')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw new Error(`readSurvey: ${error.message}`)
      return (data as SurveyRow | null) ?? null
    },

    async partnershipIds(userId) {
      const [members, owned] = await Promise.all([
        admin.from('partnership_members').select('partnership_id').eq('user_id', userId),
        admin.from('partnerships').select('id').eq('owner_id', userId),
      ])
      if (members.error) throw new Error(`partnershipIds: ${members.error.message}`)
      if (owned.error) throw new Error(`partnershipIds: ${owned.error.message}`)
      const ids = [
        ...(members.data ?? []).map((r: { partnership_id: string }) => r.partnership_id),
        ...(owned.data ?? []).map((r: { id: string }) => r.id),
      ]
      return Array.from(new Set(ids))
    },

    async hasOtherMembers(partnershipIds, userId) {
      if (partnershipIds.length === 0) return false
      const { count, error } = await admin
        .from('partnership_members')
        .select('*', { count: 'exact', head: true })
        .in('partnership_id', partnershipIds)
        .neq('user_id', userId)
      if (error) throw new Error(`hasOtherMembers: ${error.message}`)
      return (count ?? 0) > 0
    },

    async handshakeIds(partnershipIds) {
      if (partnershipIds.length === 0) return []
      const list = partnershipIds.join(',')
      const { data, error } = await admin
        .from('handshakes')
        .select('id')
        .or(`a_partnership.in.(${list}),b_partnership.in.(${list})`)
      if (error) throw new Error(`handshakeIds: ${error.message}`)
      return (data ?? []).map((r: { id: string }) => r.id)
    },

    async listFiles(bucket, prefix) {
      const out: string[] = []
      const walk = async (dir: string, depth: number): Promise<void> => {
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await admin.storage.from(bucket).list(dir, { limit: 1000, offset })
          if (error) {
            if (/not.?found/i.test(error.message)) return
            throw new Error(`list ${bucket}/${dir}: ${error.message}`)
          }
          for (const item of data ?? []) {
            const path = `${dir}/${item.name}`
            // Folders come back with a null id.
            if (item.id === null) {
              if (depth < 3) await walk(path, depth + 1)
            } else out.push(path)
          }
          if (!data || data.length < 1000) return
        }
      }
      await walk(prefix, 0)
      return out
    },

    async removeFiles(bucket, paths) {
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100))
        if (error) throw new Error(`remove ${bucket}: ${error.message}`)
      }
    },

    async runDeletion(userId, anonymized, surveyUpdatedAt) {
      const { data, error } = await admin.rpc('delete_member_account', {
        p_user_id: userId,
        p_anonymized: anonymized,
        p_survey_updated_at: surveyUpdatedAt,
      })
      if (error) throw new Error(error.message)
      const status = (data as { status?: string } | null)?.status
      if (status !== 'deleted' && status !== 'already_deleted') {
        throw new Error(`delete_member_account returned unexpected status: ${String(status)}`)
      }
      return { status }
    },
  }
}

// ── Session-bound entry point (wrapped by the server action) ─────────────────

export type DeleteMyAccountResult =
  | { ok: true }
  | { ok: false; error: 'shared_partnership' | 'failed' }

export interface DeleteMyAccountDeps {
  /** Id of the signed-in member, from the verified session. The ONLY source
   *  of the id to delete — nothing the caller sends is ever used. */
  sessionUserId: () => Promise<string | null>
  store: DeletionStore
  signOut: () => Promise<void>
  now?: Date
}

export async function runDeleteMyAccount(deps: DeleteMyAccountDeps): Promise<DeleteMyAccountResult> {
  const userId = await deps.sessionUserId()
  // No session: already deleted (a retry after success) or never signed in.
  // Either way there is nothing of theirs left to delete here.
  if (!userId) return { ok: true }

  let outcome: DeletionOutcome
  try {
    outcome = await deleteMemberAccount(deps.store, userId, deps.now)
  } catch (err) {
    console.error('[account-delete] failed user=', userId.slice(0, 8), err instanceof Error ? err.message : err)
    return { ok: false, error: 'failed' }
  }
  if (outcome.status === 'shared_partnership') return { ok: false, error: 'shared_partnership' }

  console.log('[account-delete] done user=', userId.slice(0, 8), 'status=', outcome.status)
  try {
    await deps.signOut()
  } catch {
    // The auth user is gone, so the server-side logout call can fail; the
    // cookie clear is what matters and the client hard-navigates anyway.
  }
  return { ok: true }
}
