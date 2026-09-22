/**
 * Anonymize-on-delete: turn a member's survey answers into a form that can be
 * kept after their account is gone without pointing back at them.
 *
 * ALLOWLIST, not blocklist. A key survives only if it is a structured
 * (non-free-text) question in lib/survey/questions.ts or a known legacy
 * structured key, and a value survives only if it is a number, a short code
 * token, or one of that question's option labels (see keepScalar). Everything
 * else is dropped, which is what catches the cases a blocklist would miss:
 *   - free-text questions (textarea / text) — members write names, handles,
 *     neighbourhoods, workplaces into these
 *   - the exact birthdate (q1_age, type 'date') — reduced to a 5-year band
 *   - a write-in value smuggled into a choice question ("Other: ...")
 *   - any key a future survey version adds, until someone adds it here
 *
 * City is NOT read from the answers (it isn't in them); the caller attaches
 * partnerships.city. Nothing in the output carries an id, a timestamp finer
 * than a month, or a name.
 */
import { getAllQuestions, type SurveyQuestion } from '@/lib/survey/questions'

export const ANON_SCHEMA_VERSION = 1

/** Question types whose answers are free text or a birthdate. Keys of these
 *  types never survive (the birthdate is reduced to a band separately). */
const FREE_TYPES = new Set<SurveyQuestion['type']>(['text', 'textarea', 'date'])

/** Structured keys that exist in stored answers but not in questions.ts
 *  (import-era / legacy). Closed choices or numeric scales only. */
const EXTRA_STRUCTURED_KEYS = new Set([
  'Q_EMOTIONAL_ENGAGEMENT',
  'Q_EMOTIONAL_PACE',
  'Q_INDEPENDENCE_BALANCE',
  'q17_children',
  'q17a_dietary',
  'q17b_pets',
  'survey_mode',
])

const BIRTHDATE_KEY = 'q1_age'

let questionIndex: Map<string, SurveyQuestion> | null = null
function questions(): Map<string, SurveyQuestion> {
  if (!questionIndex) questionIndex = new Map(getAllQuestions().map((q) => [q.id, q]))
  return questionIndex
}

/** '18-24', '25-29', … '60+' from a YYYY-MM-DD birthdate; null if unparseable
 *  or implausible. Deliberately coarse: an exact age plus city is closer to
 *  identifying than a band. */
export function ageBand(birthdate: unknown, now: Date): string | null {
  if (typeof birthdate !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  let age = now.getUTCFullYear() - y
  if (now.getUTCMonth() + 1 < mo || (now.getUTCMonth() + 1 === mo && now.getUTCDate() < d)) age--
  if (!Number.isFinite(age) || age < 18 || age > 110) return null
  if (age < 25) return '18-24'
  if (age >= 60) return '60+'
  const lo = Math.floor(age / 5) * 5
  return `${lo}-${lo + 4}`
}

/**
 * Stored answers don't follow questions.ts types: the import path writes short
 * codes ('sec', 'kids_out', 'K0', '1on1') even for questions typed 'slider',
 * the in-app survey writes option labels, and there is no code catalog. So a
 * value survives if it is one of these, and nothing else:
 *   - a finite number (or numeric string, kept as a number)
 *   - a code token: lowercase/digits/_+- up to 32 chars, or K0-style
 *   - an exact option label of that question
 * A write-in sentence, a name, an email or a phone number is none of these.
 */
const CODE_TOKEN = /^(?:[a-z0-9_+-]{1,32}|[A-Z][0-9]{1,2})$/

function keepScalar(v: unknown, options: ReadonlySet<string>): string | number | boolean | null {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (/^-?\d{1,4}(\.\d+)?$/.test(t)) return Number(t)
  if (CODE_TOKEN.test(t) || options.has(v)) return v
  return null
}

function keepValue(v: unknown, options: ReadonlySet<string>): unknown {
  if (Array.isArray(v)) {
    const kept = v.map((x) => keepScalar(x, options)).filter((x) => x !== null)
    return kept.length > 0 ? Array.from(new Set(kept)) : null
  }
  return keepScalar(v, options)
}

export interface AnonymizedSurvey {
  answers: Record<string, unknown>
  /** Keys present in the input that did not survive — for tests/logging only.
   *  Never persisted (key names alone are harmless, but there's no need). */
  droppedKeys: string[]
}

export function anonymizeSurveyAnswers(raw: unknown, now: Date = new Date()): AnonymizedSurvey {
  const out: Record<string, unknown> = {}
  const dropped: string[] = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { answers: out, droppedKeys: dropped }

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key === BIRTHDATE_KEY) {
      const band = ageBand(value, now)
      if (band) out.age_band = band
      dropped.push(key)
      continue
    }

    const q = questions().get(key)
    const structured = q ? !FREE_TYPES.has(q.type) : EXTRA_STRUCTURED_KEYS.has(key)
    const kept = structured ? keepValue(value, new Set(q?.options ?? [])) : null

    if (kept === null || kept === undefined) dropped.push(key)
    else out[key] = kept
  }
  return { answers: out, droppedKeys: dropped }
}
