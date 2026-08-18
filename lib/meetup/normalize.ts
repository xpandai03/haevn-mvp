/**
 * Survey-answer normalizers for the meetup feed.
 *
 * The live data stores TWO encodings per field: short codes for ~99% of rows
 * (`25`, `local`, `drink`) and a small tail of full option labels (`"Within 25
 * miles"`, `"Social drinker"`). Every normalizer accepts BOTH, and any token it
 * does not recognize lands in a logged "unknown" bucket that degrades the
 * affected output (distance → null, alcohol → 'unknown' → low_confidence) rather
 * than crashing the run or silently dropping the pair.
 */

export type AlcoholSignal = 'positive' | 'sober' | 'unknown'
export type Mobility = 'local' | 'occasional' | 'frequent' | 'flexible' | 'unknown'

const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : '')

/** Tokens we've seen but can't map — collected so the cron can log + extend. */
export interface UnknownSink {
  push(field: string, value: string): void
}

// ── q19a_max_distance → miles ────────────────────────────────────────────────
export function normalizeMaxDistanceMiles(raw: unknown, unknown?: UnknownSink): number | null {
  const v = norm(raw)
  if (!v) return null
  // short codes
  if (v === 'city') return 5
  if (v === 'int' || v === 'nat') return 9999
  if (/^\d+$/.test(v)) return Number(v)
  // full labels
  if (v.includes('neighborhood')) return 5
  if (v.includes('any distance')) return 9999
  const m = v.match(/within\s+(\d+)\s*mile/)
  if (m) return Number(m[1])
  unknown?.push('q19a_max_distance', v)
  return null
}

// ── q19c_mobility → coarse bucket ────────────────────────────────────────────
export function normalizeMobility(raw: unknown, unknown?: UnknownSink): Mobility {
  const v = norm(raw)
  if (!v) return 'unknown'
  if (v === 'local' || v.includes('limited mobility') || v.includes('prefer local')) return 'local'
  if (v === 'sometimes' || v.includes('somewhat mobile') || v.includes('occasion')) return 'occasional'
  if (v === 'freq' || v.includes('very mobile') || v.includes('travel frequently')) return 'frequent'
  if (v === 'flex' || v.includes('flexible') || v.includes('remote worker') || v === 'it varies' || v.includes('varies'))
    return 'flexible'
  unknown?.push('q19c_mobility', v)
  return 'unknown'
}

// ── q18_substances (array) → alcohol signal ──────────────────────────────────
// positive = drinks alcohol socially/regularly; sober = explicit no-alcohol;
// unknown = no alcohol-relevant token (→ low_confidence downstream, never a claim).
export function normalizeAlcohol(raw: unknown, unknown?: UnknownSink): AlcoholSignal {
  const arr = Array.isArray(raw) ? raw.map(norm).filter(Boolean) : raw != null ? [norm(raw)] : []
  if (arr.length === 0) return 'unknown'
  let positive = false
  let sober = false
  let sawAlcoholToken = false
  for (const v of arr) {
    if (v === 'drink' || v.includes('social drinker') || v.includes('regular user')) {
      positive = true
      sawAlcoholToken = true
    } else if (v === 'sober' || v === 'no_drink' || v.includes('sober') || v.includes("don't drink")) {
      sober = true
      sawAlcoholToken = true
    } else if (
      // recognized non-alcohol tokens — not alcohol-relevant, don't flag unknown
      v === 'cann' || v === 'no_cann' || v === 'psy' || v === 'oth' ||
      v.includes('cannabis') || v.includes('psychedelic') || v.includes('prefer not') || v.includes('other')
    ) {
      // no-op (recognized, alcohol-neutral)
    } else {
      unknown?.push('q18_substances', v)
    }
  }
  // An explicit sober signal wins (respect sobriety) even if a drink token also appears.
  if (sober) return 'sober'
  if (positive) return 'positive'
  return sawAlcoholToken ? 'unknown' : 'unknown'
}

// ── q36_social_energy → number (already numeric; guard only) ─────────────────
export function normalizeSocialEnergy(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}
