/**
 * Structural guards for the Founding Member flow.
 * Run: npx tsx lib/promo/__tests__/promoRoutes.test.ts
 *
 * These failures are not logic bugs — they are shape bugs that would be invisible
 * in review: a hardcoded city, a non-atomic activation, a purchase row, a CTA
 * edit, or the flag ceasing to be a real kill switch.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

const root = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/** assert about CODE, not the prose that explains it */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const chokepoint = code('app/onboarding/membership/page.tsx')
const offerPage = code('app/founding-member/page.tsx')
const offerUi = code('app/founding-member/FoundingOffer.tsx')
const confirmUi = code('app/founding-member/FoundingConfirmation.tsx')
const actions = code('app/founding-member/actions.ts')
const config = code('lib/promo/config.ts')

function main() {
  // ── the activation is a grant, not a purchase ───────────────────────────
  ok(!/purchases/.test(actions), 'activation never writes a purchases row')
  ok(!/lemonsqueezy|lemon_squeezy|checkout/i.test(actions), 'activation never touches the payment processor')
  ok(!/amount|order_id|external_order/i.test(actions), 'no transaction fields are written')

  // ── the write is atomic and cannot touch a paid member ──────────────────
  ok(/\.eq\('membership_tier', 'free'\)/.test(actions), "claims only where tier is 'free'")
  ok(/\.is\('plus_source', null\)/.test(actions), 'claims only where no promo has been taken')
  eq((actions.match(/\.update\(\{[\s\S]*?membership_tier: 'plus'/g) ?? []).length, 1,
    'exactly one statement can grant HAEVN+')
  ok(/plus_source: FOUNDING_MEMBER_PROMO/.test(actions), 'plus_source marks the grant as promo, not paid')
  ok(/plus_activated_at/.test(actions) && /membership_expires_at/.test(actions),
    'both the start and the existing expiry column are set')
  ok(!/plus_expires_at/.test(actions), 'no second expiry column — membership_expires_at is the one')

  // ── the choke point ──────────────────────────────────────────────────────
  ok(/redirect\(/.test(chokepoint) && /founding-member/.test(chokepoint), 'eligible members are redirected to the offer')
  ok(/MembershipPlans/.test(chokepoint), 'ineligible members get the existing paid page')
  ok(/emitCtaClicked/.test(chokepoint), 'the CTA event fires here')
  const emitIdx = chokepoint.indexOf('emitCtaClicked')
  const redirIdx = chokepoint.indexOf('redirect(`/founding-member')
  ok(emitIdx > -1 && redirIdx > -1 && emitIdx < redirIdx,
    'the CTA event is emitted BEFORE the redirect, so eligible members are counted too')

  // ── ineligible visitors cannot reach the offer by URL ───────────────────
  ok(/redirect\('\/onboarding\/membership'\)/.test(offerPage),
    'a direct visitor who is not eligible is sent to the existing page')
  ok(/decideEligibility/.test(offerPage), 'the offer re-checks eligibility server-side')
  ok(/FoundingConfirmation/.test(offerPage), 'an already-activated member sees the confirmation, not the offer')

  // ── NO HARDCODED CITY ANYWHERE ──────────────────────────────────────────
  const cityWords = /\b(Austin|Portland|Round Rock|Tampa|Salem|Beaverton)\b/
  for (const [name, src] of Object.entries({ chokepoint, offerPage, offerUi, confirmUi, actions, config })) {
    ok(!cityWords.test(src), `${name} contains no hardcoded city name`)
  }
  ok(/marketDisplayName|cityName/.test(offerUi), 'the city in the copy comes from markets.display_name')

  // ── no member-facing mention of payment problems ────────────────────────
  const forbidden = /payment (issue|problem|unavailable|processor)|cannot (accept|process) payment|checkout (is )?(down|unavailable)|billing (issue|problem)/i
  for (const [name, src] of Object.entries({ offerUi, confirmUi })) {
    ok(!forbidden.test(read(`app/founding-member/${name === 'offerUi' ? 'FoundingOffer' : 'FoundingConfirmation'}.tsx`)),
      `${name} never references payment availability`)
  }

  // ── the copy the client specified ───────────────────────────────────────
  ok(/Founding Member Offer/.test(offerUi), 'eyebrow copy')
  ok(/Your HAEVN\+ upgrade is on us\./.test(offerUi), 'headline copy')
  ok(/Activate HAEVN\+ Free/.test(offerUi), 'CTA copy')
  ok(/months complimentary\. No payment required\./.test(offerUi), 'supporting line copy')
  ok(/Welcome to HAEVN\+/.test(confirmUi), 'confirmation headline')
  ok(/You&rsquo;re upgraded\./.test(confirmUi), 'confirmation subhead')
  ok(/Continue to HAEVN/.test(confirmUi) && /dashboard\/matches/.test(confirmUi),
    'confirmation CTA goes to the matches dashboard')
  ok(/benefits\.map/.test(offerUi), 'benefits are rendered from the imported list')
  ok(/PLUS_BENEFITS/.test(read('app/founding-member/page.tsx')),
    'benefits are IMPORTED from the membership page, never duplicated')

  // ── flags are server-only and default closed ────────────────────────────
  ok(!/NEXT_PUBLIC_/.test(config), 'no promo flag is exposed to the browser bundle')
  ok(/=== 'true'/.test(config), 'flags are opt-in: anything but the exact string is off')

  // ── NO CTA WAS EDITED ───────────────────────────────────────────────────
  // Every upgrade CTA still points at the choke point; the promo is reached only
  // by redirect. If a future change points a CTA straight at /founding-member,
  // the kill switch stops working for that surface — so fail here.
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const f of readdirSync(join(root, dir))) {
      const rel = `${dir}/${f}`
      if (statSync(join(root, rel)).isDirectory()) walk(rel, out)
      else if (/\.tsx?$/.test(f)) out.push(rel)
    }
    return out
  }
  // The choke point is the ONLY file permitted to name the promo route — that is
  // precisely what makes the kill switch total.
  const ALLOWED = new Set(['app/onboarding/membership/page.tsx'])
  const offenders = [...walk('app'), ...walk('components')]
    .filter((f) => !f.startsWith('app/founding-member/') && !ALLOWED.has(f))
    .filter((f) => /["'`]\/founding-member/.test(read(f)))
  eq(offenders, [], 'no CTA links directly to /founding-member — everything routes through the choke point')

  report('founding-promo-routes')
}
main()
