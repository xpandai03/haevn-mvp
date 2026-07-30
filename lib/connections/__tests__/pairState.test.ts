/**
 * Recommendation accept state machine + reveal gate. Run:
 *   npx tsx lib/connections/__tests__/pairState.test.ts
 */
import {
  derivePairState, canProceed, canDecline, classifyProceed, decideProceedSideEffect,
  canonicalPartnershipPair, type PairFacts,
} from '../pairState'
import { canAccessConnection } from '../canAccessConnection'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const A = 'aaaaaaaa-0000-0000-0000-000000000001'
const B = 'bbbbbbbb-0000-0000-0000-000000000002'

// viewer=A, counterpart=B by default
function facts(o: Partial<PairFacts> = {}): PairFacts {
  return {
    viewerId: A, counterpartId: B,
    signallers: new Set<string>(),
    viewerHidLive: false, handshakeMatched: false, expired: false,
    ...o,
  }
}

function main() {
  // ── canonical pair: (A,B) == (B,A) ──
  const p1 = canonicalPartnershipPair(A, B)
  const p2 = canonicalPartnershipPair(B, A)
  eq(p1, p2, 'canonical pair is order-independent')
  ok(p1.partnership_smaller < p1.partnership_larger, 'smaller < larger')

  // ── derivePairState: every transition ──
  eq(derivePairState(facts()), 'none', 'no action → none')
  eq(derivePairState(facts({ signallers: new Set([A]) })), 'waiting', 'viewer proceeded → waiting')
  eq(derivePairState(facts({ signallers: new Set([B]) })), 'their_turn', 'counterpart proceeded → their_turn')
  eq(derivePairState(facts({ signallers: new Set([A, B]) })), 'connected', 'both proceeded → connected')
  eq(derivePairState(facts({ handshakeMatched: true })), 'connected', 'handshake exists → connected')
  eq(derivePairState(facts({ viewerHidLive: true })), 'declined_by_me', 'viewer hid → declined_by_me')
  eq(derivePairState(facts({ expired: true })), 'expired', 'expired + no action → expired')

  // ── SENDER PRIVACY: counterpart decline never surfaces to the proceeder ──
  // There is no "counterpart declined" input at all. A proceeded; whatever B did,
  // A stays 'waiting' — never 'declined'.
  eq(derivePairState(facts({ signallers: new Set([A]) })), 'waiting',
    'A proceeded, B declined (unmodeled) → A still waiting (privacy)')
  eq(derivePairState(facts({ signallers: new Set([A]), expired: true })), 'waiting',
    'A proceeded then pair expired → still waiting (privacy neutral, never expired/declined)')

  // ── connected precedence over everything ──
  eq(derivePairState(facts({ handshakeMatched: true, viewerHidLive: true, expired: true })), 'connected',
    'handshake wins over hide/expired')

  // ── canProceed guards ──
  eq(canProceed(facts()), null, 'proceed on none → ok')
  eq(canProceed(facts({ signallers: new Set([A]) })), null, 're-proceed when waiting → ok (idempotent)')
  eq(canProceed(facts({ signallers: new Set([B]) })), null, 'proceed when their_turn → ok (creates mutual)')
  eq(canProceed(facts({ viewerHidLive: true })), 'declined_by_me', 'proceed after own decline → rejected')
  eq(canProceed(facts({ expired: true })), 'expired', 'proceed on expired → rejected')
  eq(canProceed(facts({ handshakeMatched: true })), 'already_connected', 'proceed after mutual → rejected')
  eq(canProceed(facts({ signallers: new Set([A, B]) })), 'already_connected', 'proceed when both signalled → rejected')

  // ── canDecline guards ──
  eq(canDecline(facts()), null, 'decline on none → ok')
  eq(canDecline(facts({ signallers: new Set([A]) })), 'already_proceeded', 'decline after own proceed → rejected (proceed is final)')
  eq(canDecline(facts({ signallers: new Set([B]) })), null, 'decline when their_turn → ok')
  eq(canDecline(facts({ handshakeMatched: true })), 'already_connected', 'decline after mutual → rejected')
  eq(canDecline(facts({ expired: true })), 'expired', 'decline on expired → rejected')

  // ── classifyProceed: first vs mutual ──
  eq(classifyProceed(new Set([A]), A, B), 'first_proceed', 'only viewer signalled → first_proceed (notify)')
  eq(classifyProceed(new Set([A, B]), A, B), 'mutual', 'both signalled → mutual (handshake)')

  // ── decideProceedSideEffect: the exactly-once rule ──
  const de = (o: Partial<Parameters<typeof decideProceedSideEffect>[0]>) =>
    decideProceedSideEffect({ band: 'rec', isDuplicate: false, signallersAfter: new Set([A]), viewerId: A, counterpartId: B, ...o })
  eq(de({}), 'notify_counterpart', 'fresh rec first proceed → notify ONCE')
  eq(de({ signallersAfter: new Set([A, B]) }), 'create_handshake', 'fresh rec mutual → handshake ONCE')
  eq(de({ isDuplicate: true }), 'none', 'rec retry (duplicate insert) → NO side effect (exactly-once)')
  eq(de({ isDuplicate: true, signallersAfter: new Set([A, B]) }), 'none', 'rec mutual retry → NO duplicate handshake')
  eq(de({ band: 'match' }), 'none', 'match band → NO side effect (match behavior untouched)')
  eq(de({ band: null }), 'none', 'no band (matches button) → NO side effect')
  eq(de({ band: 'match', signallersAfter: new Set([A, B]) }), 'none', 'match mutual → NO handshake (RTM stays a pure signal on matches)')

  // ── reveal gate: both tiers + expiry ──
  const NOW = new Date('2026-07-27T00:00:00Z')
  ok(!canAccessConnection({ membership_tier: 'free' }, NOW), 'free → no access (connected_unrevealed)')
  ok(canAccessConnection({ membership_tier: 'plus' }, NOW), 'plus → access')
  ok(canAccessConnection({ membership_tier: 'pro' }, NOW), 'pro (live DB value) → access (tier-tolerant)')
  ok(canAccessConnection({ membership_tier: 'select' }, NOW), 'select → access')
  ok(!canAccessConnection(null, NOW), 'no partnership → no access')
  ok(!canAccessConnection({ membership_tier: 'plus', membership_expires_at: '2026-07-01T00:00:00Z' }, NOW),
    'paid but expired → no access')
  ok(canAccessConnection({ membership_tier: 'plus', membership_expires_at: '2036-01-01T00:00:00Z' }, NOW),
    'paid, future expiry → access')
  ok(canAccessConnection({ membership_tier: 'pro', membership_expires_at: 'not-a-date' }, NOW),
    'unparseable expiry → fail-open (access kept)')

  // ── HAPPY PATH walkthrough: proceed → notify → proceed → handshake → gated reveal ──
  {
    const bView = (signallers: Set<string>, hs = false) =>
      derivePairState({ viewerId: B, counterpartId: A, signallers, viewerHidLive: false, handshakeMatched: hs, expired: false })

    // Step 1 — A proceeds (fresh, rec): notify B once; A sees waiting.
    let signallers = new Set([A])
    eq(decideProceedSideEffect({ band: 'rec', isDuplicate: false, signallersAfter: signallers, viewerId: A, counterpartId: B }),
      'notify_counterpart', 'HP1: A proceeds → notify B (once)')
    eq(derivePairState(facts({ signallers })), 'waiting', 'HP1: A sees waiting')
    eq(bView(signallers), 'their_turn', 'HP1: B (notified) sees their_turn')

    // Step 2 — B proceeds (fresh, rec): mutual → create handshake once.
    signallers = new Set([A, B])
    eq(decideProceedSideEffect({ band: 'rec', isDuplicate: false, signallersAfter: signallers, viewerId: B, counterpartId: A }),
      'create_handshake', 'HP2: B proceeds → handshake (once)')

    // Step 3 — both connected (handshake exists).
    eq(derivePairState(facts({ signallers, handshakeMatched: true })), 'connected', 'HP3: A sees connected')
    eq(bView(signallers, true), 'connected', 'HP3: B sees connected')

    // Step 4 — gated reveal splits by tier.
    ok(!canAccessConnection({ membership_tier: 'free' }, NOW), 'HP4: free → connected_unrevealed')
    ok(canAccessConnection({ membership_tier: 'plus' }, NOW), 'HP4: paid → revealed')

    // Idempotency — A retries the proceed: no duplicate side effect.
    eq(decideProceedSideEffect({ band: 'rec', isDuplicate: true, signallersAfter: signallers, viewerId: A, counterpartId: B }),
      'none', 'HP: retry → no duplicate notification/handshake')

    // Sender privacy — replay with B having declined instead of proceeded:
    // A still sees waiting, never learns.
    eq(derivePairState(facts({ signallers: new Set([A]) })), 'waiting', 'HP: A never learns B declined')
  }

  report('pairState')
}

main()
