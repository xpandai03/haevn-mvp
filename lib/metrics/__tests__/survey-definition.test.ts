/**
 * Survey-count definition fix (PR #6). Run:
 *   npx tsx lib/metrics/__tests__/survey-definition.test.ts
 * Covers: the completeness boundary, the backfill predicate (promote-only +
 * idempotent, mirror of migration 046), and the de-forked import writer.
 */
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true } as any)

import { isSurveyComplete, isSurveyStarted, SURVEY_COMPLETE_MIN_PCT } from '../getMetrics'
import { mapEmergentSubmission } from '../../import/emergentImport'
import { eq, ok, report } from './_assert'

// ── 1. Boundary (pct = 99 / 100 / 101 / 1 / 0 / null / undefined) ────────────
eq(SURVEY_COMPLETE_MIN_PCT, 100, 'boundary constant is 100')
ok(isSurveyComplete(100), '100 → complete')
ok(isSurveyComplete(101), '101 → complete')
ok(!isSurveyComplete(99), '99 → not complete')
ok(!isSurveyComplete(0), '0 → not complete')
ok(!isSurveyComplete(null), 'null → not complete')
ok(!isSurveyComplete(undefined), 'undefined → not complete')

ok(isSurveyStarted(99), '99 → started')
ok(isSurveyStarted(1), '1 → started')
ok(!isSurveyStarted(100), '100 → not "started" (it is complete)')
ok(!isSurveyStarted(0), '0 → not started (never-started)')
ok(!isSurveyStarted(null), 'null → not started (never-started)')
// completed and started are mutually exclusive; 0/null are neither.
for (const p of [0, 1, 50, 99, 100, 101]) {
  ok(!(isSurveyComplete(p) && isSurveyStarted(p)), `${p} not both complete and started`)
}

// ── 2. Backfill predicate — mirror of migration 046 (promote-only, idempotent) ─
// Mirror: promote iff currently false AND completion_pct >= 100. Never demotes.
function shouldPromote(surveyComplete: boolean, pct: number | null | undefined): boolean {
  return surveyComplete === false && pct != null && pct >= 100
}
ok(shouldPromote(false, 100), 'sc=false pct=100 → promote')
ok(shouldPromote(false, 150), 'sc=false pct=150 → promote')
ok(!shouldPromote(false, 99), 'sc=false pct=99 → no promote')
ok(!shouldPromote(false, 0), 'sc=false pct=0 → no promote')
ok(!shouldPromote(false, null), 'sc=false pct=null → no promote')
ok(!shouldPromote(false, undefined), 'sc=false no-usr → no promote')
// never demotes: an already-true row (incl. the pct<100 anomaly) is never touched.
ok(!shouldPromote(true, 50), 'sc=true pct=50 (anomaly) → untouched, never demoted')
ok(!shouldPromote(true, 100), 'sc=true pct=100 → already true, not re-promoted')
// idempotency: promote a row, then re-run — second pass promotes nothing.
{
  let sc = false
  if (shouldPromote(sc, 100)) sc = true // pass 1
  const secondPass = shouldPromote(sc, 100) // pass 2
  ok(sc === true && secondPass === false, 're-run touches 0 rows (idempotent)')
}

// ── 3. De-forked import writer (mapEmergentSubmission) ───────────────────────
const baseSub = { email: 'a@b.com', raw_answers: { Q1: 'x', Q2: 'y', Q3: 'z' } }
const complete_submitted = mapEmergentSubmission({ ...baseSub, percent_complete: 100, completion_status: 'submitted' } as any)
const complete_draft = mapEmergentSubmission({ ...baseSub, percent_complete: 100, completion_status: 'draft' } as any)
const partial = mapEmergentSubmission({ ...baseSub, percent_complete: 99, completion_status: 'submitted' } as any)

ok(complete_submitted.eligible, 'valid submission is eligible')
eq(complete_submitted.profile.survey_complete, true, 'pct=100 + submitted → survey_complete true')
// KEY: the `submitted` gate is gone — pct=100 alone sets the boolean.
eq(complete_draft.profile.survey_complete, true, 'pct=100 + NOT submitted → survey_complete true (de-forked)')
eq(partial.profile.survey_complete, false, 'pct=99 → survey_complete false')

// ineligible submission stays false (never promoted at import)
const ineligible = mapEmergentSubmission({ email: 'a@b.com', raw_answers: { Q1: 'x' }, percent_complete: 100 } as any)
ok(!ineligible.eligible, 'submission with <3 answers is ineligible')
eq(ineligible.profile.survey_complete, false, 'ineligible → survey_complete false')

report('survey-definition')
