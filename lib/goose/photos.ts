/**
 * Primary-photo selection for Goose results. Pure.
 *
 * Only public, non-NSFW photos are eligible. The member's is_primary photo wins
 * (a unique partial index allows one per partnership); if none is flagged
 * primary, the EARLIEST uploaded eligible photo wins. Prod data at build time:
 * every row is public with a full public-photos URL in photo_url, and every
 * partnership with photos has exactly one primary — so the fallback is
 * defensive. (There is no storage_path column; photo_url is the URL.)
 */

export interface PhotoRow {
  partnership_id: string
  photo_url: string | null
  photo_type?: string | null
  is_primary?: boolean | null
  nsfw_flag?: boolean | null
  created_at?: string | null
}

export function pickPrimaryPhotos(rows: readonly PhotoRow[]): Map<string, string> {
  const best = new Map<string, PhotoRow>()
  const rank = (r: PhotoRow) => (r.is_primary ? 0 : 1)
  for (const r of rows) {
    if (!r.photo_url || (r.photo_type ?? 'public') !== 'public' || r.nsfw_flag) continue
    const cur = best.get(r.partnership_id)
    if (
      !cur ||
      rank(r) < rank(cur) ||
      (rank(r) === rank(cur) && (r.created_at ?? '') < (cur.created_at ?? ''))
    ) {
      best.set(r.partnership_id, r)
    }
  }
  return new Map([...best].map(([pid, r]) => [pid, r.photo_url!]))
}
