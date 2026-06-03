'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectBestPartnership } from '@/lib/partnership/selectPartnership'
import {
  firstNameFromDisplayName,
} from '@/lib/utils/matchCardDisplay'

export interface HiddenMatchCard {
  partnershipId: string
  displayName: string | null
  firstName: string
  age: number
  city: string | null
  distanceMiles?: number
  score: number
  photoUrl?: string
}

/** Resolve the viewer's active partnership id, or throw if unauthenticated. */
async function getViewerPartnershipId(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const selected = await selectBestPartnership(admin, user.id)
  if (!selected) throw new Error('No partnership found for user')
  return selected.partnership_id
}

/**
 * Set of match partnership ids the viewer has hidden and that are still within
 * the 30-day window. Used by getComputedMatchCards to filter the grid.
 */
export async function getHiddenMatchIds(
  viewerPartnershipId: string
): Promise<Set<string>> {
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()
  const { data, error } = await admin
    .from('hidden_matches')
    .select('match_partnership_id, expires_at')
    .eq('partnership_id', viewerPartnershipId)
    .gt('expires_at', nowIso)

  if (error) {
    // Table may not exist until migration 041 is applied — degrade to none.
    console.warn('[hiddenMatches] getHiddenMatchIds skipped:', error.message)
    return new Set()
  }
  return new Set((data || []).map((r) => r.match_partnership_id))
}

/** Hide (pass on) a match. Idempotent; refreshes the 30-day window. */
export async function hideMatch(
  matchPartnershipId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!matchPartnershipId) return { success: false, error: 'Missing id' }
    const viewerPartnershipId = await getViewerPartnershipId()
    if (viewerPartnershipId === matchPartnershipId) {
      return { success: false, error: 'Invalid pair' }
    }

    const admin = createAdminClient()
    const { error } = await admin.from('hidden_matches').upsert(
      {
        partnership_id: viewerPartnershipId,
        match_partnership_id: matchPartnershipId,
        hidden_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
      { onConflict: 'partnership_id,match_partnership_id' }
    )

    if (error) {
      console.error('[hiddenMatches] hide error:', error)
      return { success: false, error: 'Could not hide match' }
    }
    return { success: true }
  } catch (e: any) {
    console.error('[hiddenMatches] hide threw:', e)
    return { success: false, error: e.message || 'Server error' }
  }
}

/** Restore (un-hide) a previously passed match. */
export async function restoreMatch(
  matchPartnershipId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!matchPartnershipId) return { success: false, error: 'Missing id' }
    const viewerPartnershipId = await getViewerPartnershipId()

    const admin = createAdminClient()
    const { error } = await admin
      .from('hidden_matches')
      .delete()
      .eq('partnership_id', viewerPartnershipId)
      .eq('match_partnership_id', matchPartnershipId)

    if (error) {
      console.error('[hiddenMatches] restore error:', error)
      return { success: false, error: 'Could not restore match' }
    }
    return { success: true }
  } catch (e: any) {
    console.error('[hiddenMatches] restore threw:', e)
    return { success: false, error: e.message || 'Server error' }
  }
}

/**
 * Full hidden-match cards for the Hidden page. Only rows within the 30-day
 * window are returned (expired ones reappear in the main grid automatically).
 */
export async function getHiddenMatches(): Promise<HiddenMatchCard[]> {
  let viewerPartnershipId: string
  try {
    viewerPartnershipId = await getViewerPartnershipId()
  } catch {
    return []
  }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const { data: hiddenRows, error } = await admin
    .from('hidden_matches')
    .select('match_partnership_id, hidden_at')
    .eq('partnership_id', viewerPartnershipId)
    .gt('expires_at', nowIso)
    .order('hidden_at', { ascending: false })

  if (error || !hiddenRows || hiddenRows.length === 0) {
    if (error)
      console.warn('[hiddenMatches] getHiddenMatches skipped:', error.message)
    return []
  }

  const ids = hiddenRows.map((r) => r.match_partnership_id)

  // Partner profiles
  const { data: partnerships } = await admin
    .from('partnerships')
    .select('id, display_name, city, age, latitude, longitude')
    .in('id', ids)
  const pMap = new Map((partnerships || []).map((p) => [p.id, p]))

  // Scores from computed_matches (best effort; bidirectional rows)
  const { data: matchRows } = await admin
    .from('computed_matches')
    .select('partnership_a, partnership_b, score')
    .or(
      `partnership_a.eq.${viewerPartnershipId},partnership_b.eq.${viewerPartnershipId}`
    )
  const scoreMap = new Map<string, number>()
  for (const m of matchRows || []) {
    const other =
      m.partnership_a === viewerPartnershipId ? m.partnership_b : m.partnership_a
    if (ids.includes(other)) scoreMap.set(other, m.score)
  }

  // Primary photos
  const supabase = await createClient()
  const { data: photos } = await admin
    .from('partnership_photos')
    .select('partnership_id, storage_path')
    .in('partnership_id', ids)
    .eq('is_primary', true)
    .eq('photo_type', 'public')
  const photoMap = new Map<string, string>()
  for (const photo of photos || []) {
    if (photo.storage_path) {
      const {
        data: { publicUrl },
      } = supabase.storage
        .from('partnership-photos')
        .getPublicUrl(photo.storage_path)
      photoMap.set(photo.partnership_id, publicUrl)
    }
  }

  const cards: HiddenMatchCard[] = []
  for (const row of hiddenRows) {
    const p = pMap.get(row.match_partnership_id)
    if (!p) continue
    cards.push({
      partnershipId: p.id,
      displayName: p.display_name,
      firstName: firstNameFromDisplayName(p.display_name),
      age: typeof p.age === 'number' && p.age > 0 ? p.age : 0,
      city: p.city || null,
      score: Math.round(scoreMap.get(p.id) ?? 0),
      photoUrl: photoMap.get(p.id),
    })
  }
  return cards
}
