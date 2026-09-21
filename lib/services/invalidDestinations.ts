/**
 * Permanently-invalid notification destinations (migration 058).
 *
 * The 2026-09-21 run burned 28 SMS slots and 1 email slot on destinations that
 * can never succeed — a mistyped phone stays mistyped. Without a record, every
 * Monday re-attempts them, re-spends the send budget, and re-reports them as
 * failures, so a genuinely clean run can never look clean.
 *
 * PER CHANNEL. A member with a bad phone and a good email keeps getting email.
 * The two marks are independent and neither implies the other.
 *
 * MARK, NEVER DELETE. The bad value stays on the row for support to see. This
 * only records that we stopped trying; clearing the timestamp re-enables the
 * channel the moment the member fixes their details.
 *
 * DEGRADES TO TODAY'S BEHAVIOUR. Every read and write here tolerates the columns
 * being absent: a pre-058 database simply skips nobody and marks nobody, exactly
 * as before. That keeps the throttle shippable independently of the migration.
 */

import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export interface InvalidDestinations {
  phone: Set<string>
  email: Set<string>
}

export const EMPTY_INVALID: InvalidDestinations = { phone: new Set(), email: new Set() }

/**
 * Partnership ids whose phone / email the providers have rejected as permanently
 * invalid. One bulk read per run — never per member.
 */
export async function loadInvalidDestinations(admin: Admin): Promise<InvalidDestinations> {
  try {
    const { data, error } = await admin
      .from('partnerships')
      .select('id, notify_phone_invalid_at, notify_email_invalid_at')
      .or('notify_phone_invalid_at.not.is.null,notify_email_invalid_at.not.is.null')
      .limit(10000)
    if (error) {
      // Most likely cause: migration 058 not applied. Skip nobody rather than
      // failing a whole Monday run over an optimisation.
      console.warn('[InvalidDest] read failed, skipping nobody:', error.message)
      return { phone: new Set(), email: new Set() }
    }
    const phone = new Set<string>()
    const email = new Set<string>()
    for (const r of (data ?? []) as any[]) {
      if (r.notify_phone_invalid_at) phone.add(r.id)
      if (r.notify_email_invalid_at) email.add(r.id)
    }
    return { phone, email }
  } catch (e: any) {
    console.warn('[InvalidDest] read threw, skipping nobody:', e?.message)
    return { phone: new Set(), email: new Set() }
  }
}

/**
 * Record that a channel is permanently unusable for this member.
 * Best-effort: a write failure costs one wasted slot next week, never the run.
 */
export async function markDestinationInvalid(
  admin: Admin,
  partnershipId: string,
  channel: 'phone' | 'email',
  at: string = new Date().toISOString()
): Promise<void> {
  if (!partnershipId) return
  const column = channel === 'phone' ? 'notify_phone_invalid_at' : 'notify_email_invalid_at'
  try {
    const { error } = await admin.from('partnerships').update({ [column]: at }).eq('id', partnershipId)
    if (error) console.warn(`[InvalidDest] mark ${channel} failed for ${partnershipId.slice(0, 8)}:`, error.message)
    else console.log(`[InvalidDest] marked ${channel} invalid for ${partnershipId.slice(0, 8)}`)
  } catch (e: any) {
    console.warn(`[InvalidDest] mark ${channel} threw:`, e?.message)
  }
}
