/** Tier predicate. Run: npx tsx lib/partnership/__tests__/tier.test.ts */
import { isPaidTier, normalizeTier, isFreeTier } from '../tier'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

function main() {
  // the canonical value after 055
  ok(isPaidTier('plus'), "'plus' is paid")
  // the value that was live in production until 055 — must never stop working
  ok(isPaidTier('pro'), "'pro' is STILL paid after canonicalization")
  ok(isPaidTier('select'), "'select' (legacy, from the 001 enum) is paid")
  ok(!isPaidTier('free'), "'free' is not paid")

  // fail closed
  ok(!isPaidTier(null), 'null is not paid')
  ok(!isPaidTier(undefined), 'undefined is not paid')
  ok(!isPaidTier(''), 'empty string is not paid')
  ok(!isPaidTier('zzz_not_a_tier'), 'an unrecognised value is not paid (fail closed)')

  // tolerant of storage noise
  ok(isPaidTier('PLUS'), 'casing is tolerated')
  ok(isPaidTier('  pro  '), 'whitespace is tolerated')

  eq(normalizeTier('pro'), 'plus', "'pro' normalizes to 'plus'")
  eq(normalizeTier('plus'), 'plus', "'plus' normalizes to itself")
  eq(normalizeTier('free'), 'free', "'free' normalizes to 'free'")
  eq(normalizeTier(null), 'free', 'null normalizes to free')

  ok(isFreeTier('free') && isFreeTier(null), 'isFreeTier is the inverse')
  ok(!isFreeTier('pro'), "isFreeTier('pro') is false — the bug this module fixes")

  // the exact shape of the usePartnerStats bug
  const buggy = (t: string) => t === 'plus' || t === 'select'
  ok(buggy('pro') === false && isPaidTier('pro') === true,
    'the old inline check misread a paid pro member; the predicate does not')

  report('tier-predicate')
}
main()
