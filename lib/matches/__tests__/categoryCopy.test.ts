/**
 * Static category copy — completeness, verbatim fidelity to the captured
 * reference, and the rule that it NEVER enters the AI call.
 *
 * Run: npx tsx lib/matches/__tests__/categoryCopy.test.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CATEGORY_STATIC_COPY, staticCopyFor, hasCopyForEverySection } from '../categoryCopy'
import { SECTIONS } from '../sectionMapping'
import { MATCH_INTERPRETATION_SYSTEM } from '../../ai/prompts/matchInterpretation'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

// ── completeness ──
ok(hasCopyForEverySection(), 'every engine section has both static strings')
eq(Object.keys(CATEGORY_STATIC_COPY).length, 5, 'exactly five categories')
eq(
  Object.keys(CATEGORY_STATIC_COPY).sort(),
  SECTIONS.map((s) => s.key).sort(),
  'copy keys match the engine section keys exactly — no orphans, no gaps'
)
eq(staticCopyFor('not_a_category'), null, 'unknown key returns null rather than throwing')

// Ten distinct strings — a copy/paste duplication would silently ship the wrong
// explainer under a category heading.
const allStrings = Object.values(CATEGORY_STATIC_COPY).flatMap((c) => [c.whatThisMeasures, c.whyItMatters])
eq(allStrings.length, 10, 'ten strings total')
eq(new Set(allStrings).size, 10, 'all ten are distinct')
for (const s of allStrings) ok(s.trim().length > 120, 'each explainer is a real paragraph, not a stub')

// Each "WHAT THIS MEASURES" opens by naming its own category.
for (const sec of SECTIONS) {
  const c = CATEGORY_STATIC_COPY[sec.key]
  ok(
    c.whatThisMeasures.startsWith(sec.displayName) ||
      c.whatThisMeasures.toLowerCase().startsWith(sec.displayName.toLowerCase()),
    `${sec.displayName}: "what this measures" names its own category first`
  )
}

// ── verbatim fidelity to the captured reference ──
// The reference page IS the copy spec. If this fails, either someone edited the
// strings to taste or the client changed the page — both need a human decision,
// never a silent drift.
const refPath = join(process.cwd(), 'docs/specs/match-report-reference/page.txt')
let reference = ''
try {
  reference = readFileSync(refPath, 'utf8')
} catch {
  ok(false, `reference capture missing at ${refPath} — re-capture before trusting this suite`)
}
if (reference) {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  const flat = norm(reference)
  for (const sec of SECTIONS) {
    const c = CATEGORY_STATIC_COPY[sec.key]
    ok(flat.includes(norm(c.whatThisMeasures)), `${sec.displayName}: whatThisMeasures is verbatim from the reference`)
    ok(flat.includes(norm(c.whyItMatters)), `${sec.displayName}: whyItMatters is verbatim from the reference`)
  }
}

// ── the rule: static copy is NEVER in the AI call ──
// These paragraphs are definitional, identical for every pair, and paying to
// regenerate them ~2,200×/week would also let the model paraphrase a definition
// differently for two members looking at the same category.
for (const s of allStrings) {
  ok(
    !MATCH_INTERPRETATION_SYSTEM.includes(s),
    'static explainer copy does not appear in the AI system prompt'
  )
}
ok(
  !/WHAT THIS MEASURES|WHY IT MATTERS/i.test(MATCH_INTERPRETATION_SYSTEM),
  'the model is never asked to produce the static explainer fields'
)

report('matches/categoryCopy')
