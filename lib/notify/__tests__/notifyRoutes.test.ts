/**
 * Structural guards for the all-markets release + Match Monday cron.
 *
 * These are shape bugs that would be invisible in review and catastrophic in
 * production: a raw magic link mailed to 500 people, a cadence marker written on
 * a failure, a ping that skips the quiet Monday it exists for, or a flag that
 * does not actually default to today's behaviour.
 *
 * Run: npx tsx lib/notify/__tests__/notifyRoutes.test.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { releaseAllMarkets } from '../../markets/releaseGate'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

const root = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/** assert about CODE, not the prose that explains it */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const cron = code('app/api/cron/notify-matches/route.ts')
const gate = code('lib/markets/releaseGate.ts')
const cards = code('lib/actions/computedMatchCards.ts')
const runner = code('lib/notify/runNoMatchPing.ts')
const audience = code('lib/notify/noMatchAudience.ts')
const copy = code('lib/notify/noMatchCopy.ts')
const signIn = code('lib/auth/notifySignIn.ts')
const migration = read('supabase/migrations/056_no_match_notified_at.sql')

const withEnv = (env: Record<string, string | undefined>, fn: () => void) => {
  const saved: Record<string, string | undefined> = {}
  for (const k of Object.keys(env)) {
    saved[k] = process.env[k]
    if (env[k] === undefined) delete process.env[k]
    else process.env[k] = env[k] as string
  }
  try { fn() } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k] as string
    }
  }
}

