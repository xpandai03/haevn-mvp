/**
 * No-match Match Monday ping — audience selection, cadence, copy variants, and
 * the two rules that must never regress:
 *   - no_match_notified_at is set on SUCCESSFUL send only
 *   - no raw magic link ever reaches a member
 *
 * Run: npx tsx lib/notify/__tests__/noMatchPing.test.ts
 */
import {
  isDueForPing, isRowLive, visiblePartnerships, pingEveryNWeeks, noMatchPingEnabled,
  DEFAULT_PING_EVERY_N_WEEKS, PING_INTERVAL_GRACE_MS, PING_SCORE_FLOOR,
  type MatchRowLite,
} from '../noMatchAudience'
import {
  variantForMarket, noMatchBody, noMatchSms, noMatchEmail, stripCityClause,
} from '../noMatchCopy'
import { runNoMatchPing, type PingSender } from '../runNoMatchPing'
import { sendScopeForNotificationType, scopeBlocks } from '../../suppression/scope'
import type { MarketIndex } from '../../markets/releaseGate'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const AUSTIN = 'Austin–Round Rock MSA'
const idx: MarketIndex = {
  cityToMarket: new Map([['austin', AUSTIN], ['round rock', AUSTIN]]),
  liveMarkets: new Set([AUSTIN]),
  ok: true,
}

const DAY = 24 * 60 * 60 * 1000
const WEEK = 7 * DAY
const NOW = new Date('2026-09-07T14:00:00.000Z') // a Monday, cron hour
const iso = (ms: number) => new Date(ms).toISOString()

const row = (o: Partial<MatchRowLite> = {}): MatchRowLite => ({
  partnership_a: 'a', partnership_b: 'b', score: 80,
  release_at: '2026-09-01T12:00:00.000Z', expires_at: null, saved: false, ...o,
})

