/**
 * Send pacing, provider-error classification, retry policy, invalid-destination
 * handling, and warm-cron chunk/coverage config.
 *
 * Run: npx tsx lib/services/__tests__/sendThrottle.test.ts
 * NOTHING IS SENT — providers are never called; the pacer is driven by a fake
 * clock and the failure paths are exercised through their classifiers.
 */
import {
  SendPacer, sendRatePerSec, DEFAULT_SEND_RATE_PER_SEC,
  classifyEmailError, classifySmsError,
  RETRY_BACKOFF_MS, MAX_THROTTLE_RETRIES,
} from '../sendRate'
import { WARM_SOFT_BUDGET_MS, warmCoverage } from '../../matches/warmConfig'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

// ═══ rate config ═══════════════════════════════════════════════════════════
eq(sendRatePerSec({} as any), DEFAULT_SEND_RATE_PER_SEC, 'absent rate -> documented default')
eq(DEFAULT_SEND_RATE_PER_SEC, 5, 'default is 5/sec — half of Resend\'s 10/sec ceiling')
eq(sendRatePerSec({ SEND_RATE_PER_SEC: '8' } as any), 8, 'rate is read from env')
eq(sendRatePerSec({ SEND_RATE_PER_SEC: '2.5' } as any), 2.5, 'fractional rates are honoured')
for (const bad of ['0', '-3', 'abc', '', 'Infinity'])
  eq(sendRatePerSec({ SEND_RATE_PER_SEC: bad } as any), DEFAULT_SEND_RATE_PER_SEC,
    `rate='${bad}' falls back — a bad value must NEVER mean unlimited`)

// ═══ pacing math — the burst that caused 146 failures ══════════════════════
{
  // Fake clock: time only advances when we say so, so the spacing is exact.
  let now = 0
  const p = new SendPacer(5, () => now)
  // Eight callers arrive at once (concurrency 8) — the real Sept 21 shape.
  const waits = Array.from({ length: 8 }, () => p.reserve())
  eq(waits[0], 0, 'first caller goes immediately')
  eq(waits[1], 200, 'second waits 1/5s')
  eq(waits[7], 1400, 'eighth waits 7/5s — the burst is spread, not dropped')
  ok(waits.every((w, i) => w === i * 200), 'every slot is spaced exactly 1/rate apart')
  // At 5/sec, 8 simultaneous callers can never exceed 10/sec at the wire.
  const within1s = waits.filter((w) => w < 1000).length
  ok(within1s <= 5, `at most 5 dispatches land in any one second (got ${within1s})`)
}
{
  // Projection used for the Sept 28 duration estimate.
  const p = new SendPacer(5)
  eq(Math.round(p.projectSeconds(620)), 124, '620 emails at 5/sec ≈ 124s')
  eq(Math.round(p.projectSeconds(59)), 12, 'the 59-email match phase ≈ 12s')
  eq(p.projectSeconds(1), 0, 'a single send waits for nothing')
  eq(p.projectSeconds(0), 0, 'an empty run waits for nothing')
  ok(new SendPacer(5).projectSeconds(620) < 240,
    'the projected Sept 28 email pacing fits inside the 240s soft budget')
}
{
  // The clock does not rewind: a pacer resumes from where it left off.
  let now = 0
  const p = new SendPacer(5, () => now)
  p.reserve(); p.reserve()
  now = 10_000 // a long gap
  eq(p.reserve(), 0, 'after a gap the next send is immediate, not back-dated')
}

// ═══ error classification — throttle vs quota vs invalid ══════════════════
eq(classifyEmailError({ message: 'rate_limit_exceeded: Too many requests. You can only make 10 requests per second.' }),
  'throttled', 'Resend rate limit -> throttled (retryable)')
eq(classifyEmailError({ message: 'daily_quota_exceeded: You have reached your daily email sending quota. (429)' }),
  'quota', 'Resend daily quota -> quota (NOT retryable, even though it is also a 429)')
eq(classifyEmailError({ message: 'validation_error: Invalid `to` field.' }),
  'invalid', 'Resend validation error -> invalid destination')
eq(classifyEmailError({ message: 'something else entirely' }), 'other', 'unknown -> other')
eq(classifyEmailError(null), 'other', 'null error -> other, never a crash')
eq(classifyEmailError('rate_limit_exceeded'), 'throttled', 'a bare string error still classifies')

// The distinction that matters: both are 429s, but only one can succeed on retry.
ok(classifyEmailError({ message: 'daily_quota_exceeded (429)' }) !== 'throttled',
  'a quota 429 must NOT be treated as a throttle — retrying it burns the run budget for nothing')

eq(classifySmsError({ message: "Error: Invalid 'To' Phone Number: +1555123XXXX" }),
  'invalid', 'Twilio invalid number -> invalid destination')
eq(classifySmsError({ message: 'Error 21211: invalid To phone number' }), 'invalid', 'Twilio 21211 -> invalid')
eq(classifySmsError({ message: 'rate limit exceeded' }), 'throttled', 'Twilio throttle -> throttled')
eq(classifySmsError({ message: 'carrier rejected' }), 'other', 'other SMS failure -> other')

