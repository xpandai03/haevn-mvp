/**
 * Messaging pre-flight: the server-side tier gate, the notification cooldown,
 * and the display_name swap.
 *
 * Run: npx tsx lib/messaging/__tests__/messagingGate.test.ts
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  shouldNotifyRecipient, messageNotifyCooldownMinutes,
  DEFAULT_MESSAGE_NOTIFY_COOLDOWN_MINUTES,
} from '../notifyCooldown'
import { UPGRADE_REQUIRED_ERROR } from '../../actions/connections'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

const root = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const conns = code('lib/actions/connections.ts')
const notifs = code('lib/services/notifications.ts')
const chatSvc = code('lib/services/chat.ts')
/** Just the send action, so ordering assertions cannot match another function. */
const action = conns.slice(
  conns.indexOf('export async function sendMessageAction'),
  conns.indexOf('export async function', conns.indexOf('export async function sendMessageAction') + 10)
)

const MIN = 60_000
const T0 = new Date('2026-09-10T12:00:00.000Z')
const at = (mins: number) => new Date(T0.getTime() + mins * MIN)

const withEnv = (v: string | undefined, fn: () => void) => {
  const saved = process.env.MESSAGE_NOTIFY_COOLDOWN_MINUTES
  if (v === undefined) delete process.env.MESSAGE_NOTIFY_COOLDOWN_MINUTES
  else process.env.MESSAGE_NOTIFY_COOLDOWN_MINUTES = v
  try { fn() } finally {
    if (saved === undefined) delete process.env.MESSAGE_NOTIFY_COOLDOWN_MINUTES
    else process.env.MESSAGE_NOTIFY_COOLDOWN_MINUTES = saved
  }
}

