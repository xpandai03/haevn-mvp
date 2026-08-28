/**
 * Promo funnel events -> system_events.
 *
 * The client's two numbers are CTA clicks and activations, so these are emitted
 * SERVER-SIDE only: a browser-side beacon would be lost to ad blockers and could
 * not be trusted for a number the client reports on.
 *
 * system_events columns: id, event_type, triggered_by, partnership_id, metadata,
 * created_at. partnership_id is a first-class column — use it, and keep member
 * identity (email, name, city) OUT of metadata.
 *
 * Never throws. A analytics failure must not break a member's upgrade path.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { PROMO_EVENTS } from './constants'

type Meta = Record<string, string | number | boolean | null>

async function emit(eventType: string, partnershipId: string | null, metadata: Meta): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('system_events').insert({
      event_type: eventType,
      triggered_by: 'member',
      partnership_id: partnershipId,
      metadata,
    })
    if (error) console.warn('[promo-events] insert failed:', error.message)
  } catch (e) {
    console.warn('[promo-events] emit threw:', (e as Error)?.message)
  }
}

/** Every arrival at /onboarding/membership with upgrade intent — eligible or not. */
export function emitCtaClicked(
  partnershipId: string | null,
  meta: { src: string; path: string; tier: string; market: string | null; eligible: boolean; reason: string | null }
): Promise<void> {
  return emit(PROMO_EVENTS.ctaClicked, partnershipId, { ...meta })
}

/** The offer rendered for an eligible member. */
export function emitOfferViewed(
  partnershipId: string | null,
  meta: { src: string; market: string; term_months: number }
): Promise<void> {
  return emit(PROMO_EVENTS.offerViewed, partnershipId, { ...meta })
}

/** An activation that actually changed the row. Emitted once, never on a replay. */
export function emitActivationCompleted(
  partnershipId: string,
  meta: { src: string; market: string; term_months: number; expires_at: string }
): Promise<void> {
  return emit(PROMO_EVENTS.activationCompleted, partnershipId, { ...meta })
}