function main() {
  // ══ NO RAW MAGIC LINK ANYWHERE IN THE MONDAY CRON ════════════════════════
  // The single most important assertion in this file. A raw magic link is burned
  // by mail scanners before the member taps it; at ~500 links a Monday, to a
  // cohort that is 97% never-signed-in and has no password, that is the whole
  // channel failing silently.
  ok(!/buildSignInUrl/.test(cron), 'the cron NEVER calls buildSignInUrl (raw magic link)')
  ok(!/generateLink/.test(cron), 'the cron never generates a Supabase link directly')
  ok(!/token_hash=|type=magiclink|auth\/confirm/.test(cron),
    'no magic-link URL shape is constructed anywhere in the cron')
  ok(/issueNotifySignInUrl/.test(cron), 'the cron issues HANDOFF sign-in URLs instead')
  for (const [name, src] of Object.entries({ runner, audience, copy })) {
    ok(!/buildSignInUrl|generateLink|type=magiclink/.test(src),
      `${name} contains no raw magic-link path either`)
  }
  // The handoff issuer must mint through the shared 054 primitives + table.
  ok(/login_links/.test(signIn), 'handoff rows are written to the existing login_links table')
  ok(/hashHandoffToken/.test(signIn), 'only the token HASH is persisted')
  ok(/loginLinkUrl/.test(signIn), 'the URL is built by the shared helper, not a literal')
  ok(!/generateLink/.test(signIn),
    'the issuer never calls generateLink — that silently CREATES users')

  // ══ MARK ON SUCCESS ONLY ═════════════════════════════════════════════════
  const markIdx = runner.indexOf('markPinged(entry.partnershipId')
  const successIdx = runner.indexOf('res.sms.sent || res.email.sent')
  ok(successIdx > -1 && markIdx > successIdx,
    'no_match_notified_at is stamped only inside the success branch')
  ok(/result\.failed\+\+/.test(runner), 'a total failure is counted')
  const failBlock = runner.slice(runner.indexOf('} else {', successIdx))
  ok(!/markPinged/.test(failBlock.slice(0, 400)),
    'the failure branch never marks — the member is retried next eligible run')
  ok(/no_match_notified_at/.test(migration), 'migration 056 adds the marker column')
  ok(/ADD COLUMN IF NOT EXISTS/.test(migration), 'migration 056 is additive and idempotent')
  ok(!/NOT NULL|DEFAULT/.test(migration.split('COMMENT ON')[0]),
    'the column is nullable with no default — every partnership starts "never pinged"')

  // ══ DRY RUN SENDS NOTHING ════════════════════════════════════════════════
  const dryIdx = runner.indexOf('if (dryRun)')
  const sendIdx = runner.indexOf('await sender.send(')
  const tokenIdx = runner.indexOf('await sender.signInUrl(')
  ok(dryIdx > -1 && dryIdx < sendIdx && dryIdx < tokenIdx,
    'the dry-run return precedes BOTH the token mint and the send')

  // ══ THE PING RUNS ON A QUIET MONDAY ══════════════════════════════════════
  // The match phase returns rather than responding, so every outcome — including
  // "no new pairs", which is the typical Monday — still reaches the ping.
  ok(/async function runMatchPhase/.test(cron), 'the match phase is a function, not the handler body')
  ok(!/return NextResponse\.json/.test(cron.slice(cron.indexOf('async function runMatchPhase'))),
    'the match phase never responds directly — it always returns to the ping phase')
  // Match the CALL SITE, not the import line at the top of the file.
  const pingIdx = cron.indexOf('await runNoMatchPing({')
  const phaseIdx = cron.indexOf('await runMatchPhase(')
  ok(pingIdx > -1, 'the ping runner is actually invoked')
  ok(phaseIdx > -1 && pingIdx > phaseIdx, 'the ping phase runs AFTER the match phase')
  ok(/excludePartnershipIds: phase\.notifiedThisRun/.test(cron),
    'members notified by the match phase are excluded from the ping — never both in one run')
  ok(/noMatchPingEnabled\(\)/.test(cron), 'the ping is behind its own flag')
  const tryIdx = cron.lastIndexOf('try {', pingIdx)
  const catchIdx = cron.indexOf('catch', pingIdx)
  ok(tryIdx > phaseIdx && catchIdx > pingIdx,
    'the ping call sits in its own try/catch — a ping failure never takes the match phase down')
  ok(/!phase\.gateFailedClosed/.test(cron),
    'a failed market gate also skips the ping — we cannot pick a copy variant without it')

  // ══ FLAGS DEFAULT TO TODAY'S BEHAVIOUR ═══════════════════════════════════
  withEnv({ RELEASE_ALL_MARKETS: undefined }, () =>
    ok(!releaseAllMarkets(), 'RELEASE_ALL_MARKETS defaults OFF when unset'))
  withEnv({ RELEASE_ALL_MARKETS: 'TRUE' }, () =>
    ok(!releaseAllMarkets(), "only the exact string 'true' opens release"))
  withEnv({ RELEASE_ALL_MARKETS: '1' }, () =>
    ok(!releaseAllMarkets(), "'1' does not open release"))
  withEnv({ RELEASE_ALL_MARKETS: 'true' }, () =>
    ok(releaseAllMarkets(), "'true' opens release"))
  ok(!/NEXT_PUBLIC_/.test(gate), 'the release flag is never exposed to the browser bundle')

  // ══ THE GATE IS RETIRED, NOT DELETED ═════════════════════════════════════
  ok(/is_live/.test(gate) && /msa_allowed_zips/.test(gate),
    'markets / msa_allowed_zips / is_live all remain — reporting keeps working')
  ok(/gateEnforced/.test(gate), 'the result says whether the counts withheld anyone')
  ok(/excludedByCity\[key\]/.test(gate),
    'the per-city tally is still populated under the flag — reporting-only, never silent')
  ok(/releaseAllMarkets\(\)/.test(cards), 'the member READ path honours the flag')
  const viewerIdx = cards.indexOf('const viewerMarketLive')
  const rowGateIdx = cards.indexOf('isRowVisibleForNonLiveMarket(m.release_at)')
  ok(viewerIdx > -1 && rowGateIdx > viewerIdx,
    'the viewer gate is resolved before rows are filtered — release without it means an empty page')

  // ══ NO HARDCODED CITY IN THE PING ════════════════════════════════════════
  const cityWords = /\b(Austin|Portland|Round Rock|Tampa|Salem|Beaverton|Eugene)\b/
  for (const [name, src] of Object.entries({ copy, audience, runner })) {
    ok(!cityWords.test(src), `${name} contains no hardcoded city name`)
  }
  ok(/\{city\}/.test(copy), 'the city is a template slot')
  ok(/NO_MATCH_COPY_VARIANT_A/.test(copy) && /NO_MATCH_COPY_VARIANT_B/.test(copy),
    'both variants are env-overridable so the client can reword without a deploy')
  ok(/withoutCity/.test(copy), 'both variants carry an explicit city-less form')
  ok(/isCityLive/.test(audience),
    'variant selection reuses the shared resolver — no second city-matching implementation')

  // ══ THE PING IS SUPPRESSIBLE; MATCHES ARE NOT ════════════════════════════
  const scope = code('lib/suppression/scope.ts')
  ok(/type === 'no_match'\) return 'renotify'/.test(scope),
    "no_match is 'renotify' so an unsubscribe actually stops the mail it is attached to")
  ok(/'critical'/.test(scope), 'match/message remain critical and are never suppressed')

  // ══ RUNTIME ══════════════════════════════════════════════════════════════
  ok(/maxDuration = 300/.test(cron), 'the two-phase run declares the platform maximum')
  ok(/PING_CONCURRENCY/.test(runner) && /PING_SOFT_BUDGET_MS/.test(runner),
    'the send loop is bounded and has a soft budget rather than being hard-killed')

  report('notify-routes-structural')
}
main()
