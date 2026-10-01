'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { lookupZip, type ZipPlace } from '@/lib/location/zip'
import { resolveSignupLocation, type SignupLocationResult } from '@/lib/location/signupLocation'

/** Display-only preview for signup step 3. `null` means "ask for the city". */
export async function previewSignupZip(zip: string): Promise<ZipPlace | null> {
  return lookupZip(zip)
}

/**
 * Persist signup step 3. Writes the same location state the marketing ingest
 * does: profiles.city + msa_status 'live'. ZIP and state ride on the auth user's
 * metadata until onboarding creates the partnership (save-identity reads them).
 * If a partnership already exists (member came back to this step), it is
 * updated in place.
 */
export async function saveSignupLocation(input: {
  zip: string
  typedCity?: string | null
}): Promise<SignupLocationResult | { ok: false; reason: 'not_authenticated' | 'save_failed' }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'not_authenticated' }

  const resolved = resolveSignupLocation(input, await lookupZip(input.zip))
  if (!resolved.ok) return resolved

  // Writes are keyed to the authenticated user's own id only.
  const admin = createAdminClient()
  const { error: profileErr } = await admin
    .from('profiles')
    .update({ city: resolved.city, msa_status: resolved.msaStatus })
    .eq('user_id', user.id)
  if (profileErr) {
    console.error('[signupLocation] profile update failed:', profileErr.message)
    return { ok: false, reason: 'save_failed' }
  }

  const { error: metaErr } = await supabase.auth.updateUser({
    data: { signup_zip: resolved.zip, signup_state: resolved.state },
  })
  if (metaErr) console.warn('[signupLocation] metadata update failed (non-fatal):', metaErr.message)

  const { data: owned } = await admin
    .from('partnerships')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (owned) {
    await admin
      .from('partnerships')
      .update({ city: resolved.city, zip_code: resolved.zip, ...(resolved.state ? { state: resolved.state } : {}) })
      .eq('id', (owned as { id: string }).id)
  }

  return resolved
}