function main() {
  // ══ 1. TIER GATE — server-side, before the handshake checks ══════════════
  ok(/getUserMembershipTier\(\)\) !== 'plus'/.test(action),
    'the send action checks membership tier server-side')
  ok(new RegExp(`return \\{ error: UPGRADE_REQUIRED_ERROR \\}`).test(action),
    'a free member gets the upgrade-required error, not a silent failure')
  eq(UPGRADE_REQUIRED_ERROR, 'Upgrade to HAEVN+ to send messages',
    'the refusal message is the same thing the UI upgrade prompt says')
  ok(UPGRADE_REQUIRED_ERROR.length > 0, 'the refusal is never an empty string')

  // Ordering: tier BEFORE any handshake work, as specified.
  const tierIdx = action.indexOf("!== 'plus'")
  const handshakeIdx = action.indexOf(".from('handshakes')")
  const insertIdx = action.indexOf(".from('messages')")
  ok(tierIdx > -1 && handshakeIdx > -1 && tierIdx < handshakeIdx,
    'the tier gate runs BEFORE the handshake lookup')
  ok(tierIdx < insertIdx, '...and long before any row is inserted')
  const killIdx = action.indexOf('isMessagingEnabled()')
  ok(killIdx > -1 && killIdx < tierIdx,
    'the messaging kill switch is still checked first, independent of tier')

  // It must use the SHARED resolver, so the action and the UI cannot disagree.
  ok(/getUserMembershipTier/.test(conns),
    'the action reuses getUserMembershipTier — the same resolver the read surfaces call')
  ok(!/membership_tier.*===.*'plus'/.test(action),
    'the action does not re-implement the tier comparison against a raw column')

  // ══ 2. COOLDOWN ══════════════════════════════════════════════════════════
  // First message of a thread always notifies.
  ok(shouldNotifyRecipient(null, T0, 30), 'no prior message -> notify (first of the thread)')
  ok(shouldNotifyRecipient(undefined, T0, 30), 'undefined prior -> notify')

  // The boundary.
  const prior = T0.toISOString()
  ok(!shouldNotifyRecipient(prior, at(0), 30), 'same instant -> suppressed')
  ok(!shouldNotifyRecipient(prior, at(1), 30), '1 min later -> suppressed')
  ok(!shouldNotifyRecipient(prior, at(29), 30), '29 min later -> suppressed')
  ok(!shouldNotifyRecipient(prior, at(29.99), 30), 'just inside the window -> suppressed')
  ok(shouldNotifyRecipient(prior, at(30), 30), 'exactly 30 min -> NOTIFY (boundary is inclusive)')
  ok(shouldNotifyRecipient(prior, at(31), 30), 'past the window -> notify')
  ok(shouldNotifyRecipient(prior, at(600), 30), 'much later -> notify')

  // A burst: one notification, not ten.
  let sent = 0
  let lastNotified: string | null = null
  for (let i = 0; i < 10; i++) {
    const now = at(i) // ten messages, one a minute
    if (shouldNotifyRecipient(lastNotified, now, 30)) sent++
    lastNotified = now.toISOString() // every send updates the marker
  }
  eq(sent, 1, 'a 10-message burst inside the window produces exactly ONE notification')

  // A real conversation resuming the next day notifies again.
  eq([0, 5, 10, 240, 245].reduce((n, m) => {
    const now = at(m)
    const notify = shouldNotifyRecipient(m === 0 ? null : at(m - (m === 240 ? 230 : 5)).toISOString(), now, 30)
    return n + (notify ? 1 : 0)
  }, 0), 2, 'a burst, a long gap, then another burst -> two notifications')

  // 0 disables the cooldown (the old behaviour, recoverable in a hurry).
  ok(shouldNotifyRecipient(prior, at(0), 0), 'cooldown 0 -> always notify')
  ok(shouldNotifyRecipient(prior, at(1), 0), 'cooldown 0 -> every message notifies')

  // Fails OPEN: a duplicate notification beats a swallowed one.
  ok(shouldNotifyRecipient('not-a-timestamp', T0, 30), 'unparseable marker -> notify')
  ok(shouldNotifyRecipient('', T0, 30), 'empty marker -> notify')
  ok(shouldNotifyRecipient(at(60).toISOString(), T0, 30),
    'a prior message in the FUTURE (clock skew) -> notify, never mute')

  // Config.
  withEnv(undefined, () => eq(messageNotifyCooldownMinutes(), DEFAULT_MESSAGE_NOTIFY_COOLDOWN_MINUTES,
    'absent env -> 30 minute default'))
  withEnv('', () => eq(messageNotifyCooldownMinutes(), DEFAULT_MESSAGE_NOTIFY_COOLDOWN_MINUTES,
    'empty env -> default'))
  withEnv('5', () => eq(messageNotifyCooldownMinutes(), 5, 'env is honoured'))
  withEnv('0', () => eq(messageNotifyCooldownMinutes(), 0, 'explicit 0 is honoured — cooldown off'))
  for (const bad of ['abc', '-5', 'NaN']) {
    withEnv(bad, () => eq(messageNotifyCooldownMinutes(), DEFAULT_MESSAGE_NOTIFY_COOLDOWN_MINUTES,
      `'${bad}' falls back to the default — never "never notify"`))
  }
  eq(DEFAULT_MESSAGE_NOTIFY_COOLDOWN_MINUTES, 30, "the client's default is 30 minutes")

  // Wired in, and derived from the previous message rather than a new column.
  ok(/messageNotifyCooldownMinutes\(\)/.test(action), 'the action reads the configured cooldown')
  ok(/shouldNotifyRecipient\(priorMessage\?\.created_at/.test(action),
    'the marker is the previous message by the same sender — no new column')
  ok(/\.eq\('sender_partnership', userPartnershipId\)/.test(action),
    'the lookup is scoped to THIS sender')
  ok(/\.eq\('handshake_id', handshakeId\)/.test(action), '...and THIS handshake')
  ok(/\.neq\('id', newMessage\.id\)/.test(action),
    'the message just inserted is excluded, or it would always suppress itself')
  const cooldownIdx = action.indexOf('shouldNotifyRecipient')
  const sendNotifIdx = action.indexOf('sendNotification({')
  ok(cooldownIdx > -1 && cooldownIdx < sendNotifIdx, 'the cooldown is evaluated BEFORE sending')

  // The message itself must never be blocked by notification logic.
  ok(action.indexOf(".from('messages')") < cooldownIdx,
    'the message row is inserted BEFORE any notification work')
  ok(/non-blocking/.test(conns), 'the notification block is still explicitly non-blocking')

  // ══ 3. display_name, not full_name ═══════════════════════════════════════
  ok(/senderName: senderPartnership\?\.display_name/.test(action),
    'the notification names the sender by their curated display_name')
  ok(!/senderName: profile\?\.full_name/.test(action),
    'full_name is NO LONGER sent to the counterpart')
  ok(/\.select\('display_name'\)/.test(action), 'display_name is fetched from partnerships')
  ok(/\|\| 'Someone'/.test(action), 'a missing display_name falls back, never renders undefined')
  // Both templates interpolate whatever the caller passes.
  ok(/message: \(senderName: string\) =>\s*\n?\s*`\$\{senderName\} sent you a message/.test(notifs)
     || /\$\{senderName\} sent you a message/.test(notifs),
    'the SMS template interpolates senderName')
  ok(/subject: `New message from \$\{senderName\} on HAEVN`/.test(notifs),
    'the email subject interpolates senderName')
  ok(/<strong>\$\{senderName\}<\/strong> sent you a message/.test(notifs),
    'the email body interpolates senderName')

  // ══ 4. DEAD SEND PATH REMOVED ════════════════════════════════════════════
  ok(!existsSync(join(root, 'components/ChatConversation.tsx')),
    'components/ChatConversation.tsx is deleted')
  ok(!/export async function sendMessage\(/.test(chatSvc),
    'the browser-client sendMessage() is deleted — it gated neither tier nor handshake membership')
  ok(/export function subscribeToMessages/.test(chatSvc),
    'subscribeToMessages is KEPT — still used by the live chat page')
  ok(/export async function markMessagesAsRead/.test(chatSvc),
    'markMessagesAsRead is KEPT — still used by the live chat page')
  const chatPage = code('app/chat/[connectionId]/page.tsx')
  ok(/sendMessageAction/.test(chatPage) && !/from '@\/lib\/services\/chat'[\s\S]*sendMessage[^A]/.test(chatPage),
    'the live chat page sends only via sendMessageAction')

  report('messaging-gate')
}
main()
