/**
 * The SINGLE reveal/messaging gate for a mutual connection.
 *
 * Tier-tolerant by design: any non-'free' tier grants access (pro/plus/select —
 * the live DB currently stores 'pro'; see docs/investigations/lemonsqueezy-payments.md).
 * When the payment fix standardizes the tier string, THIS is the one place that
 * changes — every reveal/messaging call routes through here.
 *
 * A free viewer in a mutual connection sees the 'connected_unrevealed' state
 * (connected, but names/photos/messaging withheld until they activate HAEVN+).
 * Gating is per-viewer: paid A + free B → A sees B revealed, B sees unrevealed.
 */

export interface GatePartnership {
  membership_tier?: string | null
  membership_expires_at?: string | null
}

export function canAccessConnection(
  p: GatePartnership | null | undefined,
  now: Date = new Date()
): boolean {
  if (!p) return false
  const tier = (p.membership_tier || 'free').toLowerCase()
  if (tier === 'free') return false

  // Read-time expiry: a paid tier past its expiry behaves as free. Fail-open on
  // an unparseable/missing date so a real paid member is never locked out.
  const exp = p.membership_expires_at
  if (exp) {
    const t = Date.parse(exp)
    if (!Number.isNaN(t) && t <= now.getTime()) return false
  }
  return true
}
