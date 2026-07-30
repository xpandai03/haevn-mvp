/**
 * Recommendation accept-flow state machine (pure, exhaustively tested).
 *
 * State lives across three existing stores — NOT on computed_matches rows (which
 * are wiped weekly), keying instead on the canonical partnership pair so it
 * survives the Monday recompute:
 *   - proceed  → ready_to_meet_signals  (one row per signaller; mutual = two)
 *   - decline  → hidden_matches         (viewer's live 30-day hide)
 *   - connection → handshakes state='matched'
 *
 * This module contains ONLY pure derivation + guards. Side effects (insert the
 * signal, fire the counterpart notification, create the handshake) live in the
 * API route, which feeds this module the facts it read from the DB.
 */

import { canonicalPartnershipPair } from '@/lib/utils/partnershipPair'

/** Viewer-relative pair state for the accept flow. */
export type PairState =
  | 'none'            // no action; viewer may proceed or decline
  | 'waiting'         // viewer proceeded, counterpart hasn't — NEVER shows "declined" (sender privacy)
  | 'their_turn'      // counterpart proceeded (viewer was notified); viewer may proceed to connect
  | 'declined_by_me'  // viewer declined (their own live hide)
  | 'connected'       // mutual → a handshake exists (reveal gated separately, see canAccessConnection)
  | 'expired'         // pair expired; no actions

export interface PairFacts {
  viewerId: string
  counterpartId: string
  /** partnership ids that have proceeded (signalled ready) on this pair. */
  signallers: ReadonlySet<string>
  /** viewer has a live (non-expired) hidden_matches row hiding the counterpart. */
  viewerHidLive: boolean
  /** a matched handshake exists for the pair. */
  handshakeMatched: boolean
  /** pair is expired (past expires_at) AND not retained in match_history. */
  expired: boolean
}

/**
 * Derive the viewer-relative state. Pure.
 *
 * SENDER PRIVACY (spec-critical): the counterpart's decline is intentionally NOT
 * a field here — the viewer must never learn the other side declined. If the
 * viewer proceeded and the counterpart declined, the viewer stays 'waiting'.
 */
export function derivePairState(f: PairFacts): PairState {
  const vProceeded = f.signallers.has(f.viewerId)
  const cProceeded = f.signallers.has(f.counterpartId)

  // Connected wins: an explicit handshake, or both sides signalled (the route
  // creates the handshake idempotently on the mutual transition).
  if (f.handshakeMatched || (vProceeded && cProceeded)) return 'connected'
  // The viewer's own decline is visible only to the viewer.
  if (f.viewerHidLive) return 'declined_by_me'
  // The viewer proceeded and is waiting — privacy-preserving neutral, even if
  // the pair later expired or the counterpart passed.
  if (vProceeded) return 'waiting'
  // The counterpart proceeded first (this is the notified side).
  if (cProceeded) return 'their_turn'
  if (f.expired) return 'expired'
  return 'none'
}

/** Why a proceed action is refused, or null if allowed (idempotent if already proceeded). */
export type ProceedRejection = 'already_connected' | 'declined_by_me' | 'expired' | null

export function canProceed(f: PairFacts): ProceedRejection {
  if (f.handshakeMatched || (f.signallers.has(f.viewerId) && f.signallers.has(f.counterpartId))) {
    return 'already_connected'
  }
  if (f.viewerHidLive) return 'declined_by_me' // proceed-after-your-own-decline is rejected
  if (f.expired) return 'expired'
  return null // ok — re-proceeding when already 'waiting' is allowed and idempotent
}

/** Why a decline action is refused, or null if allowed. */
export type DeclineRejection = 'already_connected' | 'already_proceeded' | 'expired' | null

export function canDecline(f: PairFacts): DeclineRejection {
  if (f.handshakeMatched || (f.signallers.has(f.viewerId) && f.signallers.has(f.counterpartId))) {
    return 'already_connected' // decline-after-mutual is rejected
  }
  // Proceed is final (v1): a proceeder cannot then decline (that would be
  // un-proceeding, and would leave "both signalled but one hid" — an
  // inconsistent, un-derivable state). This keeps signallers and hiders disjoint
  // per side, so "both signalled" always implies a creatable connection.
  if (f.signallers.has(f.viewerId)) return 'already_proceeded'
  if (f.expired) return 'expired'
  return null
}

/**
 * Given the signaller set AFTER a fresh proceed insert, classify the transition
 * so the route knows which exactly-once side effect to fire. (Retries never
 * reach here — the route detects the duplicate insert and short-circuits.)
 */
export type ProceedOutcome = 'mutual' | 'first_proceed'

export function classifyProceed(
  signallersAfter: ReadonlySet<string>,
  viewerId: string,
  counterpartId: string
): ProceedOutcome {
  return signallersAfter.has(viewerId) && signallersAfter.has(counterpartId)
    ? 'mutual'
    : 'first_proceed'
}

/** The exactly-once side effect a proceed should trigger. Pure — the route feeds
 *  it the band, whether the signal insert was a duplicate (retry), and the
 *  post-insert signaller set. This is the single source of the exactly-once rule:
 *   - matches (band !== 'rec') → never a side effect (match behavior untouched)
 *   - retry (duplicate insert)  → never (idempotent)
 *   - fresh first proceed       → notify the counterpart (once)
 *   - fresh mutual proceed      → create the handshake (once) */
export type ProceedSideEffect = 'notify_counterpart' | 'create_handshake' | 'none'

export function decideProceedSideEffect(params: {
  band: 'rec' | 'match' | null
  isDuplicate: boolean
  signallersAfter: ReadonlySet<string>
  viewerId: string
  counterpartId: string
}): ProceedSideEffect {
  if (params.band !== 'rec') return 'none'
  if (params.isDuplicate) return 'none'
  return classifyProceed(params.signallersAfter, params.viewerId, params.counterpartId) === 'mutual'
    ? 'create_handshake'
    : 'notify_counterpart'
}

/** Re-export the canonical pair helper so callers have one import surface. */
export { canonicalPartnershipPair }
