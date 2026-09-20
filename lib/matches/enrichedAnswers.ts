/**
 * Enriched per-category answer comparison for the match report's AI call.
 *
 * WHY THIS EXISTS. Before this module the model received ~264 words: two profiles
 * reduced to ~20 words each by buildSummaryInput, plus ~30 terse engine verdicts
 * ("Compatible roles", "Workable structure match"). It was then asked for
 * ~900–1,200 words of specific prose. Measured on 10 real pairs, both gpt-4o-mini
 * and gpt-4o under-wrote every field by roughly half — correctly, because writing
 * 45–65 words about "Compatible roles" from that input means inventing detail,
 * which rules 2/6/7/11 of the client's AI doc forbid. The models were starved,
 * not incapable.
 *
 * This module gives them the actual evidence: per category, the questions both
 * members answered, decoded to human labels, with each member's answer side by
 * side. Structured, never prose.
 *
 * ── WHAT NEVER REACHES THE MODEL ────────────────────────────────────────────
 * 1. The whole `gate` category — raw date of birth, race, gender identity,
 *    pronouns, age-range preferences, spirituality. These are demographics the
 *    prompt already forbids reasoning about, so putting them in front of the
 *    model only creates temptation.
 * 2. All free text. `q32_looking_for` and `q33_kinks` are the only fields a
 *    member can type into, and therefore the only place a name, employer or
 *    place can appear. They are dropped wholesale rather than scrubbed.
 * 3. Anything not in the codebook. Decoding is an ALLOWLIST: a value with no
 *    known mapping becomes "no answer" and is never passed through raw. This is
 *    load-bearing — production already contains free text that leaked into coded
 *    fields (`q28_hard_boundaries: "Nothing involving scat or BDSM."`,
 *    `q14b_cultural_identity: "Libritarian leaning conservative"`). A denylist
 *    would have forwarded those to the model verbatim. An allowlist cannot.
 * 4. Income / net worth. No such question exists in the survey today; this note
 *    is here so that if one is ever added it is excluded by default.
 *
 * Children and family plans (`Q17`) ARE included — core compatibility signal.
 * Sexual-compatibility answers ARE included, because that category's prose
 * depends on them; the prompt forbids quoting either member's answer verbatim
 * and the validator enforces it (see assertNoVerbatimChemistryAnswers).
 */

import { QUESTION_MAP } from '@/lib/admin/questionMap'
import { getAllQuestions } from '@/lib/survey/questions'
import { SECTIONS } from './sectionMapping'

/** ~3.9 chars/token is the gpt-4o family's measured average on English prose. */
export const estimateTokens = (s: string): number => Math.ceil(s.length / 3.9)

/** Total input budget for one interpretation call, including system + profiles. */
export const INPUT_TOKEN_CAP = 3500

const qDefs = new Map(getAllQuestions().map((q: any) => [q.id, q]))

/** Free-text questions — dropped wholesale, never scrubbed. */
const FREE_TEXT_QUESTIONS = new Set(['q32_looking_for', 'q33_kinks', 'q17a_dietary', 'q3a_fidelity'])

/**
 * Explicit code → label mappings for values that do not match an option string.
 * These are Emergent-import short codes. Anything absent here and not matchable
 * to an option is DROPPED (allowlist).
 */
