/**
 * Failure handling: the alert goes out on the FIRST failure, concurrently with
 * retry 1 — never after exhaustion — once per episode, plus recovered /
 * exhausted emails and the backstop's stalled-lease path.
 * Run: npx tsx lib/goose/__tests__/retryAlert.test.ts
 */
import { eq, ok, report } from '@/lib/metrics/__tests__/_assert'
import { buildAlertEmail, parseAlertRecipients } from '../alerts'
import { createCohort, finalizeCohort } from '../cohorts'
import { runGooseBackstop, runGooseCompute } from '../run'
import { associateAll, mid, solo } from './fixtures'
import { createMemoryRepo } from './memoryRepo'

const RECIPIENTS = 'rik@qa.haevn.invalid, raunek@qa.haevn.invalid'
const noSleep = async () => {}

async function readyCohort(n = 4, startsAt = '2099-01-01T00:00:00Z') {
  const repo = createMemoryRepo()
  for (let i = 0; i < n; i++) repo.seed(solo(i))
  const c = await createCohort(repo, { goose_event_id: `evt-${Math.random()}`, event_name: 'TEST <b>event</b>', event_starts_at: startsAt })
  const id = c.ok ? c.haevn_cohort_id : ''
  await associateAll(repo, id, Array.from({ length: n }, (_, i) => mid(i)))
  await finalizeCohort(repo, id, Array.from({ length: n }, (_, i) => mid(i)))
  return { repo, id }
}

