import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Read-time check: has a partnership's paid membership lapsed?
 *
 * DEFENSIVE BY DESIGN. `membership_expires_at` is a newer column (migration
 * 040). It is queried in ISOLATION here — never embedded in the shared
 * `selectBestPartnership` select — so that if the column is not yet present
 * in an environment, only this one query degrades (returns "not expired")
 * instead of breaking every partnership lookup. We fail OPEN: any error,
 * missing column, or missing row is treated as NOT expired so a paying user
 * can never be locked out by an infrastructure gap. Real downgrade only
 * happens when the column exists and holds a past timestamp.
 */
export async function isMembershipExpired(
  supabase: SupabaseClient,
  partnershipId: string | null | undefined
): Promise<boolean> {
  if (!partnershipId) return false
  try {
    const { data, error } = await supabase
      .from('partnerships')
      .select('membership_expires_at')
      .eq('id', partnershipId)
      .maybeSingle()

    if (error || !data) return false
    const expiresAt = (data as { membership_expires_at?: string | null })
      .membership_expires_at
    if (!expiresAt) return false
    return new Date(expiresAt).getTime() < Date.now()
  } catch {
    return false
  }
}
