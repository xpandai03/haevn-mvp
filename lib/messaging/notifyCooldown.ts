/**
 * New-message notification cooldown — per recipient, per handshake.
 *
 * THE PROBLEM THIS SOLVES. Every message send notifies the counterpart by SMS
 * *and* email, with no throttle of any kind. A ten-message exchange was twenty
 * texts and twenty emails. Fine for the one conversation that exists today;
 * unacceptable the week connections grow.
 *
 * THE RULE. The first message of a burst notifies. Everything sent by the same
 * person to the same recipient inside the cooldown window rides that first
 * notification — the recipient has already been told to open the thread, and
 * telling them again per message is noise, not service.
 *
 * WHERE THE STATE LIVES: nowhere new. "When was this recipient last notified in
 * this handshake?" is exactly "when did this sender last send them a message in
 * this handshake?", because a notification fires on every send. So the previous
 * message row by the same sender IS the marker, and no column or table is
 * needed. See sendMessageAction for the lookup.
 *
 * The one inaccuracy this inherits, stated plainly: if a notification FAILED to
 * deliver, the message row still exists, so we treat the recipient as notified
 * and stay quiet for the rest of the window. A dedicated column would be exact.
 * Messages are the primary surface and the notification is a nudge, so the trade
 * is deliberate — but it is the reason to add a column if that ever stops being
 * true.
 */

/** Client's default. Overridable per environment, never hardcoded at a call site. */
export const DEFAULT_MESSAGE_NOTIFY_COOLDOWN_MINUTES = 30

/**
 * Cooldown in minutes. A missing or unparseable value falls back to the default;
 * an explicit 0 is honoured as "no cooldown, notify every message", which is the
 * old behaviour and a legitimate thing to want back in a hurry.
 */
export function messageNotifyCooldownMinutes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.MESSAGE_NOTIFY_COOLDOWN_MINUTES
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return DEFAULT_MESSAGE_NOTIFY_COOLDOWN_MINUTES
  }
  const n = Number.parseInt(String(raw), 10)
  // Negative is nonsense and must never mean "never notify again".
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MESSAGE_NOTIFY_COOLDOWN_MINUTES
  return n
}

/**
 * Should we notify the recipient about this send?
 *
 * @param lastNotifiedAt when this sender last messaged this recipient in this
 *        handshake — i.e. when the recipient was last notified. Null/absent
 *        means this is the first message of the thread from them: always notify.
 * @param now            send time.
 * @param cooldownMinutes 0 disables the cooldown entirely.
 *
 * FAILS OPEN. An unparseable timestamp notifies rather than going silent: a
 * duplicate notification is a nuisance, a swallowed one loses the member.
 */
export function shouldNotifyRecipient(
  lastNotifiedAt: string | null | undefined,
  now: Date,
  cooldownMinutes: number
): boolean {
  if (cooldownMinutes <= 0) return true
  if (!lastNotifiedAt) return true
  const last = Date.parse(lastNotifiedAt)
  if (Number.isNaN(last)) return true
  const elapsedMs = now.getTime() - last
  // A clock skew that puts the previous message in the future must not mute us.
  if (elapsedMs < 0) return true
  return elapsedMs >= cooldownMinutes * 60_000
}
