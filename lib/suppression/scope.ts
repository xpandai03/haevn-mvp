/**
 * Email suppression scope logic — pure, exhaustively tested.
 *
 * scope (stored on a suppression row): what the suppression blocks.
 * sendScope (tagged on an outgoing email): how sensitive the send is.
 *
 * Hard rule encoded here: a 'critical' send is NEVER blocked (magic-link
 * sign-in, first-match notification). Nothing in the app can suppress it.
 */

export type SuppressionReason = 'hard_bounce' | 'complaint' | 'unsubscribe'
export type SuppressionScope = 'renotify' | 'all_noncritical'
export type SendScope = 'renotify' | 'all_noncritical' | 'critical'

/** Which suppression scope a webhook/unsub reason produces. */
export function scopeForReason(reason: SuppressionReason): SuppressionScope {
  // A spam complaint is the strong signal → blocks all non-critical mail.
  // A hard bounce or an unsubscribe only blocks the recurring re-notify.
  return reason === 'complaint' ? 'all_noncritical' : 'renotify'
}

/** Escalate to the stronger scope. all_noncritical > renotify. Never de-escalates. */
export function escalateScope(a: SuppressionScope, b: SuppressionScope): SuppressionScope {
  return a === 'all_noncritical' || b === 'all_noncritical' ? 'all_noncritical' : 'renotify'
}

/**
 * Does a suppression row of `rowScope` block a send tagged `sendScope`?
 *  - critical send        → never blocked (hard rule)
 *  - renotify send        → blocked by ANY suppression (renotify OR all_noncritical)
 *  - all_noncritical send → blocked ONLY by a complaint (all_noncritical)
 */
export function scopeBlocks(rowScope: SuppressionScope, sendScope: SendScope): boolean {
  if (sendScope === 'critical') return false
  if (sendScope === 'renotify') return true // any row scope covers a renotify send
  // sendScope === 'all_noncritical'
  return rowScope === 'all_noncritical'
}

/**
 * Notification type → send scope. connection_interest is a nudge; match and
 * message are core; no_match is a recurring broadcast.
 *
 * WHY no_match IS 'renotify' AND NOT 'all_noncritical'
 * ---------------------------------------------------
 * Read scopeBlocks above: an 'all_noncritical' SEND is blocked only by a
 * COMPLAINT. A plain unsubscribe records scope 'renotify' (scopeForReason), and
 * a 'renotify' row does NOT block an 'all_noncritical' send.
 *
 * The no-match ping carries an unsubscribe link. Tagged 'all_noncritical', that
 * link would record a suppression that does not stop the very mail it was
 * attached to — the member unsubscribes, keeps receiving pings, and complains.
 * That converts an opt-out into a spam complaint against the shared sending
 * domain, which also carries the critical match mail and the sign-in handoffs.
 *
 * 'renotify' is the send scope whose meaning is "recurring reminder — block it
 * on ANY suppression signal", which is exactly what this is. It costs nothing:
 * match and message stay 'critical' and are never blocked, so a member who opts
 * out of the Monday ping still hears from us the week they actually match.
 */
export function sendScopeForNotificationType(
  type: 'match' | 'message' | 'connection_interest' | 'no_match'
): SendScope {
  if (type === 'no_match') return 'renotify'
  return type === 'connection_interest' ? 'all_noncritical' : 'critical'
}
