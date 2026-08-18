/**
 * Salted pair id. Run: npx tsx lib/meetup/__tests__/pairId.test.ts
 *
 * Locks: stable per pair, direction-independent, salt-dependent, and never the
 * raw partnership ids.
 */
import { computePairId } from '../pairId'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const A = '11111111-1111-1111-1111-111111111111'
const B = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
const SALT = 'test-salt-value'

const id1 = computePairId(A, B, SALT)
const id2 = computePairId(B, A, SALT) // reversed order
eq(id1, id2, 'direction-independent (canonicalized)')
eq(computePairId(A, B, SALT), id1, 'stable for same inputs + salt')
ok(computePairId(A, B, 'different-salt') !== id1, 'salt-dependent (unlinkable without salt)')
ok(/^[0-9a-f]{64}$/.test(id1), 'hex sha256 shape')
ok(!id1.includes(A) && !id1.includes(B), 'raw partnership ids never appear in the token')

report('meetup/pairId')