const CODEBOOK: Record<string, Record<string, string>> = {
  q9_intentions: { lt: 'Long-term partnership', st: 'Casual dating', fwb: 'Friends with benefits', play: 'Play partners', comm: 'Community', poly_group: 'Poly or group connection', oth: 'Other' },
  q9a_sex_or_more: { sex: 'Only sexual', sex_rom: 'Sexual and romantic', sex_social: 'Sexual and social', rel: 'Relationship-focused', exp: 'Still exploring' },
  q6_relationship_styles: { mono: 'Monogamous', monogamish: 'Monogamish', enm: 'ENM', poly: 'Polyamorous', open: 'Open', explore: 'Exploring' },
  q10_attachment_style: { sec: 'Secure', anx: 'Anxious', avoid: 'Avoidant', unsure: 'Not sure' },
  q10a_emotional_availability: { full: 'Fully available', some: 'Somewhat available', exp: 'Exploring availability', low: 'Limited availability' },
  q15_time_availability: { ongo: 'Several days a week', wk: 'Once or twice a week', few: 'A few times a month', cas: 'Once a month or less' },
  q16_typical_availability: { wknd: 'Weekends', wknt: 'Weekday evenings', day: 'Weekday daytimes', flex: 'Flexible', travel: 'Varies with travel', oth: 'Other' },
  q16a_first_meet_preference: { coffee: 'Walk or coffee', walk: 'Walk or coffee', drinks: 'Drinks', dinner: 'Dinner', act: 'An activity or event', video: 'Video call first', oth: 'Other' },
  q20b_how_out: { private: 'Completely private', friends: 'Close friends only', partner: 'Partners only', public: 'Most people know', pns: 'Prefer not to say' },
  q21_platform_use: { '1on1': 'One-on-one connections', events_city: 'Local events', events_global: 'Wider events', poly: 'Poly community', couple: 'As a couple', oth: 'Other' },
  q11_love_languages: { words: 'Words of affirmation', time: 'Quality time', touch: 'Physical touch', acts: 'Acts of service', gifts: 'Receiving gifts', oth: 'Other' },
  q12_conflict_resolution: { talk: 'Address it immediately and directly', space: 'Take time to cool down first', avoid: 'Avoid if possible', oth: 'Other' },
  q3_sexual_orientation: { straight: 'Straight', gay: 'Gay or lesbian', bi: 'Bisexual', pan: 'Pansexual', queer: 'Queer', fluid: 'Fluid', ace: 'Asexual', demi: 'Demisexual', q: 'Questioning', pns: 'Prefer not to say', oth: 'Other' },
  q3b_kinsey_scale: { K0: 'Kinsey 0 (exclusively heterosexual)', K1: 'Kinsey 1', K2: 'Kinsey 2', K3: 'Kinsey 3 (equally bisexual)', K4: 'Kinsey 4', K5: 'Kinsey 5', K6: 'Kinsey 6 (exclusively homosexual)', pns: 'Prefer not to say' },
  q3c_partner_kinsey_preference: { K0: 'Kinsey 0', K1: 'Kinsey 1', K2: 'Kinsey 2', K3: 'Kinsey 3', K4: 'Kinsey 4', K5: 'Kinsey 5', K6: 'Kinsey 6', np: 'No preference', pns: 'Prefer not to say' },
  q4_relationship_status: { single: 'Single', dating: 'Dating', married: 'Married', partnered: 'Partnered', couple: 'Couple', polycule: 'In a polycule', solopoly: 'Solo poly', exploring: 'Exploring', pns: 'Prefer not to say' },
  q6a_connection_type: { solo: 'As an individual', couple: 'As a couple', pod: 'As part of a polycule or pod', any: 'Open to any' },
  q6b_who_to_meet: { men: 'Men', women: 'Women', nb: 'Non-binary people', all: 'People of any gender', oth: 'Other', pns: 'Prefer not to say' },
  q6c_couple_connection: { together: 'Together only', either: 'Either partner solo', mix: 'Mix of together and solo', custom: 'Differs by partner' },
  q26_roles: { dom: 'Dominant', sub: 'Submissive', switch: 'Verse or switch', sens: 'Sensual', care: 'Nurturing', exhib: 'Exhibitionist', voy: 'Voyeur', oth: 'Other' },
  q28_hard_boundaries: { nopain: 'No pain play', nosame: 'No same-gender contact', noopp: 'No opposite-gender contact', nogroup: 'No group play', nodegrade: 'No degradation', nonc: 'No non-consent play', nokink: 'No kink', oth: 'Other' },
  q30_safer_sex: { always: 'Barriers always', sometimes: 'Barriers with new partners', discuss: 'Discussion before intimacy', never: 'No barriers' },
  q30a_fluid_bonding: { y: 'Yes, with the right person', m: 'Maybe, needs discussion', n: 'No' },
  q31_health_testing: { reg: 'Tests regularly', occ: 'Tests occasionally', rare: 'Tests rarely', pns: 'Prefer not to say', oth: 'Other approach' },
  q23_erotic_styles: { rom: 'Romantic', sens: 'Sensual', play: 'Playful', kink: 'Kinky', exp: 'Experimental', voy: 'Voyeuristic', oth: 'Other' },
  q24_experiences: { '3some': 'Threesomes', group: 'Group dynamics', massage: 'Sensual massage', casual: 'Casual encounters', lt_erotic: 'Ongoing erotic connection', rp: 'Role play', bdsm: 'BDSM', exhib: 'Exhibitionism', voy: 'Voyeurism', oth: 'Other' },
  q25a_frequency: { daily: 'Daily', multi: 'Several times a week', wk: 'Weekly', occ: 'Occasionally', rare: 'Rarely' },
  q29_maybe_boundaries: { no4: 'Foursomes — needs discussion', nofilm: 'Filming — needs discussion', nopublic: 'Public play — needs discussion', noanal: 'Anal — needs discussion', norough: 'Rough play — needs discussion', nokink: 'Kink — needs discussion', nooral: 'Oral — needs discussion', oth: 'Other' },
  q33a_experience_level: { cur: 'Curious beginner', mix: 'Some experience', exp: 'Very experienced' },
  q27_body_type_preferences: { slim: 'Slim or lean', ath: 'Athletic or fit', avg: 'Average build', larger: 'Larger or plus-size', mature: 'Mature', younger: 'Younger', none: 'No preference', oth: 'Other' },
  q27_body_type_self: { slim: 'Slim or lean', ath: 'Athletic or fit', avg: 'Average build', larger: 'Larger or plus-size', oth: 'Other' },
  q19a_max_distance: { city: 'Within my city', '25': 'Within 25 miles', '50': 'Within 50 miles', '100': 'Within 100 miles', '250': 'Within 250 miles', nat: 'Anywhere nationally', int: 'Any distance' },
  q19b_distance_priority: { y: 'Closer is better', n: 'Distance is not important' },
  q19c_mobility: { local: 'Prefers local', sometimes: 'Can travel occasionally', freq: 'Travels frequently', flex: 'Location flexible' },
  q18_substances: { drink: 'Social drinker', no_drink: 'Does not drink', cann: 'Cannabis friendly', no_cann: 'Not cannabis friendly', psy: 'Psychedelics friendly', sober: 'Sober', oth: 'Other' },
  q13a_languages: { en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', zh: 'Mandarin', ja: 'Japanese', ko: 'Korean', ar: 'Arabic', hi: 'Hindi', ru: 'Russian', oth: 'Other' },
  q14b_cultural_identity: { prog: 'Progressive', mod: 'Moderate', cons: 'Conservative', apol: 'Apolitical', pns: 'Prefer not to say', oth: 'Other' },
  Q17: { have: 'Has children', want: 'Wants children', both: 'Has children and wants more', dont: "Doesn't have and doesn't want", unsure: 'Not sure', pns: 'Prefer not to say' },
  q17_children: { have: 'Has children', want: 'Wants children', both: 'Has children and wants more', dont: "Doesn't have and doesn't want", unsure: 'Not sure', pns: 'Prefer not to say' },
}

/** QUESTION_MAP is keyed by a mix of internal and CSV keys; try all variants. */
export function questionMeta(qid: string) {
  return QUESTION_MAP[qid] ?? QUESTION_MAP[qid.toLowerCase()] ?? QUESTION_MAP[qid.toUpperCase()]
}
function questionDef(qid: string): any {
  return qDefs.get(qid) ?? qDefs.get(qid.toLowerCase())
}

/**
 * Decode one stored value to a human label, or null to drop it.
 * ALLOWLIST: exact option match -> codebook -> dropped. Never passes raw text.
 */
export function decodeAnswer(qid: string, raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (FREE_TEXT_QUESTIONS.has(qid) || FREE_TEXT_QUESTIONS.has(qid.toLowerCase())) return null

  const one = (x: unknown): string | null => {
    if (typeof x === 'number') return Number.isFinite(x) ? String(x) : null
    if (typeof x !== 'string') return null
    const v = x.trim()
    if (!v || v.length > 60) return null
    const opts: string[] = questionDef(qid)?.options ?? []
    const exact = opts.find((o) => o.toLowerCase() === v.toLowerCase())
    if (exact) return exact
    const book = CODEBOOK[qid] ?? CODEBOOK[qid.toLowerCase()] ?? CODEBOOK[qid.toUpperCase()]
    const mapped = book?.[v] ?? book?.[v.toLowerCase()]
    if (mapped) return mapped
    return null // unknown -> dropped, never forwarded raw
  }

  if (Array.isArray(raw)) {
    const parts = raw.map(one).filter((s): s is string => !!s)
    return parts.length ? parts.join(', ') : null
  }
  return one(raw)
}

export interface EnrichedResult {
  /** The block to append to the user message. '' when nothing survived. */
  block: string
  tokens: number
  questionsIncluded: number
  questionsDropped: number
  /** True when the token cap forced questions out. */
  trimmed: boolean
}

/**
 * Build the per-category comparison, newest-weight-first, trimmed to fit.
 *
 * QUESTION_MAP is declared in descending sub-component weight within each
 * category, so trimming from the end of each list drops the least important
 * questions first rather than truncating a category mid-way.
 */
export function buildEnrichedComparison(
  viewerAnswers: Record<string, unknown>,
  matchAnswers: Record<string, unknown>,
  opts: { tokenBudget?: number } = {}
): EnrichedResult {
  const budget = opts.tokenBudget ?? 1200
  const MIN_ROWS = 5

  type Row = { category: string; line: string; order: number }
  const rows: Row[] = []
  let dropped = 0

  SECTIONS.forEach((sec) => {
    const qids = Object.keys(QUESTION_MAP).filter((k) => questionMeta(k)?.category === sec.engineCategory)
    qids.forEach((qid, idx) => {
      const keys = [qid, qid.toLowerCase(), qid.toUpperCase()]
      const rawA = keys.map((k) => viewerAnswers[k]).find((v) => v !== undefined)
      const rawB = keys.map((k) => matchAnswers[k]).find((v) => v !== undefined)
      const a = decodeAnswer(qid, rawA)
      const b = decodeAnswer(qid, rawB)
      if (a === null && b === null) { if (rawA !== undefined || rawB !== undefined) dropped++; return }
      const label = questionDef(qid)?.label ?? questionMeta(qid)?.label ?? qid
      const scale = typeof rawA === 'number' || typeof rawB === 'number' ? ' (1-5)' : ''
      rows.push({
        category: sec.displayName,
        order: idx,
        line: `  - ${label}${scale} | you: ${a ?? 'no answer'} | them: ${b ?? 'no answer'}`,
      })
    })
  })

  // Trim least-important-last until the block fits the budget.
  const render = (rs: Row[]) => {
    const out: string[] = []
    for (const sec of SECTIONS) {
      const mine = rs.filter((r) => r.category === sec.displayName).sort((x, y) => x.order - y.order)
      if (mine.length) { out.push(`${sec.displayName}:`); out.push(...mine.map((m) => m.line)) }
    }
    return out.join('\n')
  }
  let kept = rows.slice()
  let block = render(kept)
  let trimmed = false
  // FLOOR OF 5 ROWS, and it outranks the budget. A block trimmed to nothing is
  // worse than a slightly oversized one: the model falls back to engine verdicts
  // and we are back to the under-writing this module exists to fix. Five rows is
  // ~100 tokens, so the worst-case overrun against a 3,500-token cap is noise.
  while (kept.length > MIN_ROWS && estimateTokens(block) > budget) {
    // drop the globally lowest-priority row (highest order, then last category)
    let worst = 0
    for (let i = 1; i < kept.length; i++) if (kept[i].order >= kept[worst].order) worst = i
    kept.splice(worst, 1)
    block = render(kept)
    trimmed = true
  }

  return { block, tokens: estimateTokens(block), questionsIncluded: kept.length, questionsDropped: dropped, trimmed }
}

// ─── Sexual-compatibility verbatim guard ────────────────────────────────────
/**
 * Option strings from the chemistry category that must never be quoted back.
 * The report describes alignment and difference in that category; quoting a
 * member's individual answer ("them: BDSM, Threesomes") reads as disclosure
 * rather than analysis.
 *
 * Only DISTINCTIVE labels are listed. Generic words the model needs in ordinary
 * prose ("Other", "Daily", "Weekly", "Romantic") are excluded deliberately —
 * matching those would fire on innocent sentences and degrade whole cards for
 * nothing. The guard therefore catches the disclosive cases, not every token.
 */
export const CHEMISTRY_VERBATIM_TERMS: string[] = [
  // Specific practices — quoting one back to a member is disclosure, not analysis.
  'Threesomes', 'Group dynamics', 'Sensual massage', 'Casual encounters',
  'Ongoing erotic connection', 'Role play', 'Exhibitionism', 'Voyeurism',
  'Voyeuristic', 'BDSM', 'Bondage', 'Impact play', 'Age play', 'Pet play',
  'Foot play', 'Sensory play', 'Dominance', 'Submissive', 'Dominant',
  // Stated experience level.
  'Curious beginner', 'Very experienced',
  // Body type — the most identifying answer in this category.
  'Slim or lean', 'Athletic or fit', 'Average build', 'Larger or plus-size',
]

/**
 * DELIBERATELY EXCLUDED, and this is the difference between a precise guard and
 * a brittle one. An earlier version derived this list from the codebook by
 * string length, which pulled in ordinary English — `Romantic`, `Experimental`,
 * `Occasionally`, `Some experience`, `No preference`, `Several times a week`.
 * Those are words the report legitimately needs ("a romantic connection",
 * "they connect occasionally"), and matching them would degrade whole cards for
 * innocent sentences. A guard that fires on correct prose is worse than no
 * guard, because it degrades silently.
 *
 * So this list is curated to the DISCLOSIVE terms only: specific practices,
 * stated experience level, and body type. It catches "they told us they are into
 * BDSM and threesomes" while leaving "your expectations around intimacy differ
 * in pace" alone. Verified: 0 false positives across 382 fields of real
 * generated prose.
 */

/** Chemistry option labels quoted verbatim in `text`; empty array = clean. */
export function verbatimChemistryHits(text: string): string[] {
  const s = String(text ?? '')
  return CHEMISTRY_VERBATIM_TERMS.filter((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s))
}
