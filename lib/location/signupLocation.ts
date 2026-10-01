/**
 * In-app signup location: ZIP (+ optional typed city) → what gets stored.
 *
 * NO GATE. Every US ZIP completes signup. The result is the same location state
 * the marketing-survey ingest produces: `profiles.city` + `msa_status: 'live'`,
 * and city/state/ZIP for the partnership that onboarding creates next.
 *
 * The only non-success outcomes are a malformed ZIP (the member fixes a typo) and
 * an unresolvable ZIP with no typed city (the member types their city). Neither
 * one is a location decision.
 */

import { normalizeZip, tidyCity, type ZipPlace } from './zip'

export type SignupLocationResult =
  | { ok: true; zip: string; city: string; state: string | null; msaStatus: 'live' }
  | { ok: false; reason: 'invalid_zip' | 'city_required' }

const MAX_CITY_LENGTH = 80

export function resolveSignupLocation(
  input: { zip: string; typedCity?: string | null },
  place: ZipPlace | null
): SignupLocationResult {
  const zip = normalizeZip(input.zip)
  if (!zip) return { ok: false, reason: 'invalid_zip' }

  if (place && place.zip === zip) {
    return { ok: true, zip, city: place.city, state: place.state, msaStatus: 'live' }
  }

  // Lookup missed (unknown ZIP or provider down): fall back to what the member typed.
  const typed = tidyCity(String(input.typedCity ?? '').slice(0, MAX_CITY_LENGTH))
  if (!/[a-z]/i.test(typed)) return { ok: false, reason: 'city_required' }
  return { ok: true, zip, city: typed, state: null, msaStatus: 'live' }
}

/**
 * Location fields for the partnership row onboarding creates, read back from
 * the auth user's metadata where step 3 left them. Missing values are omitted
 * rather than defaulted: no member is ever labelled with a city they did not give.
 */
export function partnershipLocationFields(
  meta: Record<string, unknown> | null | undefined
): { zip_code?: string; state?: string } {
  const out: { zip_code?: string; state?: string } = {}
  const zip = normalizeZip(typeof meta?.signup_zip === 'string' ? meta.signup_zip : null)
  if (zip) out.zip_code = zip
  const state = typeof meta?.signup_state === 'string' ? meta.signup_state.trim().toUpperCase() : ''
  if (/^[A-Z]{2}$/.test(state)) out.state = state
  return out
}