async function main() {
  eq(parseAlertRecipients(' A@x.io, b@y.io ,, not-an-email, a@x.io'), ['a@x.io', 'b@y.io'], 'recipients parsed, deduped, junk dropped')
  ok(!buildAlertEmail('failure', { cohort: { id: 'c', goose_event_id: 'e', event_name: '<script>x</script>', event_starts_at: 's', compute_attempts: 1 } }).html.includes('<script>'), 'partner-supplied event name is HTML-escaped')

  // ── Killed mid-run: ONE alert, fired together with retry 1 ─────────────────
  {
    const { repo, id } = await readyCohort()
    repo.failNext('upsertResults', 1, 'connection reset mid-write') // attempt 1 dies mid-run
    const sends: Array<{ to: string; at: number; subject: string }> = []
    let retry1Started = false
    let alertSawRetry1InFlight = false
    repo.onClaimLease = (attempt) => {
      if (attempt === 2) retry1Started = true
    }
    // The transport only resolves after retry 1 has begun. If the orchestrator
    // awaited the alert before retrying, this would deadlock → test hangs/fails.
    const transport = async (to: string, subject: string) => {
      if (subject.includes('Compute failed')) {
        for (let i = 0; i < 50 && !retry1Started; i++) await new Promise((r) => setTimeout(r, 2))
        if (retry1Started) alertSawRetry1InFlight = true
      }
      sends.push({ to, at: repo.leaseClaims, subject })
      return true
    }
    const r = await runGooseCompute(repo, id, { transport, recipients: RECIPIENTS, sleep: noSleep })
    eq(r.outcome.kind, 'ready', 'retry 1 recovers the cohort')
    eq(r.alert, 'sent', 'failure alert sent')
    ok(alertSawRetry1InFlight, 'alert and retry 1 ran concurrently (retry started before the alert completed)')
    const failureSends = sends.filter((s) => s.subject.includes('Compute failed'))
    eq(failureSends.length, 2, 'one failure email to each of the 2 recipients')
    ok(failureSends.every((s) => s.at <= 2), 'failure alert went out by retry 1 — not after exhaustion')
    eq(sends.filter((s) => s.subject.includes('Recovered')).length, 2, 'recovered email after success')
    eq(r.recovered, true, 'recovered flagged')
    eq(repo.cohorts.get(id)!.status, 'ready', 'cohort ready')
  }

  // ── Persistent failure: still exactly one failure email, backstop scheduled ─
  {
    const { repo, id } = await readyCohort()
    repo.failNext('loadScorableMembers', 99, 'db down')
    const sends: string[] = []
    const r = await runGooseCompute(repo, id, { transport: async (_to, s) => (sends.push(s), true), recipients: RECIPIENTS, sleep: noSleep })
    eq(r.outcome.kind, 'failed', 'all in-run attempts fail')
    eq(r.attempts, 4, 'attempt + immediate retry 1 + 2 delayed retries')
    eq(sends.filter((s) => s.includes('Compute failed')).length, 2, 'ONE failure email per recipient for the whole episode')
    const c = repo.cohorts.get(id)!
    eq([c.status, c.last_error_code], ['error', 'compute_exception'], 'cohort error + code recorded')
    ok(!!c.next_retry_at, 'handed to the backstop (next_retry_at set)')

    // Backstop tick while still failing: no second failure email.
    repo.cohorts.set(id, { ...c, next_retry_at: new Date(Date.now() - 1000).toISOString() })
    await runGooseBackstop(repo, { transport: async (_to, s) => (sends.push(s), true), recipients: RECIPIENTS, sleep: noSleep })
    eq(sends.filter((s) => s.includes('Compute failed')).length, 2, 'backstop retry does not re-alert the same episode')

    // Backstop tick after the DB recovers → ready + recovered email.
    repo.failNext('loadScorableMembers', 0)
    repo.cohorts.set(id, { ...repo.cohorts.get(id)!, next_retry_at: new Date(Date.now() - 1000).toISOString() })
    const sum = await runGooseBackstop(repo, { transport: async (_to, s) => (sends.push(s), true), recipients: RECIPIENTS, sleep: noSleep })
    eq(sum.became_ready, 1, 'backstop brings the cohort to ready')
    eq(sends.filter((s) => s.includes('Recovered')).length, 2, 'recovered email once')
  }

  // ── Coverage shortfall at completion is a failure too ───────────────────────
  {
    const repo = createMemoryRepo()
    for (let i = 0; i < 3; i++) repo.seed(solo(i))
    repo.seed(solo(3, null))
    const c = await createCohort(repo, { goose_event_id: 'evt-short', event_starts_at: '2099-01-01T00:00:00Z' })
    const id = c.ok ? c.haevn_cohort_id : ''
    await associateAll(repo, id, [mid(0), mid(1), mid(2), mid(3)])
    await finalizeCohort(repo, id, [mid(0), mid(1), mid(2), mid(3)])
    const sends: string[] = []
    const r = await runGooseCompute(repo, id, { transport: async (_to, s) => (sends.push(s), true), recipients: RECIPIENTS, sleep: noSleep, delays: [] })
    ok(r.outcome.kind === 'failed' && r.outcome.code === 'members_missing_survey', 'incompleteness detected')
    eq(sends.length, 2, 'incompleteness alerts immediately')
  }

  // ── Undelivered alert releases the claim so the next failure retries it ────
  {
    const { repo, id } = await readyCohort()
    repo.failNext('loadScorableMembers', 2, 'db down')
    const r = await runGooseCompute(repo, id, { transport: async () => false, recipients: RECIPIENTS, sleep: noSleep, delays: [] })
    eq(r.alert, 'undelivered', 'alert reported undelivered')
    eq(repo.cohorts.get(id)!.alerted_at, null, 'claim released for a later attempt')
    ok(repo.events.some((e) => e.type === 'goose_alert_failed'), 'undelivered alert logged')
    const r2 = await runGooseCompute(repo, id, { transport: async () => false, recipients: '', sleep: noSleep, delays: [] })
    eq(r2.outcome.kind, 'ready', 'no recipients configured never blocks compute')
  }

  // ── Stalled lease (function killed) → backstop alerts + retries together ───
  {
    const { repo, id } = await readyCohort()
    const c = repo.cohorts.get(id)!
    repo.cohorts.set(id, { ...c, compute_lease_until: new Date(Date.now() - 60_000).toISOString(), compute_attempts: 1 })
    const sends: string[] = []
    const sum = await runGooseBackstop(repo, { transport: async (_to, s) => (sends.push(s), true), recipients: RECIPIENTS, sleep: noSleep })
    eq(sum.stalled, 1, 'stalled lease detected')
    eq(sends.filter((s) => s.includes('Compute failed')).length, 2, 'stall alerts')
    eq(repo.cohorts.get(id)!.status, 'ready', 'stall recovered by the paired retry')
  }

  // ── Event started while not ready → one exhausted alert, no more retries ───
  {
    const { repo, id } = await readyCohort(4, '2020-01-01T00:00:00Z')
    repo.cohorts.set(id, { ...repo.cohorts.get(id)!, status: 'error', last_error_code: 'compute_exception' })
    const sends: string[] = []
    const t = { transport: async (_to: string, s: string) => (sends.push(s), true), recipients: RECIPIENTS, sleep: noSleep }
    await runGooseBackstop(repo, t)
    await runGooseBackstop(repo, t)
    eq(sends.filter((s) => s.includes('NOT READY at event start')).length, 2, 'exhausted alert once (2 recipients), not per tick')
    eq(repo.leaseClaims, 0, 'no compute attempted after event start')
  }

  // ── Happy path: no email at all ─────────────────────────────────────────────
  {
    const { repo, id } = await readyCohort()
    const sends: string[] = []
    const r = await runGooseCompute(repo, id, { transport: async (_to, s) => (sends.push(s), true), recipients: RECIPIENTS, sleep: noSleep })
    eq([r.outcome.kind, r.attempts, r.alert, sends.length], ['ready', 1, 'none', 0], 'success on first attempt sends nothing')
  }

  report('goose retry + alert')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
