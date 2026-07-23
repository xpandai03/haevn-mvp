/**
 * Match-history capture — append-only weekly snapshot of computed_matches.
 *
 * Pure + injectable (like lib/admin/impersonation) so the fail-safe behaviour is
 * unit-tested with spies. The recompute pipeline calls captureMatchHistory AFTER
 * the release-override, wrapped so a capture failure NEVER breaks or delays a
 * release — this function itself never throws.
 */

export interface ComputedMatchRow {
  partnership_a: string
  partnership_b: string
  score: number | null
  tier: string | null
  release_at: string | null
  expires_at: string | null
  computed_at: string | null
}

export interface MatchHistoryRow {
  run_date: string
  partnership_a: string
  partnership_b: string
  score: number | null
  tier: string | null
  released_at: string | null
  expires_at: string | null
  computed_at: string | null
}

/** Pure: map the current computed_matches set to history rows for a run_date. */
export function buildHistoryRows(computed: ComputedMatchRow[], runDate: string): MatchHistoryRow[] {
  return computed.map((r) => ({
    run_date: runDate,
    partnership_a: r.partnership_a,
    partnership_b: r.partnership_b,
    score: r.score ?? null,
    tier: r.tier ?? null,
    released_at: r.release_at ?? null,
    expires_at: r.expires_at ?? null,
    computed_at: r.computed_at ?? null,
  }))
}

export interface HistoryDeps {
  fetchComputed: () => Promise<ComputedMatchRow[]>
  /** Append-only, idempotent insert (ON CONFLICT DO NOTHING on run_date+pair). */
  insertHistory: (rows: MatchHistoryRow[]) => Promise<{ error: string | null }>
}

/**
 * Capture the current computed_matches set for `runDate`. NEVER throws — returns
 * `{ captured, error? }`. Idempotent via the caller's conflict-ignoring insert.
 */
export async function captureMatchHistory(
  runDate: string,
  deps: HistoryDeps
): Promise<{ captured: number; error?: string }> {
  try {
    const computed = await deps.fetchComputed()
    if (computed.length === 0) return { captured: 0 }
    const rows = buildHistoryRows(computed, runDate)
    const { error } = await deps.insertHistory(rows)
    if (error) return { captured: 0, error }
    return { captured: rows.length }
  } catch (e: any) {
    return { captured: 0, error: e?.message ?? String(e) }
  }
}

/** Minimal admin-client surface this needs (avoids importing the client factory
 *  so the module stays pure/env-free for tests; callers pass createAdminClient()). */
type AdminLike = { from: (table: string) => any }

/**
 * Wire the real Supabase deps and capture. Still fail-safe (delegates to
 * captureMatchHistory, which never throws). Used by the recompute pipeline + admin route.
 */
export async function captureMatchHistoryToDb(
  admin: AdminLike,
  runDate: string
): Promise<{ captured: number; error?: string }> {
  return captureMatchHistory(runDate, {
    fetchComputed: async () => {
      const out: ComputedMatchRow[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await admin
          .from('computed_matches')
          .select('partnership_a, partnership_b, score, tier, release_at, expires_at, computed_at')
          .range(from, from + 999)
        if (error) throw new Error(error.message)
        if (!data || data.length === 0) break
        out.push(...(data as ComputedMatchRow[]))
        if (data.length < 1000) break
      }
      return out
    },
    insertHistory: async (rows) => {
      const { error } = await admin
        .from('match_history')
        .upsert(rows, { onConflict: 'run_date,partnership_a,partnership_b', ignoreDuplicates: true })
      return { error: error?.message ?? null }
    },
  })
}

