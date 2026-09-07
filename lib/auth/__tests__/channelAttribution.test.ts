/**
 * Handoff channel attribution — the marker is plumbed end to end, parsing is
 * null-safe, self-serve is untouched, and NOTHING about token count, token
 * semantics or rate-limit counting moved.
 *
 * Run: npx tsx lib/auth/__tests__/channelAttribution.test.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { withChannel, parseChannelCode, CHANNEL_PARAM } from '../notifySignIn'
import { loginLinkUrl, loginLinkUrlIsSafe } from '../loginLink'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

const root = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const notify = code('lib/services/notifications.ts')
const landing = code('app/login-link/[token]/route.ts')
const consume = code('app/api/auth/login-link/consume/route.ts')
const issuer = code('lib/auth/notifySignIn.ts')
const cron = code('app/api/cron/notify-matches/route.ts')
const migration = read('supabase/migrations/057_login_links_channel.sql')

const TOKEN = 'a'.repeat(64)
const URL_ = loginLinkUrl(TOKEN)

function main() {
  // ══ marker construction ══════════════════════════════════════════════════
  eq(withChannel(URL_, 'email'), `${URL_}?${CHANNEL_PARAM}=e`, 'email marker appended')
  eq(withChannel(URL_, 'sms'), `${URL_}?${CHANNEL_PARAM}=s`, 'sms marker appended')
  ok(loginLinkUrlIsSafe(withChannel(URL_, 'email')), 'a tagged URL still passes the apex/https guard')
  ok(loginLinkUrlIsSafe(withChannel(URL_, 'sms')), '...for both channels')
  eq(withChannel(`${URL_}?x=1`, 'sms'), `${URL_}?x=1&${CHANNEL_PARAM}=s`, 'existing query string respected')

  // The fallback login page is NOT a handoff and must never be attributed.
  const fallback = 'https://www.haevn.app/auth/login'
  eq(withChannel(fallback, 'email'), fallback, 'the /auth/login fallback is left untagged')
  eq(withChannel(fallback, 'sms'), fallback, '...for both channels')

  // ══ parsing is null-safe, never throwing ═════════════════════════════════
  eq(parseChannelCode('e'), 'email', "'e' -> email")
  eq(parseChannelCode('s'), 'sms', "'s' -> sms")
  eq(parseChannelCode('E'), 'email', 'case tolerant')
  eq(parseChannelCode(' s '), 'sms', 'whitespace tolerant')
  for (const bad of [null, undefined, '', '   ', 'x', 'email', 'sms', '1', 0, {}, [], ['e'], true, NaN]) {
    eq(parseChannelCode(bad as any), null, `unrecognised marker ${JSON.stringify(bad)} -> null, never a throw`)
  }
  eq(parseChannelCode("e'; DROP TABLE login_links;--"), null, 'an injection attempt parses to null')

  // ══ plumbed end to end ═══════════════════════════════════════════════════
  ok(/const smsSignInUrl = withChannel\(matchSignInUrl, 'sms'\)/.test(notify),
    'the dispatcher builds an SMS-tagged URL')
  ok(/const emailSignInUrl = withChannel\(matchSignInUrl, 'email'\)/.test(notify),
    'the dispatcher builds an email-tagged URL')
  // Every SMS template must receive the sms-tagged url, every email the email one.
  const smsBlock = notify.slice(notify.indexOf('const smsBody'), notify.indexOf('const emailTemplate'))
  const mailBlock = notify.slice(notify.indexOf('const emailTemplate'), notify.indexOf('const promises'))
  ok(!/matchSignInUrl/.test(smsBlock), 'no SMS body uses the untagged URL')
  ok(!/matchSignInUrl/.test(mailBlock), 'no email body uses the untagged URL')
  ok(/smsSignInUrl/.test(smsBlock) && !/emailSignInUrl/.test(smsBlock), 'SMS bodies use only the SMS URL')
  ok(/emailSignInUrl/.test(mailBlock) && !/smsSignInUrl/.test(mailBlock), 'email bodies use only the email URL')

  ok(new RegExp(`parseChannelCode\\(request\\.nextUrl\\.searchParams\\.get\\(CHANNEL_PARAM\\)\\)`).test(landing),
    'the landing page parses ?c= from the query')
  ok(/name="\$\{CHANNEL_PARAM\}"/.test(landing), 'and carries it in a hidden form field')
  ok(/channel \?/.test(landing), 'the hidden field is emitted only when a channel was recognised')

  ok(/channel = parseChannelCode\(form\.get\(CHANNEL_PARAM\)\)/.test(consume),
    'the consume route reads the marker from the form')
  ok(/update\(\{ channel \}\)/.test(consume), 'and records it')

  // ══ THE CRITICAL PATH IS UNTOUCHED ═══════════════════════════════════════
  // The atomic single-use claim must not mention channel: if 057 were missing,
  // including it there would break sign-in for everyone.
  const claim = consume.slice(consume.indexOf('.from(\'login_links\')'), consume.indexOf('if (claimErr)'))
  ok(/consumed_at: nowIso, consumed_ip: ip/.test(claim), 'the claim still sets consumed_at + consumed_ip')
  ok(!/channel/.test(claim), 'the atomic claim does NOT mention channel — sign-in cannot depend on 057')
  const claimIdx = consume.indexOf('.update({ consumed_at: nowIso')
  const chanIdx = consume.indexOf('update({ channel })')
  ok(claimIdx > -1 && chanIdx > claimIdx, 'channel is written AFTER the claim, as a separate statement')
  const chanBlock = consume.slice(consume.lastIndexOf('try {', chanIdx), chanIdx + 300)
  ok(/catch/.test(chanBlock), 'the channel write is wrapped — it can never fail the consume')
  ok(/console\.warn/.test(chanBlock), 'a failed channel write warns rather than throwing')

  // ══ TOKEN COUNT AND RATE LIMITING UNCHANGED ══════════════════════════════
  eq((cron.match(/issueNotifySignInUrl\(/g) ?? []).length, 1,
    'the cron still mints exactly ONE token per member — no two-token variant')
  ok(!/RATE_LIMIT|countAttempts/.test(consume), 'the consume route does not touch rate limiting')
  ok(!/RATE_LIMIT|countAttempts/.test(notify), 'the dispatcher does not touch rate limiting')
  // The helper bodies only — from withChannel's declaration to the end of
  // parseChannelCode. They must be pure string work with no DB access at all.
  const helpers = issuer.slice(
    issuer.indexOf('export function withChannel'),
    issuer.indexOf('export async function issueNotifySignInUrl')
  )
  ok(helpers.length > 0, 'the channel helpers are declared before the issuer')
  ok(!/request_ip|from\('login_links'\)|insert\(|update\(/.test(helpers),
    'the channel helpers are pure string work — no DB access, no rate-limit key')
  const insert = issuer.slice(issuer.indexOf('insert({'), issuer.indexOf('if (error)'))
  ok(!/channel/.test(insert), 'minting writes no channel — it is set at consume time only')

  // ══ SELF-SERVE UNAFFECTED ════════════════════════════════════════════════
  const selfServe = code('app/api/auth/login-link/route.ts')
  ok(!/withChannel|CHANNEL_PARAM|channel/.test(selfServe),
    'the self-serve request route is untouched — its links carry no marker, so channel stays NULL')
  const loginEmail = code('lib/auth/loginLinkEmail.ts')
  ok(!/CHANNEL_PARAM|\?c=/.test(loginEmail), 'the self-serve email template adds no marker')

  // ══ MIGRATION ════════════════════════════════════════════════════════════
  ok(/ADD COLUMN IF NOT EXISTS channel TEXT/.test(migration), '057 adds a nullable TEXT column')
  ok(!/NOT NULL/.test(migration.split('COMMENT ON')[0]), 'no NOT NULL — NULL is a legitimate value')
  ok(!/DEFAULT/.test(migration.split('COMMENT ON')[0]), 'no default, no backfill')
  ok(/CREATE INDEX IF NOT EXISTS/.test(migration), 'the reporting index is idempotent')

  report('handoff-channel-attribution')
}
main()