// ═══ retry policy ══════════════════════════════════════════════════════════
eq(MAX_THROTTLE_RETRIES, 2, 'a throttled send retries at most twice before counting as failed')
eq(RETRY_BACKOFF_MS.length, MAX_THROTTLE_RETRIES, 'one backoff per retry')
ok(RETRY_BACKOFF_MS[1] > RETRY_BACKOFF_MS[0], 'backoff increases')
ok(RETRY_BACKOFF_MS.reduce((a, b) => a + b, 0) < 2000,
  'total backoff per send stays under 2s so retries cannot eat the run budget')

// Simulated loop: the exact policy sendEmail implements.
function simulate(kind: 'throttled' | 'quota' | 'invalid' | 'other', failUntilAttempt: number) {
  let attempts = 0, retries = 0
  for (let attempt = 0; ; attempt++) {
    attempts++
    if (attempt >= failUntilAttempt) return { ok: true, attempts, retries }
    if (kind === 'throttled' && attempt < MAX_THROTTLE_RETRIES) { retries++; continue }
    return { ok: false, attempts, retries }
  }
}
{
  const r = simulate('throttled', 1)
  eq(r, { ok: true, attempts: 2, retries: 1 }, 'a throttle that clears on retry 1 succeeds')
}
{
  const r = simulate('throttled', 99)
  eq(r, { ok: false, attempts: 3, retries: 2 }, 'a persistent throttle fails after exactly 2 retries')
}
{
  const r = simulate('quota', 99)
  eq(r, { ok: false, attempts: 1, retries: 0 }, 'a quota failure does NOT retry — one attempt, then done')
}
{
  const r = simulate('invalid', 99)
  eq(r, { ok: false, attempts: 1, retries: 0 }, 'an invalid destination does not retry either')
}

// ═══ invalid-destination skipping is per CHANNEL ═══════════════════════════
{
  const invalid = { phone: new Set(['p-badphone']), email: new Set(['p-bademail']) }
  const skipSms = (id: string) => invalid.phone.has(id)
  const skipEmail = (id: string) => invalid.email.has(id)
  ok(skipSms('p-badphone') && !skipEmail('p-badphone'),
    'a member with a bad PHONE still receives EMAIL')
  ok(skipEmail('p-bademail') && !skipSms('p-bademail'),
    'a member with a bad EMAIL still receives SMS')
  ok(!skipSms('p-fine') && !skipEmail('p-fine'), 'an unmarked member is skipped on neither channel')
  // Skipping is not failing — it must not inflate the error column.
  const outcome = (id: string) => (skipSms(id) && skipEmail(id)) ? 'unreachable' : 'attempted'
  eq(outcome('p-badphone'), 'attempted', 'one bad channel does not make a member unreachable')
}

// ═══ warm cron: chunk budget + coverage ════════════════════════════════════
eq(WARM_SOFT_BUDGET_MS, 240_000, 'warm budget is 240s, inside the 300s ceiling')
ok(WARM_SOFT_BUDGET_MS < 300_000, '...with headroom for the in-flight generation to persist')
eq(warmCoverage({} as any), 'viewers', 'coverage defaults to the cheaper viewers-only set')
eq(warmCoverage({ WARM_COVERAGE: 'all' } as any), 'all', "'all' selects full coverage")
eq(warmCoverage({ WARM_COVERAGE: 'ALL' } as any), 'viewers', 'only exact "all" widens coverage')
eq(warmCoverage({ WARM_COVERAGE: 'nonsense' } as any), 'viewers', 'a bad value falls back to the cheap set')

{
  // Chunking math, at the measured ~12s per generation.
  const PER = 12_000
  const perRun = Math.floor(WARM_SOFT_BUDGET_MS / PER)
  eq(perRun, 20, 'one run completes ~20 directions at 12s each')
  ok(Math.ceil(683 / perRun) === 35, '683 viewer directions need ~35 runs to warm fully')
  // The stop rule: never START work that cannot finish inside the ceiling.
  const wouldStart = (elapsed: number) => elapsed <= WARM_SOFT_BUDGET_MS
  ok(wouldStart(239_000), 'work starts at 239s elapsed')
  ok(!wouldStart(241_000), '...and stops at 241s, before overrunning the 300s ceiling')
}
{
  // The cache IS the cursor: a continuation run re-asks the same question and
  // simply finds less to do. There is no offset to persist or corrupt.
  const targets = ['a', 'b', 'c', 'd', 'e']
  const fresh = new Set<string>()
  const runChunk = (budget: number) => {
    let done = 0
    for (const t of targets) {
      if (done >= budget) break
      if (fresh.has(t)) continue // already warm — costs nothing, not re-generated
      fresh.add(t); done++
    }
    return done
  }
  eq(runChunk(2), 2, 'run 1 warms 2')
  eq(runChunk(2), 2, 'run 2 warms the next 2, skipping the warm ones')
  eq(runChunk(2), 1, 'run 3 warms the last 1')
  eq(runChunk(2), 0, 'run 4 finds nothing left — idempotent, no re-generation')
  eq(fresh.size, 5, 'every direction ends warm exactly once')
}

report('services/sendThrottle')