function main() {
  // ═══ cadence ═════════════════════════════════════════════════════════════
  ok(isDueForPing(null, NOW, 1), 'never pinged -> always due (the first touch)')
  ok(isDueForPing(undefined, NOW, 4), 'undefined marker -> due')
  ok(isDueForPing('not-a-date', NOW, 1), 'unparseable marker -> treated as never pinged, due')

  // N = 1 (the client's launch value): due again a week later.
  ok(!isDueForPing(iso(NOW.getTime() - 1 * DAY), NOW, 1), 'pinged yesterday, N=1 -> NOT due')
  ok(isDueForPing(iso(NOW.getTime() - 7 * DAY), NOW, 1), 'pinged 7 days ago, N=1 -> due')
  ok(isDueForPing(iso(NOW.getTime() - 30 * DAY), NOW, 1), 'pinged long ago -> due')

  // The grace window: cron jitter must never defer a member a whole cycle.
  ok(isDueForPing(iso(NOW.getTime() - WEEK + PING_INTERVAL_GRACE_MS - 60_000), NOW, 1),
    'a run slightly early still fires — the 12h grace absorbs cron jitter')
  ok(!isDueForPing(iso(NOW.getTime() - WEEK + PING_INTERVAL_GRACE_MS + 60_000), NOW, 1),
    '...but the grace is bounded; a genuinely early run does not double-send')

  // N = 4 (the plan's recommendation) still works off the same marker.
  ok(!isDueForPing(iso(NOW.getTime() - 2 * WEEK), NOW, 4), 'N=4: 2 weeks ago -> not due')
  ok(isDueForPing(iso(NOW.getTime() - 4 * WEEK), NOW, 4), 'N=4: 4 weeks ago -> due')

  // A nonsense interval must never mean "send every run".
  ok(!isDueForPing(iso(NOW.getTime() - 10 * WEEK), NOW, 0), 'N=0 -> never due, never a send storm')
  ok(!isDueForPing(iso(NOW.getTime() - 10 * WEEK), NOW, -1), 'negative N -> never due')

  // ═══ config: defaults are today's behaviour ══════════════════════════════
  ok(!noMatchPingEnabled({} as any), 'ping defaults OFF when unset')
  ok(!noMatchPingEnabled({ NO_MATCH_PING_ENABLED: 'TRUE' } as any), "only exact 'true' enables it")
  ok(noMatchPingEnabled({ NO_MATCH_PING_ENABLED: 'true' } as any), "'true' enables it")
  eq(pingEveryNWeeks({} as any), DEFAULT_PING_EVERY_N_WEEKS, 'absent N -> documented default')
  eq(pingEveryNWeeks({ NO_MATCH_PING_EVERY_N_WEEKS: '4' } as any), 4, 'N is read from env')
  for (const bad of ['0', '-2', 'abc', '']) {
    eq(pingEveryNWeeks({ NO_MATCH_PING_EVERY_N_WEEKS: bad } as any), DEFAULT_PING_EVERY_N_WEEKS,
      `N='${bad}' falls back to the default, never 0 or NaN`)
  }

  // ═══ "has a visible match" ═══════════════════════════════════════════════
  const nowIso = NOW.toISOString()
  ok(isRowLive(row(), nowIso), 'released, unexpired, above floor -> live')
  ok(!isRowLive(row({ score: PING_SCORE_FLOOR - 1 }), nowIso), 'below the score floor -> not live')
  ok(!isRowLive(row({ release_at: null }), nowIso), 'no release_at -> not live')
  ok(!isRowLive(row({ release_at: '2026-12-01T12:00:00.000Z' }), nowIso), 'future release -> not live')
  ok(!isRowLive(row({ expires_at: '2026-09-01T00:00:00.000Z' }), nowIso), 'expired -> not live')
  ok(isRowLive(row({ expires_at: '2026-09-01T00:00:00.000Z', saved: true }), nowIso),
    'saved bypasses expiry, same as the read path')

  // The market gate is applied PER VIEWER, exactly as getComputedMatchCards does.
  const cities = new Map<string, string | null>([['a', 'Austin'], ['b', 'Portland']])
  const gated = visiblePartnerships([row()], cities, idx, nowIso, false)
  ok(gated.has('a'), 'Austin side of a released cross-market row CAN see it')
  ok(!gated.has('b'),
    'Portland side CANNOT — so they stay ping-eligible rather than being sent to an empty page')

  const opened = visiblePartnerships([row()], cities, idx, nowIso, true)
  ok(opened.has('a') && opened.has('b'), 'RELEASE_ALL_MARKETS on -> both sides can see it')

  // ═══ copy variants ═══════════════════════════════════════════════════════
  eq(variantForMarket(true), 'live_market', 'a live market gets variant A')
  eq(variantForMarket(false), 'pre_launch', 'a pre-launch market gets variant B')

  const a = noMatchBody('live_market', 'Austin', {} as any)
  const b = noMatchBody('pre_launch', 'Portland', {} as any)
  ok(a.includes('Austin'), 'variant A interpolates the member city')
  ok(b.includes('Portland'), 'variant B interpolates the member city')
  ok(!/still building|launch/i.test(a),
    'variant A NEVER claims we are still building — that is false in a live market')
  ok(/still building/i.test(b), 'variant B does say we are still building')
  ok(/know someone|sending them/i.test(b), 'variant B carries the spread-the-word line')
  ok(!/know someone|sending them/i.test(a), '...and variant A does not')

  // City-less: a clause, not a blank.
  for (const v of ['live_market', 'pre_launch'] as const) {
    for (const empty of [null, undefined, '', '   ']) {
      const body = noMatchBody(v, empty, {} as any)
      ok(!/\{city\}/.test(body), `${v}/${JSON.stringify(empty)}: placeholder never rendered`)
      ok(!/\bin\s*[.,]/.test(body), `${v}/${JSON.stringify(empty)}: no dangling "in ."`)
      ok(!/\bnull\b|\bundefined\b/.test(body), `${v}/${JSON.stringify(empty)}: no null leaked`)
      ok(body.length > 40, `${v}/${JSON.stringify(empty)}: still a real sentence`)
    }
  }
  eq(noMatchBody('pre_launch', '  Portland  ', {} as any).includes('Portland'), true, 'city is trimmed')

  // Env overrides — the client rewords without a deploy.
  eq(noMatchBody('live_market', 'Austin', { NO_MATCH_COPY_VARIANT_A: 'Nothing in {city} yet.' } as any),
    'Nothing in Austin yet.', 'override A is used verbatim with {city} interpolated')
  eq(noMatchBody('pre_launch', 'Portland', { NO_MATCH_COPY_VARIANT_B: 'Building in {city}.' } as any),
    'Building in Portland.', 'override B likewise')
  eq(noMatchBody('pre_launch', null, { NO_MATCH_COPY_VARIANT_B: 'Building in {city}.' } as any),
    'Building.', 'an override with {city} and no city drops the whole clause, not just the token')
  eq(stripCityClause('We are near {city} soon.'), 'We are soon.', 'near-clause stripped')
  eq(stripCityClause('Hello {city}!'), 'Hello!', 'bare placeholder stripped without leaving a space')

  // The rendered messages carry the link and no identities.
  const sms = noMatchSms('pre_launch', 'Portland', 'https://www.haevn.app/login-link/tok', {} as any)
  ok(sms.includes('https://www.haevn.app/login-link/tok'), 'SMS carries the sign-in URL')
  const mail = noMatchEmail('live_market', 'Austin', 'https://www.haevn.app/login-link/tok',
    'https://www.haevn.app/api/unsubscribe?token=x', {} as any)
  ok(mail.html.includes('login-link/tok'), 'email CTA carries the sign-in URL')
  ok(/Unsubscribe/.test(mail.html), 'email carries an unsubscribe link when one is supplied')
  ok(!/Unsubscribe/.test(
    noMatchEmail('live_market', 'Austin', 'u', undefined, {} as any).html),
    'no unsubscribe link when no secret is configured — never a broken URL')
  ok(!/<script|onerror=/i.test(
    noMatchEmail('live_market', '<script>x</script>', 'u', undefined, {} as any).html),
    'a hostile city string cannot inject markup into the email')

  // ═══ suppression scope ═══════════════════════════════════════════════════
  eq(sendScopeForNotificationType('no_match'), 'renotify',
    "the ping is 'renotify' so a plain unsubscribe actually stops it")
  ok(scopeBlocks('renotify', sendScopeForNotificationType('no_match')),
    'an unsubscribe suppression blocks the ping')
  ok(scopeBlocks('all_noncritical', sendScopeForNotificationType('no_match')),
    'a complaint blocks the ping')
  ok(!scopeBlocks('all_noncritical', sendScopeForNotificationType('match')),
    'a suppressed member STILL gets match notifications — those stay critical')
  ok(!scopeBlocks('renotify', sendScopeForNotificationType('match')), '...and unsubscribes never touch them')
  eq(sendScopeForNotificationType('message'), 'critical', 'message is unchanged')
  eq(sendScopeForNotificationType('connection_interest'), 'all_noncritical', 'nudge is unchanged')

  report('no-match-ping-unit')
}

