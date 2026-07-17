/**
 * Scope resolution — the city→market join reused from lib/markets/releaseGate.
 * Run: npx tsx lib/metrics/__tests__/scope.test.ts
 * Uses a synthetic MarketIndex, so no DB. dotenv only so importing releaseGate
 * (which pulls the admin client factory) never trips on missing env at load.
 */
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true } as any)

import { resolveMarket, isCityLive, type MarketIndex } from '../../markets/releaseGate'
import { eq, report } from './_assert'

const AUSTIN = 'Austin–Round Rock MSA' // note: en-dash, not hyphen
const idx: MarketIndex = {
  cityToMarket: new Map([
    ['austin', AUSTIN],
    ['round rock', AUSTIN],
    ['portland', 'Portland-Vancouver-Hillsboro MSA'],
  ]),
  liveMarkets: new Set([AUSTIN]),
  ok: true,
}

// Known city, exact.
eq(resolveMarket('austin', idx), AUSTIN, 'lowercase austin resolves')
// Casing — the ide_selection edge case: 'AUSTIN' must resolve via LOWER join.
eq(resolveMarket('AUSTIN', idx), AUSTIN, 'UPPERCASE AUSTIN resolves (casing)')
eq(resolveMarket('Austin', idx), AUSTIN, 'TitleCase Austin resolves')
// Whitespace is trimmed by normalizeCity.
eq(resolveMarket('  Austin  ', idx), AUSTIN, 'whitespace trimmed')
// A second city in the same market.
eq(resolveMarket('Round Rock', idx), AUSTIN, 'Round Rock → Austin market')

// Unknown city → null (fail closed at resolution).
eq(resolveMarket('Nowhere', idx), null, 'unknown city → null')
eq(resolveMarket(null, idx), null, 'null city → null')
eq(resolveMarket('', idx), null, 'empty city → null')

// Live gating.
eq(isCityLive('Austin', idx), true, 'Austin is live')
eq(isCityLive('Portland', idx), false, 'Portland resolves but is NOT live')
eq(isCityLive('Nowhere', idx), false, 'unknown city not live (fail closed)')

// Bad index → fail closed regardless of city.
const badIdx: MarketIndex = { cityToMarket: new Map(), liveMarkets: new Set(), ok: false }
eq(isCityLive('Austin', badIdx), false, 'unreadable index → fail closed')

report('scope')
