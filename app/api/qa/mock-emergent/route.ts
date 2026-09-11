/**
 * Mock Emergent receiver — QA harness only. NEVER active in production.
 *
 * Stands in for the client's Emergent endpoint so the Meetup Spots push can be
 * exercised end to end in a preview deployment without the real URL existing and
 * without production ever being configured to push anywhere.
 *
 * THREE INDEPENDENT GATES, all of which must pass:
 *   1. QA_HARNESS_ENABLED === 'true'  — never set in production.
 *   2. A QA secret on the request     — QA_HARNESS_SECRET, constant-time compared.
 *   3. HMAC verification of the body  — exactly how Emergent is specified to
 *      verify us, so a signature bug fails HERE rather than silently at the
 *      client months later.
 *
 * Gate 1 is checked first and returns 404, not 403: in production this route
 * should be indistinguishable from one that does not exist.
 *
 * POST  — receive a push. `?fail=1` forces a 500 AFTER verification, so retry and
 *         error-logging behaviour can be tested against a request that was
 *         otherwise valid. `?fail=auth` forces a 401 instead (bad-secret path).
 * GET   — read back what was received, for the QA agent. Newest first.
 * DELETE— clear received records for this harness run.
 *
 * Storage is system_events rows of type QA_MEETUP_RECEIVED — deliberately not a
 * new table, so the harness needs no migration. The teardown script removes them
 * by event_type.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { qaHarnessEnabled, QA_RECEIVED_EVENT } from '@/lib/meetup/qaFixtures'
import { findForbiddenKeys, type MeetupFeedPayload } from '@/lib/meetup/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** In production this route must look like it does not exist. */
const NOT_FOUND = () => new NextResponse('Not Found', { status: 404 })

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** Shared-secret check. Header preferred; query param accepted for the browser agent's GET. */
function qaSecretOk(request: NextRequest): boolean {
  const expected = process.env.QA_HARNESS_SECRET || ''
  if (!expected) return false // unset secret never authorises anything
  const provided =
    request.headers.get('x-qa-secret') ||
    request.nextUrl.searchParams.get('qa_secret') ||
    ''
  return constantTimeEquals(provided, expected)
}

/**
 * Verify the push signature the way the client's receiver is specified to:
 * sha256 HMAC over `${timestamp}.${rawBody}`, sent as `sha256=<hex>`.
 * Mirrors pushMeetupFeed in lib/meetup/buildFeed.ts.
 */
function verifySignature(rawBody: string, timestamp: string, signature: string, secret: string) {
  if (!timestamp) return { ok: false, reason: 'missing X-HAEVN-Timestamp' }
  if (!signature) return { ok: false, reason: 'missing X-HAEVN-Signature' }
  if (!secret) return { ok: false, reason: 'receiver has no MEETUP_FEED_PUSH_SECRET configured' }

  const expected = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`
  if (!constantTimeEquals(signature, expected)) return { ok: false, reason: 'signature mismatch' }

  // Replay window. Emergent would reasonably reject a stale timestamp; 10
  // minutes is generous for a nightly cron and still bounded.
  const skewSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (!Number.isFinite(skewSec)) return { ok: false, reason: 'unparseable timestamp' }
  if (skewSec > 600) return { ok: false, reason: `timestamp skew ${skewSec}s exceeds 600s` }

  return { ok: true, reason: 'verified' }
}

export async function POST(request: NextRequest) {
  if (!qaHarnessEnabled()) return NOT_FOUND()

  const failMode = request.nextUrl.searchParams.get('fail')

  // Forced auth failure, for testing the sender's error path.
  if (failMode === 'auth') {
    return NextResponse.json({ ok: false, error: 'forced auth failure (fail=auth)' }, { status: 401 })
  }
  if (!qaSecretOk(request)) {
    return NextResponse.json({ ok: false, error: 'bad or missing QA secret' }, { status: 401 })
  }

  const rawBody = await request.text()
  const verdict = verifySignature(
    rawBody,
    request.headers.get('x-haevn-timestamp') ?? '',
    request.headers.get('x-haevn-signature') ?? '',
    process.env.MEETUP_FEED_PUSH_SECRET || ''
  )

  let payload: MeetupFeedPayload | null = null
  let parseError: string | null = null
  try {
    payload = JSON.parse(rawBody)
  } catch (e) {
    parseError = (e as Error)?.message ?? 'unparseable JSON'
  }

  // The receiver independently re-runs the privacy allowlist. If a field ever
  // escapes the sender, it is caught at the boundary rather than trusted.
  const forbiddenKeys = payload ? findForbiddenKeys(payload) : []

  const record = {
    received_at: new Date().toISOString(),
    signature_valid: verdict.ok,
    signature_reason: verdict.reason,
    parse_error: parseError,
    forbidden_keys: forbiddenKeys,
    snapshot_date: payload?.snapshot_date ?? null,
    generated_at: payload?.generated_at ?? null,
    pair_count: payload?.pair_count ?? null,
    pairs_length: Array.isArray(payload?.pairs) ? payload!.pairs.length : null,
    body_bytes: rawBody.length,
    forced_failure: failMode === '1',
    // The payload itself is anonymized by contract, so storing it is safe and is
    // the whole point — the QA agent reads it back to inspect the records.
    payload,
  }

  try {
    await createAdminClient()
      .from('system_events')
      .insert({ event_type: QA_RECEIVED_EVENT, triggered_by: 'qa_harness', metadata: record })
  } catch (e) {
    console.error('[qa/mock-emergent] store failed:', (e as Error)?.message)
  }

  if (!verdict.ok) {
    return NextResponse.json({ ok: false, error: `signature rejected: ${verdict.reason}` }, { status: 401 })
  }

  // Forced server failure AFTER a valid receipt — the request was good, the
  // receiver broke. This is the case that exercises the sender's error logging.
  if (failMode === '1') {
    return NextResponse.json({ ok: false, error: 'forced receiver failure (fail=1)' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    received: { snapshot_date: record.snapshot_date, pair_count: record.pair_count },
  })
}

export async function GET(request: NextRequest) {
  if (!qaHarnessEnabled()) return NOT_FOUND()
  if (!qaSecretOk(request)) {
    return NextResponse.json({ ok: false, error: 'bad or missing QA secret' }, { status: 401 })
  }

  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 5) || 5, 25)
  const full = request.nextUrl.searchParams.get('full') === '1'

  const { data, error } = await createAdminClient()
    .from('system_events')
    .select('id, created_at, metadata')
    .eq('event_type', QA_RECEIVED_EVENT)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const received = (data ?? []).map((r: any) => {
    const m = r.metadata ?? {}
    // Default to a summary — a full payload is large and the agent usually only
    // needs the verdict. ?full=1 returns the records themselves.
    const { payload, ...summary } = m
    return {
      id: r.id,
      ...summary,
      ...(full ? { payload } : { sample_pair: payload?.pairs?.[0] ?? null }),
    }
  })

  return NextResponse.json({ ok: true, count: received.length, received })
}

export async function DELETE(request: NextRequest) {
  if (!qaHarnessEnabled()) return NOT_FOUND()
  if (!qaSecretOk(request)) {
    return NextResponse.json({ ok: false, error: 'bad or missing QA secret' }, { status: 401 })
  }
  const { error } = await createAdminClient()
    .from('system_events')
    .delete()
    .eq('event_type', QA_RECEIVED_EVENT)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, cleared: true })
}
