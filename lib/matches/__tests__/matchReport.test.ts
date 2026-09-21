/**
 * Match report (v2) — flag gating, location line, redaction contract, and the
 * render rules that must not regress.
 *
 * Run: npx tsx lib/matches/__tests__/matchReport.test.ts
 *
 * The document itself is a client component; these assert the SERVER-side
 * contracts it renders from, which is where a leak or a false claim would
 * actually originate.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { matchReportV2Enabled } from '../reportFlag'
import type { MatchBreakdownData } from '../getMatchCardData'
import { reportLocation } from '../reportLocation'
import { hasNoIdentityLeak, redactMatchPartnership } from '../redactMatchCard'
import { parseSections, verdictForScore } from '../sectionMapping'
import { staticCopyFor } from '../categoryCopy'
import { MatchReportDocument } from '@/components/matches/report/MatchReport'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

// ═══ the flag ══════════════════════════════════════════════════════════════
ok(!matchReportV2Enabled({} as any), 'absent flag -> v2 OFF (prod unchanged)')
ok(!matchReportV2Enabled({ MATCH_REPORT_V2_ENABLED: 'TRUE' } as any), "only exact 'true' enables it")
ok(!matchReportV2Enabled({ MATCH_REPORT_V2_ENABLED: '1' } as any), "'1' does not enable it")
ok(matchReportV2Enabled({ MATCH_REPORT_V2_ENABLED: 'true' } as any), "'true' enables it")

// ═══ location line — cities only, never miles ══════════════════════════════
eq(reportLocation('Austin', 'Austin'), { label: 'Both in Austin', crossMarket: false }, 'same city')
eq(reportLocation('austin', 'Austin'), { label: 'Both in Austin', crossMarket: false }, 'case-insensitive match')
eq(reportLocation('Austin', 'Portland'), { label: 'Austin & Portland', crossMarket: true }, 'cross-city names both')
eq(reportLocation(null, 'Portland'), { label: 'Portland', crossMarket: false }, 'viewer cityless -> match city alone, no relationship claimed')
eq(reportLocation('Austin', null), { label: null, crossMarket: false }, 'match cityless -> line omitted entirely')
eq(reportLocation(null, null), { label: null, crossMarket: false }, 'both cityless -> omitted')
eq(reportLocation('  Austin  ', 'Austin'), { label: 'Both in Austin', crossMarket: false }, 'whitespace trimmed')
for (const [v, m] of [['Austin', 'Portland'], ['Austin', 'Austin'], [null, 'Portland']] as const) {
  const r = reportLocation(v, m)
  ok(!/mile|mi\b|km/i.test(r.label ?? ''), `no distance unit ever appears (${v} / ${m})`)
}

// ═══ fixtures ══════════════════════════════════════════════════════════════
const BREAKDOWN = [
  { category: 'intent', score: 91, weight: 30, coverage: 0.9, included: true, subScores: [{ key: 'goals', score: 100, reason: 'Shared goals', weight: 50, matched: true, effectiveWeight: 30 }] },
  { category: 'structure', score: 96, weight: 20, coverage: 0.9, included: true, subScores: [] },
  { category: 'connection', score: 84, weight: 20, coverage: 0.9, included: true, subScores: [] },
  { category: 'chemistry', score: 78, weight: 20, coverage: 0.9, included: true, subScores: [] },
  { category: 'lifestyle', score: 73, weight: 10, coverage: 0.9, included: true, subScores: [] },
]
const SECTIONS = parseSections(BREAKDOWN)

const PAYLOAD: any = {
  match_summary: 'Header sub-paragraph about the match.',
  executive_summary: 'Exec summary.',
  why_this_introduction: { what_aligns: 'WHAT-ALIGNS-TEXT', what_differs: 'WHAT-DIFFERS-TEXT', the_verdict: 'THE-VERDICT-TEXT' },
  strongest_areas: [], nudge_compatibility_highlights: [],
  sections: SECTIONS.map((s) => ({
    category: s.displayName, classification: s.band.label,
    overview: `OVERVIEW-${s.key}`, your_alignment: `ALIGN-${s.key}`, where_you_differ: `DIFFER-${s.key}`,
    interpretation: `READ-${s.key}`, alignments: [], differences: [],
  })),
  worth_talking_about: { items: ['WTA-1', 'WTA-2', 'WTA-3'], closing: 'WTA-CLOSING' },
  signals_that_mattered: ['CHIP-1', 'CHIP-2', 'CHIP-3', 'CHIP-4', 'CHIP-5', 'CHIP-6'],
  what_haevn_thinks_you_should_know: { strongest_reason: 'r', most_meaningful_difference: 'd', haevn_assessment: 'a' },
  conversation_starters: ['STARTER-1', 'STARTER-2', 'STARTER-3'],
  closing_read: { verdict: 'INTRODUCTION RECOMMENDED', statement: 'CLOSING-STATEMENT-TEXT' },
}

const base = (over: Partial<MatchBreakdownData> = {}): MatchBreakdownData => ({
  matchId: 'm-1', matchScore: 84, type: 'match', state: 'unlocked',
  badge: { band: 'strong', label: 'STRONG MATCH' },
  identity: {
    nameToken: 'D***', displayName: 'Darius', age: 35, photoUrl: 'https://cdn.test/photo.jpg',
    demographics: 'Man · Straight · Monogamous', city: 'Austin',
    gender: 'Man', orientation: 'Straight', structure: 'Monogamous',
  },
  sections: SECTIONS, interpretation: PAYLOAD, degraded: false,
  reportV2: true, viewerCity: 'Austin', matchVerified: false, interpretationPending: false,
  ...over,
})
const render = (d: MatchBreakdownData, expandAll = false) =>
  renderToStaticMarkup(React.createElement(MatchReportDocument, { data: d, onBack: () => {}, onUpgrade: () => {}, expandAll }))

// ═══ paid view renders the whole document ══════════════════════════════════
{
  const html = render(base())
  for (const marker of ['HAEVN MATCH REPORT', 'YOUR MATCH', 'PROFILE AT A GLANCE',
    'Why HAEVN Made This Introduction', 'Compatibility Breakdown', 'Worth Talking About',
    'The Signals That Mattered', 'Conversation Starters', 'HAEVN'])
    ok(html.includes(marker), `paid document renders "${marker}"`)
  ok(html.includes('WHAT-ALIGNS-TEXT') && html.includes('THE-VERDICT-TEXT'), '§02 renders all three paragraphs')
  for (const s of SECTIONS) ok(html.includes(`OVERVIEW-${s.key}`), `${s.displayName} summary renders`)
  ok(html.includes('WTA-1') && html.includes('WTA-CLOSING'), '§04 renders items + closing')
  for (let i = 1; i <= 6; i++) ok(html.includes(`CHIP-${i}`), `§05 chip ${i} renders`)
  ok(html.includes('STARTER-1'), '§06 renders for a PAID viewer')
  ok(html.includes('CLOSING-STATEMENT-TEXT'), 'closing read renders')
  ok(html.includes('84% MATCH · INTRODUCTION RECOMMENDED'), 'verdict strip renders score + verdict')
  ok(html.includes('Both in Austin'), 'same-city location line renders')
  ok(!html.includes('§ 01') && !/About Darius/.test(html), '§01 About is NOT rendered (cut for v1)')
  ok(!/\bmiles?\b/i.test(html), 'no mileage anywhere in the document')
}

// ═══ FREE VIEW — the redaction contract ════════════════════════════════════
{
  const free = base({
    state: 'standard',
    identity: { ...base().identity, displayName: null, photoUrl: null },
  })
  const html = render(free)
  ok(!html.includes('Darius'), 'free view never renders the real name')
  ok(!html.includes('cdn.test/photo.jpg'), 'free view never renders a photo URL')
  ok(html.includes('D***'), '...it renders the redacted initial token instead')
  ok(html.includes('Your 84% Match with D***'), 'the title uses the token')
  // Analysis stays fully visible — the gate is identity, not understanding.
  ok(html.includes('WHAT-ALIGNS-TEXT'), 'free view keeps §02')
  ok(html.includes('OVERVIEW-goals_expectations'), 'free view keeps the category analysis')
  ok(html.includes('CHIP-1'), 'free view keeps §05')
  ok(html.includes('CLOSING-STATEMENT-TEXT'), 'free view keeps the closing read')
  // ...but the action surface is gated.
  ok(!html.includes('STARTER-1'), 'conversation starters are HIDDEN for a free viewer')
  ok(!html.includes('Conversation Starters'), '...including the heading')
  ok(/Become a HAEVN\+ member/i.test(html), 'the membership CTA renders for a free viewer')
  // Same assertion the API-level redaction tests use.
  ok(hasNoIdentityLeak(redactMatchPartnership(
    { display_name: 'Darius', first_name: 'Darius', photo_url: 'https://cdn.test/p.jpg', short_bio: 'bio', connection_summary: 'cs' },
    true
  )), 'the shared redaction transform still yields no identity leak')
}
{
  const paid = render(base())
  ok(paid.includes('Darius'), 'a PAID viewer does see the real name')
  ok(paid.includes('cdn.test/photo.jpg'), '...and the photo')
}

// ═══ Veriff renders ONLY for verified members ══════════════════════════════
{
  const unverified = render(base({ matchVerified: false }))
  ok(!/Veriff/i.test(unverified), 'unverified member: NO Veriff claim anywhere')
  ok(!/Identity confirmed/i.test(unverified), '...and no confirmation line')
  const verified = render(base({ matchVerified: true }))
  ok(/Identity confirmed via Veriff/.test(verified), 'verified member: the Veriff line renders')
}

// ═══ degradation — never an error, never a blank ═══════════════════════════
{
  const pendingDoc = render(base({ interpretation: null, degraded: true, interpretationPending: true }))
  ok(pendingDoc.includes('being prepared'), 'missing interpretation shows the prepared state')
  ok(pendingDoc.includes('Compatibility Breakdown'), '...the document skeleton still renders')
  // renderToStaticMarkup escapes '&', so compare against the escaped form.
  const esc = (x: string) => x.replace(/&/g, '&amp;')
  for (const s of SECTIONS) ok(pendingDoc.includes(esc(s.displayName)), `${s.displayName} still renders with its score`)
  ok(pendingDoc.includes('91%') && pendingDoc.includes('73%'), 'engine scores still render without AI')
  ok(pendingDoc.includes('84% MATCH · INTRODUCTION RECOMMENDED'), 'the code-derived verdict still renders')
  // Sections with no data source render NOTHING rather than an empty shell.
  ok(!pendingDoc.includes('Worth Talking About'), '§04 is omitted entirely when absent')
  ok(!pendingDoc.includes('The Signals That Mattered'), '§05 is omitted entirely when absent')
  // Static copy is independent of the AI and must survive.
  const statik = staticCopyFor('goals_expectations')!
  ok(statik.whatThisMeasures.length > 0, 'static category copy exists independently of the AI row')
}

// ═══ cityless omits the line, does not hedge ═══════════════════════════════
{
  const html = render(base({ viewerCity: null, identity: { ...base().identity, city: '' } }))
  ok(!/Both in|&\s*$/.test(html.replace(/&[a-z]+;/g, '')), 'no location line when neither city is known')
  ok(html.includes('Compatibility Breakdown'), '...and the rest of the document is unaffected')
}

// ═══ verdict is code-derived, not model-supplied ═══════════════════════════
{
  const html = render(base({ matchScore: 77, interpretation: { ...PAYLOAD, closing_read: { verdict: 'ABSOLUTELY GO', statement: 'x' } } as any }))
  ok(!html.includes('ABSOLUTELY GO'), 'a payload-supplied verdict NEVER reaches the strip')
  ok(html.includes(`77% MATCH · ${verdictForScore(77)}`), 'the strip derives its own verdict from the score')
}

// ═══ expanded category details — static above, pair-specific below ════════
{
  const html = render(base(), true)
  const statik = staticCopyFor('sexual_compatibility')!
  ok(html.includes('WHAT THIS MEASURES'), 'the static explainer label renders')
  ok(html.includes('WHY IT MATTERS'), 'the second static label renders')
  ok(html.includes(statik.whatThisMeasures.slice(0, 60)), 'static copy comes from categoryCopy.ts verbatim')
  ok(html.includes('YOUR ALIGNMENT') && html.includes('WHERE YOU DIFFER'), 'the pair-specific labels render')
  for (const s of SECTIONS) {
    ok(html.includes(`ALIGN-${s.key}`), `${s.displayName}: your_alignment renders`)
    ok(html.includes(`DIFFER-${s.key}`), `${s.displayName}: where_you_differ renders`)
    ok(html.includes(`READ-${s.key}`), `${s.displayName}: HAEVN's Read renders`)
  }
  // Order matters: the two static fields sit ABOVE the pair-specific ones.
  ok(html.indexOf('WHAT THIS MEASURES') < html.indexOf('YOUR ALIGNMENT'),
    'static explainers precede the pair-specific analysis, as the reference shows')
}
{
  // Degraded + expanded: static copy survives, AI fields show the prepared state.
  const html = render(base({ interpretation: null, degraded: true, interpretationPending: true }), true)
  ok(html.includes('WHAT THIS MEASURES'), 'static copy renders even with no AI row')
  ok(html.includes('being prepared'), '...and the AI fields show the prepared state')
  // "HAEVN'S READ" is BOTH the per-category callout and the closing section
  // heading, so count rather than test presence: 5 callouts + 1 closing when the
  // payload is full, and only the closing when it is not.
  const count = (s: string) => (s.match(/HAEVN&#x2019;S READ|HAEVN’S READ/g) ?? []).length
  eq(count(render(base(), true)), 6, 'full payload: five per-category callouts plus the closing heading')
  eq(count(html), 1, 'no AI row: the per-category callouts are omitted, only the closing heading remains')
}

report('matches/matchReport')
