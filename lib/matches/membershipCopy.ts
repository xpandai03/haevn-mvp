/**
 * Membership copy — one source of truth for the paywall CTA and the lines around it.
 *
 * Client copy rule (2026-08-25 review): every member-facing string that framed the
 * paywall as revealing/unlocking a match now reads as MEMBERSHIP language. The old
 * "Reveal my match" / "Unlock to Connect" / "See who your 87% match is" framing sold
 * a peek; "Become a HAEVN+ member" sells the membership.
 *
 * Scope note: this covers the paywall only. Copy that describes what a mutual
 * CONNECTION or VERIFICATION unlocks (handshake modals, photo grid, verification)
 * is deliberately left alone — it is not the paywall and membership language would
 * be wrong there.
 */

/** The paywall CTA. Every button that leads to /onboarding/membership uses this. */
export const BECOME_MEMBER_CTA = 'Become a HAEVN+ member'

/** Shorter form for tight surfaces (image overlays, nav sublabels). */
export const BECOME_MEMBER_SHORT = 'HAEVN+ members only'

/** Supporting line under the gate on the alignment breakdown. */
export const BREAKDOWN_GATE_SUPPORT =
  'HAEVN+ members see their match’s photos and full profile, and can decide whether to connect.'

/** Supporting line on a locked identity panel. */
export const LOCKED_IDENTITY_SUPPORT = 'HAEVN+ members see photos and full profiles.'
