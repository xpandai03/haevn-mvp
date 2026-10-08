/**
 * Member photo READ path — the one way surfaces turn a partnership into a URL.
 *
 * partnership_photos.photo_url already holds the full public URL: the upload
 * route and survey ingest write it at upload time. Use it AS-IS.
 *
 * Never select `storage_path` (the column does not exist; the query errors and
 * the error was being swallowed, so every surface fell back to a silhouette),
 * and never rebuild a URL with getPublicUrl against a guessed bucket (files
 * live in `public-photos`; the old readers pointed at `partnership-photos`).
 * lib/photos/__tests__/photoReadPath.test.ts keeps both from creeping back.
 */

/** The minimal query surface used here (admin or user-scoped Supabase client). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PhotoClient = { from: (table: string) => any }

/** A stored photo_url, trimmed, or null when absent/blank. */
export function storedPhotoUrl(row: { photo_url?: string | null } | null | undefined): string | null {
  const url = typeof row?.photo_url === 'string' ? row.photo_url.trim() : ''
  return url ? url : null
}

/** The partnership's primary public photo URL, or null. */
export async function fetchPrimaryPhotoUrl(client: PhotoClient, partnershipId: string): Promise<string | null> {
  const { data } = await client
    .from('partnership_photos')
    .select('photo_url')
    .eq('partnership_id', partnershipId)
    .eq('is_primary', true)
    .eq('photo_type', 'public')
    .maybeSingle()
  return storedPhotoUrl(data as { photo_url?: string | null } | null)
}

/** Primary public photo URLs for many partnerships → Map(partnership_id → URL). */
export async function fetchPrimaryPhotoUrls(client: PhotoClient, partnershipIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (partnershipIds.length === 0) return out
  const { data } = await client
    .from('partnership_photos')
    .select('partnership_id, photo_url')
    .in('partnership_id', partnershipIds as string[])
    .eq('is_primary', true)
    .eq('photo_type', 'public')
  for (const row of (data ?? []) as Array<{ partnership_id: string; photo_url?: string | null }>) {
    const url = storedPhotoUrl(row)
    if (url) out.set(row.partnership_id, url)
  }
  return out
}