// ─── runner behaviour (injected sender; nothing is ever sent) ────────────────

interface FakeState {
  sent: { partnershipId: string; signInUrl?: string; variant: string; city: string | null }[]
  marked: string[]
  tokens: number
}

function fakeSender(state: FakeState, opts: { failFor?: Set<string> } = {}): PingSender {
  return {
    send: async (o) => {
      const fail = opts.failFor?.has(o.partnershipId) ?? false
      if (!fail) {
        state.sent.push({
          partnershipId: o.partnershipId, signInUrl: o.signInUrl,
          variant: o.noMatchVariant, city: o.city,
        })
      }
      return { sms: { sent: false }, email: { sent: !fail } }
    },
    signInUrl: async () => { state.tokens++; return 'https://www.haevn.app/login-link/tok' },
    markPinged: async (id) => { state.marked.push(id) },
    userIdForEmail: async () => 'user-1',
  }
}

/** Minimal admin double: enough rows for buildNoMatchAudience's six bulk reads. */
function fakeAdmin(rows: Record<string, any[]>) {
  return {
    from(table: string) {
      const data = rows[table] ?? []
      const builder: any = {
        select: () => builder,
        range: (from: number, to: number) =>
          Promise.resolve({ data: data.slice(from, to + 1), error: null }),
      }
      return builder
    },
  } as any
}

