'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectBestPartnership } from '@/lib/partnership/selectPartnership'

export type CheckinResponse = 'clicked' | 'okay' | 'no_match'

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

/** Match partnership ids the viewer has already submitted a check-in for. */
export async function getCheckedInMatchIds(): Promise<string[]> {
  let viewerPartnershipId: string
  try {
    viewerPartnershipId = await getViewerPartnershipId()
  } catch {
    return []
  }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('match_checkins')
    .select('match_partnership_id')
    .eq('partnership_id', viewerPartnershipId)
  if (error) {
    console.warn('[checkins] getCheckedInMatchIds skipped:', error.message)
    return []
  }
  return (data || []).map((r) => r.match_partnership_id)
}

/** Record a post-date check-in. Idempotent per (viewer, match). */
export async function submitCheckin(
  matchPartnershipId: string,
  response: CheckinResponse
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!matchPartnershipId) return { success: false, error: 'Missing id' }
    if (!['clicked', 'okay', 'no_match'].includes(response)) {
      return { success: false, error: 'Invalid response' }
    }
    const viewerPartnershipId = await getViewerPartnershipId()
    const admin = createAdminClient()
    const { error } = await admin.from('match_checkins').upsert(
      {
        partnership_id: viewerPartnershipId,
        match_partnership_id: matchPartnershipId,
        response,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'partnership_id,match_partnership_id' }
    )
    if (error) {
      console.error('[checkins] submit error:', error)
      return { success: false, error: 'Could not save check-in' }
    }
    return { success: true }
  } catch (e: any) {
    console.error('[checkins] submit threw:', e)
    return { success: false, error: e.message || 'Server error' }
  }
}
