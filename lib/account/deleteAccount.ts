/**
 * Member-initiated account deletion pipeline.
 *
 *   1. Read-only prep: partnerships, handshakes, and the exact storage paths
 *      to remove (photos under <partnershipId>/ in every photo bucket, chat
 *      images under <handshakeId>/ in chat-media), plus the anonymized survey
 *      copy (lib/account/anonymizeSurvey.ts).
 *   2. delete_member_account() (migrations 059/060): in ONE transaction, insert
 *      the anonymized copy, then delete every PII row and the auth user.
 *   3. Only after that commits: remove the storage files through the Storage
 *      API (Supabase forbids deleting storage.objects from SQL, so this can't
 *      sit inside the transaction), with retries.
 *
 * FAIL-CLOSED. Any error before the transaction commits deletes NOTHING — not
 * even a photo file. (The first release removed files before the transaction;
 * when the transaction then failed, the member kept their account but lost
 * their photo files. Found in QA on 2026-09-22.) If storage cleanup fails after
 * the commit, the account is already gone; the leftover files sit under a
 * prefix whose partnership no longer exists, which
 * scripts/sweep-orphan-storage.ts finds and removes.
 *
 * Errors carry the stage they happened in (DeletionStageError) so the server
 * log names the failing step and the Postgres code in one line.
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

export class DeletionStageError extends Error {
  constructor(public readonly stage: string, cause: unknown) {
    super(`stage=${stage} ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = 'DeletionStageError'
  }
}

async function stage<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof DeletionStageError) throw err
    throw new DeletionStageError(name, err)
  }
}

type StorageTarget = { bucket: string; paths: string[] }

async function listStorage(store: DeletionStore, partnershipIds: string[], handshakeIds: string[]): Promise<StorageTarget[]> {
  const prefixes: Array<[string, string]> = [
    ...partnershipIds.flatMap((p) => PHOTO_BUCKETS.map((b) => [b, p] as [string, string])),
    ...handshakeIds.map((h) => [CHAT_BUCKET, h] as [string, string]),
  ]
  const out: StorageTarget[] = []
  for (const [bucket, prefix] of prefixes) {
    const paths = await store.listFiles(bucket, prefix)
    if (paths.length > 0) out.push({ bucket, paths })
  }
  return out
}

const STORAGE_ATTEMPTS = 3

/** Post-commit cleanup. Never throws: the account is already deleted, so a
 *  storage hiccup must not turn a completed deletion into an error screen.
 *  Returns how many files could not be removed (logged; swept later). */
async function removeStorage(store: DeletionStore, targets: StorageTarget[]): Promise<{ removed: number; failed: number }> {
  let removed = 0
  let failed = 0
  for (const { bucket, paths } of targets) {
    let lastErr: unknown = null
    for (let attempt = 1; attempt <= STORAGE_ATTEMPTS; attempt++) {
      try {
        await store.removeFiles(bucket, paths)
        lastErr = null
        break
      } catch (err) {
        lastErr = err
      }
    }
    if (lastErr) {
      failed += paths.length
      console.error('[account-delete] storage cleanup incomplete bucket=', bucket, 'files=', paths.length,
        lastErr instanceof Error ? lastErr.message : lastErr)
    } else removed += paths.length
  }
  return { removed, failed }
}

const MAX_SURVEY_RACE_RETRIES = 2

export async function deleteMemberAccount(
  store: DeletionStore,
  userId: string,
  now: Date = new Date()
): Promise<DeletionOutcome> {
  if (!(await stage('lookup', () => store.userExists(userId)))) return { status: 'already_deleted' }

  const partnershipIds = await stage('lookup', () => store.partnershipIds(userId))
  if (await stage('lookup', () => store.hasOtherMembers(partnershipIds, userId))) return { status: 'shared_partnership' }

  const handshakeIds = await stage('lookup', () => store.handshakeIds(partnershipIds))
  // Read-only: which files will need removing once the account is gone.
  const storageTargets = await stage('storage_list', () => listStorage(store, partnershipIds, handshakeIds))

  for (let attempt = 0; ; attempt++) {
    const survey = await stage('read_survey', () => store.readSurvey(userId))
    const payload = survey ? buildAnonymizedPayload(survey, now) : null
    try {
      const res = await store.runDeletion(userId, payload, survey?.updated_at ?? null)
      if (res.status === 'already_deleted') return { status: 'already_deleted' }
      const { removed } = await removeStorage(store, storageTargets)
      return { status: 'deleted', filesRemoved: removed, surveyRetained: survey !== null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('shared_partnership')) return { status: 'shared_partnership' }
      // The survey row changed between our read and the transaction (e.g. an
      // autosave from another tab). Rebuild the copy from the new row.
      if (msg.includes('survey_changed') && attempt < MAX_SURVEY_RACE_RETRIES) continue
      throw new DeletionStageError('transaction', err)
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
      if (error) {
        // Keep the Postgres code/details: "42P01 relation … does not exist" is
        // diagnosable from the log line alone; "Something went wrong" is not.
        const e = error as { message: string; code?: string; details?: string; hint?: string }
        throw new Error([e.message, e.code && `code=${e.code}`, e.details && `details=${e.details}`, e.hint && `hint=${e.hint}`]
          .filter(Boolean).join(' '))
      }
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
    // One line, one query: `vercel logs --query "account-delete] failed"`.
    // stage=… says which step; the rest is the underlying error verbatim.
    console.error('[account-delete] failed user=', userId.slice(0, 8), err instanceof Error ? err.message : String(err))
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
