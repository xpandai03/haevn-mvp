/**
 * Founding Member eligibility matrix + activation semantics.
 * Run: npx tsx lib/promo/__tests__/eligibility.test.ts
 */
import { decideEligibility, hasActivatedPromo, computeExpiry } from '../eligibility'
import { getPromoConfig, isMarketEnabled, isMessagingEnabled, DEFAULT_TERM_MONTHS, type PromoConfig } from '../config'
import { FOUNDING_MEMBER_PROMO, PROMO_EVENTS } from '../constants'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const ON: PromoConfig = { enabled: true, markets: ['austin'], termMonths: 6 }
const OFF: PromoConfig = { ...ON, enabled: false }

const base = { plusSource: null, marketSlug: 'austin', marketDisplayName: 'Austin' }
const decide = (o: Record<string, unknown> = {}) =>
  decideEligibility({ cfg: ON, tier: 'free', ...base, ...o } as any) as any

function main() {
  // ── the matrix: enabled × market × tier ──────────────────────────────────
  ok(decide().eligible, 'enabled + in-market + free -> ELIGIBLE')

  eq(decide({ cfg: OFF }).eligible, false, 'flag off -> ineligible')
  eq(decide({ cfg: OFF }).reason, 'promo_disabled', '...reason promo_disabled')

  eq(decide({ marketSlug: null }).reason, 'no_market', 'unresolved market -> no_market')
  eq(decide({ marketSlug: 'portland' }).reason, 'market_not_enabled',
    'a market that exists but is not in the enabled list -> market_not_enabled')

  for (const t of ['plus', 'pro', 'select']) {
    eq(decide({ tier: t }).reason, 'already_paid', `tier '${t}' -> already_paid, never the promo`)
  }
  eq(decide({ plusSource: FOUNDING_MEMBER_PROMO }).reason, 'already_activated',
    'a row already carrying the promo source -> already_activated')

  // ── ordering: paid wins, so a stale CTA can never reach the offer ────────
  eq(decide({ tier: 'pro', marketSlug: null }).reason, 'already_paid',
    'a paid member with no market still reports already_paid, not no_market')
  eq(decide({ cfg: OFF, tier: 'pro' }).reason, 'promo_disabled',
    'the flag is checked first — nothing else runs when the promo is off')

  eq(decideEligibility({ cfg: { ...ON, markets: [] }, tier: 'free', ...base } as any as any).eligible === false
    ? (decideEligibility({ cfg: { ...ON, markets: [] }, tier: 'free', ...base } as any) as any).reason : 'ELIGIBLE',
    'market_not_enabled', 'empty market list -> nobody eligible')

  // ── term + copy inputs flow through ─────────────────────────────────────
  eq(decide({ cfg: { ...ON, termMonths: 12 } }).termMonths, 12, 'configured term reaches the decision')
  eq(decide().marketDisplayName, 'Austin', 'display name is carried for copy')
  eq(decide({ marketDisplayName: null }).marketDisplayName, '',
    'a missing display name yields empty string — callers drop the city, never a literal')

  // ── config parsing ───────────────────────────────────────────────────────
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

  withEnv({ FOUNDING_PROMO_ENABLED: undefined, FOUNDING_PROMO_MARKETS: undefined, FOUNDING_PROMO_TERM_MONTHS: undefined }, () => {
    const c = getPromoConfig()
    eq(c.enabled, false, 'absent FOUNDING_PROMO_ENABLED -> disabled (default off)')
    eq(c.markets, [], 'absent markets -> empty list')
    eq(c.termMonths, DEFAULT_TERM_MONTHS, 'absent term -> 6 months')
  })
  withEnv({ FOUNDING_PROMO_ENABLED: 'TRUE' }, () => {
    eq(getPromoConfig().enabled, false, "only the exact string 'true' enables the promo")
  })
  withEnv({ FOUNDING_PROMO_ENABLED: 'true', FOUNDING_PROMO_MARKETS: ' Austin , portland ,,' }, () => {
    eq(getPromoConfig().markets, ['austin', 'portland'], 'markets trimmed, lowercased, blanks dropped')
  })
  for (const bad of ['0', '-3', 'abc', '']) {
    withEnv({ FOUNDING_PROMO_TERM_MONTHS: bad }, () => {
      eq(getPromoConfig().termMonths, DEFAULT_TERM_MONTHS, `term '${bad}' falls back to 6, never 0 or NaN`)
    })
  }

  ok(!isMarketEnabled(OFF, 'austin'), 'isMarketEnabled is false whenever the promo is disabled')
  ok(isMarketEnabled(ON, 'AUSTIN '), 'market matching is case/whitespace tolerant')
  ok(!isMarketEnabled(ON, null), 'a null slug is never enabled')

  // ── messaging kill switch ────────────────────────────────────────────────
  withEnv({ MESSAGING_ENABLED: undefined }, () => ok(!isMessagingEnabled(), 'messaging defaults OFF when unset'))
  withEnv({ MESSAGING_ENABLED: 'false' }, () => ok(!isMessagingEnabled(), "'false' keeps messaging closed"))
  withEnv({ MESSAGING_ENABLED: 'true' }, () => ok(isMessagingEnabled(), "'true' opens messaging"))

  // ── confirmation state + expiry ──────────────────────────────────────────
  ok(hasActivatedPromo(FOUNDING_MEMBER_PROMO, FOUNDING_MEMBER_PROMO), 'promo source -> confirmation state')
  ok(!hasActivatedPromo('paid', FOUNDING_MEMBER_PROMO), 'a paid member never sees the promo confirmation')
  ok(!hasActivatedPromo(null, FOUNDING_MEMBER_PROMO), 'null source -> not activated')

  const now = new Date('2026-08-28T12:00:00.000Z')
  eq(computeExpiry(6, now).toISOString(), '2027-02-28T12:00:00.000Z', '6 months from Aug 28 -> Feb 28')
  eq(computeExpiry(12, now).toISOString(), '2027-08-28T12:00:00.000Z', '12 months -> same day next year')
  ok(computeExpiry(6, now).getTime() > now.getTime(), 'expiry is always in the future')

  // ── event + source names are stable (the client reports on these strings) ─
  eq(PROMO_EVENTS.ctaClicked, 'upgrade_cta_clicked', 'CTA event name')
  eq(PROMO_EVENTS.offerViewed, 'founding_offer_viewed', 'offer event name')
  eq(PROMO_EVENTS.activationCompleted, 'founding_activation_completed', 'activation event name')
  eq(FOUNDING_MEMBER_PROMO, 'founding_member_promo', 'plus_source value is stable')

  report('founding-promo-eligibility')
}
main()
