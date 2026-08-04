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

/** Notification type → send scope. connection_interest is a nudge; the rest are core. */
export function sendScopeForNotificationType(
  type: 'match' | 'message' | 'connection_interest'
): SendScope {
  return type === 'connection_interest' ? 'all_noncritical' : 'critical'
}