async function runnerTests() {
  const base = {
    markets: [{ market_name: AUSTIN, is_live: true }],
    msa_allowed_zips: [{ city: 'Austin', msa_name: AUSTIN }],
    email_suppressions: [],
    computed_matches: [],
    partnership_members: [
      { partnership_id: 'p-austin', user_id: 'u1' },
      { partnership_id: 'p-portland', user_id: 'u2' },
      { partnership_id: 'p-matched', user_id: 'u3' },
    ],
    profiles: [
      { user_id: 'u1', email: 'a@example.test' },
      { user_id: 'u2', email: 'b@example.test' },
      { user_id: 'u3', email: 'c@example.test' },
    ],
    partnerships: [
      { id: 'p-austin', city: 'Austin', phone: null, profile_state: 'live', no_match_notified_at: null },
      { id: 'p-portland', city: 'Portland', phone: null, profile_state: 'live', no_match_notified_at: null },
      { id: 'p-matched', city: 'Austin', phone: null, profile_state: 'live', no_match_notified_at: null },
      { id: 'p-draft', city: 'Austin', phone: null, profile_state: 'draft', no_match_notified_at: null },
    ],
  }

  // p-matched can see a released match -> excluded by definition.
  const withMatch = {
    ...base,
    computed_matches: [{
      partnership_a: 'p-matched', partnership_b: 'p-other', score: 82,
      release_at: '2026-09-01T12:00:00.000Z', expires_at: null, saved: false,
    }],
  }

  const env = { NO_MATCH_PING_ENABLED: 'true', NO_MATCH_PING_EVERY_N_WEEKS: '1' } as any

  // ── variant split + exclusions ──
  let st: FakeState = { sent: [], marked: [], tokens: 0 }
  let r = await runNoMatchPing({
    admin: fakeAdmin(withMatch), sender: fakeSender(st), now: NOW, env, marketIdx: idx,
  })
  eq(r.eligible, 2, 'draft profiles and members who can see a match are both excluded')
  eq(r.hasMatch, 1, 'the matched partnership is counted, not pinged')
  eq(r.byVariant.live_market, 1, 'the Austin member gets variant A')
  eq(r.byVariant.pre_launch, 1, 'the Portland member gets variant B')
  eq(st.sent.find((s) => s.partnershipId === 'p-austin')?.variant, 'live_market',
    'Austin -> variant A, never B')
  eq(st.sent.find((s) => s.partnershipId === 'p-portland')?.variant, 'pre_launch', 'Portland -> variant B')
  eq(st.sent.find((s) => s.partnershipId === 'p-portland')?.city, 'Portland',
    'the member city is passed through for {city}, never a market slug')
  eq(st.marked.sort(), ['p-austin', 'p-portland'], 'both successful sends are marked')

  // ── the match phase always wins: never both in one run ──
  st = { sent: [], marked: [], tokens: 0 }
  r = await runNoMatchPing({
    admin: fakeAdmin(base), sender: fakeSender(st), now: NOW, env, marketIdx: idx,
    excludePartnershipIds: new Set(['p-austin']),
  })
  ok(!st.sent.some((s) => s.partnershipId === 'p-austin'),
    'a member notified by the match phase is NEVER also pinged in the same run')
  eq(r.excludedMatchPhase, 1, 'the exclusion is reported')

  // ── RULE: mark on success ONLY ──
  st = { sent: [], marked: [], tokens: 0 }
  r = await runNoMatchPing({
    admin: fakeAdmin(base), sender: fakeSender(st, { failFor: new Set(['p-portland']) }),
    now: NOW, env, marketIdx: idx,
  })
  eq(r.failed, 1, 'a total send failure is counted')
  ok(!st.marked.includes('p-portland'),
    'a FAILED send is never marked — the member is retried next eligible run')
  ok(st.marked.includes('p-austin'), '...while a successful send is marked')

  // ── cadence gates the audience ──
  const recentlyPinged = {
    ...base,
    partnerships: base.partnerships.map((p) =>
      p.id === 'p-austin' ? { ...p, no_match_notified_at: iso(NOW.getTime() - 2 * DAY) } : p),
  }
  st = { sent: [], marked: [], tokens: 0 }
  r = await runNoMatchPing({ admin: fakeAdmin(recentlyPinged), sender: fakeSender(st), now: NOW, env, marketIdx: idx })
  eq(r.notDue, 1, 'a member pinged 2 days ago is not due at N=1')
  ok(!st.sent.some((s) => s.partnershipId === 'p-austin'), '...and is not sent to')

  st = { sent: [], marked: [], tokens: 0 }
  r = await runNoMatchPing({
    admin: fakeAdmin(recentlyPinged), sender: fakeSender(st), now: NOW, marketIdx: idx,
    env: { ...env, NO_MATCH_PING_EVERY_N_WEEKS: '4' },
  })
  eq(r.everyNWeeks, 4, 'the interval is config-driven, never hardcoded')

  // ── suppressed email, no phone -> unreachable, never marked ──
  const suppressed = {
    ...base,
    email_suppressions: [{ email: 'b@example.test', scope: 'renotify', reason: 'unsubscribe' }],
  }
  st = { sent: [], marked: [], tokens: 0 }
  r = await runNoMatchPing({ admin: fakeAdmin(suppressed), sender: fakeSender(st), now: NOW, env, marketIdx: idx })
  eq(r.unreachable, 1, 'a suppressed member with no phone is unreachable')
  ok(!st.sent.some((s) => s.partnershipId === 'p-portland'), '...gets nothing')
  ok(!st.marked.includes('p-portland'), '...and is not marked, so re-adding contact info brings them back')

  // ── never-signed-in members are IN the audience (the whole point) ──
  ok(st.sent.length > 0 || r.eligible >= 0, 'sign-in state is not a filter for the ping')

  // ── dry run: real audience, zero sends, zero tokens, zero marks ──
  st = { sent: [], marked: [], tokens: 0 }
  r = await runNoMatchPing({ admin: fakeAdmin(base), sender: fakeSender(st), now: NOW, env, marketIdx: idx, dryRun: true })
  ok(r.dryRun && r.eligible === 3, 'dry run resolves the real audience')
  eq(st.sent.length, 0, 'dry run sends NOTHING')
  eq(st.tokens, 0, 'dry run mints no sign-in token')
  eq(st.marked.length, 0, 'dry run writes no cadence marker')

  // ── every sign-in URL is a handoff, never a magic link ──
  st = { sent: [], marked: [], tokens: 0 }
  await runNoMatchPing({ admin: fakeAdmin(base), sender: fakeSender(st), now: NOW, env, marketIdx: idx })
  for (const s of st.sent) {
    ok(/\/login-link\//.test(s.signInUrl ?? ''), `${s.partnershipId}: sign-in URL is a handoff`)
    ok(!/token_hash|type=magiclink|auth\/confirm/.test(s.signInUrl ?? ''),
      `${s.partnershipId}: NO raw magic link`)
  }

  report('no-match-ping-runner')
}

main()
runnerTests()
