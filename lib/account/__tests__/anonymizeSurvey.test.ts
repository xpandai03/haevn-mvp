/** Anonymize-on-delete scrubber. Run: npx tsx lib/account/__tests__/anonymizeSurvey.test.ts */
import { anonymizeSurveyAnswers, ageBand } from '../anonymizeSurvey'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const NOW = new Date('2026-09-22T12:00:00Z')

// A member's answers with PII planted everywhere a member could type it.
const PII = ['Jordan Avery', 'jordan.avery@example.com', '+1 512 555 0142', '1990-03-14', '78704', 'Barton Springs']
const fixture = {
  q1_age: '1990-03-14',
  q2_gender_identity: 'woman',
  q3_sexual_orientation: 'bi',
  q3b_kinsey_scale: 'K2',
  q10_attachment_style: "Secure - I'm comfortable with intimacy and independence",
  q23_erotic_styles: ['rom', 'play', 'Other: ask for Jordan Avery at Barton Springs'],
  q20_discretion: 4,
  q12a_messaging_pace: '3',
  Q_EMOTIONAL_PACE: 2,
  survey_mode: 'relationship_oriented',
  q17_children: 'kids_out',
  // free-text questions (textarea) — must never survive, whatever they hold
  q32_looking_for: 'Text me on +1 512 555 0142 or jordan.avery@example.com',
  q14b_cultural_identity: 'Grew up near 78704',
  q3a_fidelity: 'Jordan Avery here',
  q28_hard_boundaries: 'none',
  q6d_couple_permissions: 'ok',
  // write-in values in choice questions
  q4_relationship_status: 'Jordan Avery',
  q9_intentions: ['jordan.avery@example.com'],
  // keys the anonymizer has never heard of
  contact_email: 'jordan.avery@example.com',
  full_name: 'Jordan Avery',
  phone: '+1 512 555 0142',
}

function main() {
  const { answers, droppedKeys } = anonymizeSurveyAnswers(fixture, NOW)
  const blob = JSON.stringify(answers)

  // ── zero PII ──
  for (const needle of PII) ok(!blob.includes(needle), `no "${needle}" anywhere in the anonymized answers`)
  ok(!/@/.test(blob), 'no email-shaped value survives')
  ok(!/\d{3}[ -]?\d{3}[ -]?\d{4}/.test(blob), 'no phone-shaped value survives')
  for (const k of ['q1_age', 'q32_looking_for', 'q14b_cultural_identity', 'q3a_fidelity', 'q28_hard_boundaries', 'q6d_couple_permissions', 'contact_email', 'full_name', 'phone']) {
    ok(!(k in answers), `${k} is dropped`)
    ok(droppedKeys.includes(k), `${k} is reported as dropped`)
  }
  ok(!('q4_relationship_status' in answers), 'a name typed into a choice question is dropped')
  ok(!('q9_intentions' in answers), 'an email typed into a multiselect is dropped (and the empty array with it)')

  // ── structured answers survive ──
  eq(answers.age_band, '35-39', 'birthdate becomes a 5-year age band')
  eq(answers.q2_gender_identity, 'woman', 'code answer kept')
  eq(answers.q3b_kinsey_scale, 'K2', 'K-scale code kept')
  eq(answers.q10_attachment_style, "Secure - I'm comfortable with intimacy and independence", 'exact option label kept')
  eq(answers.q23_erotic_styles, ['rom', 'play'], 'multiselect keeps codes, drops the write-in')
  eq(answers.q20_discretion, 4, 'number kept')
  eq(answers.q12a_messaging_pace, 3, 'numeric string normalised to a number')
  eq(answers.Q_EMOTIONAL_PACE, 2, 'legacy numeric key kept')
  eq(answers.survey_mode, 'relationship_oriented', 'survey_mode kept')
  eq(answers.q17_children, 'kids_out', 'import-era choice key kept')

  // ── edges ──
  eq(anonymizeSurveyAnswers(null, NOW).answers, {}, 'null answers → empty object')
  eq(anonymizeSurveyAnswers(['x'], NOW).answers, {}, 'array answers → empty object')
  eq(ageBand('2008-09-23', NOW), null, 'under 18 → no band')
  eq(ageBand('2008-09-22', NOW), '18-24', '18th birthday today → 18-24')
  eq(ageBand('1960-01-01', NOW), '60+', '60+ band')
  eq(ageBand('not-a-date', NOW), null, 'garbage → no band')

  report('anonymizeSurvey')
}

main()
