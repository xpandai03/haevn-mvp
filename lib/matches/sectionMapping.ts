/**
 * Match compatibility — section mapping + classification bands (pure, app-owned).
 *
 * The engine (`computed_matches.breakdown`, engine_version 5cat-v6) emits five
 * category objects; this module renames them to the five design sections and
 * derives every score/band/label the UI renders. ZERO AI involvement — the AI
 * interprets these numbers in prose but never produces or alters them.
 *
 * Locked decisions (2026-08-18): the five-band vocabulary governs; the overall
 * match badge derives from the overall score via the SAME bands (so a 92 reads
 * "EXCEPTIONAL MATCH", not the mock's "STRONG MATCH"); a perfect 100 shows the
 * special label "Fully Aligned".
 */

// ── Section identity (order = display order, matches the engine + the mock) ──
export interface SectionDef {
  engineCategory: 'intent' | 'structure' | 'connection' | 'chemistry' | 'lifestyle'
  key: string
  displayName: string
  order: number
}

export const SECTIONS: SectionDef[] = [
  { engineCategory: 'intent', key: 'goals_expectations', displayName: 'Goals & Expectations', order: 1 },
  { engineCategory: 'structure', key: 'structure_fit', displayName: 'Structure Fit', order: 2 },
  { engineCategory: 'connection', key: 'emotional_communication', displayName: 'Emotional & Communication', order: 3 },
  { engineCategory: 'chemistry', key: 'sexual_compatibility', displayName: 'Sexual Compatibility', order: 4 },
  { engineCategory: 'lifestyle', key: 'practical_fit', displayName: 'Practical Fit', order: 5 },
]

/** Exact display names, in engine order — the AI must echo these verbatim. */
export const SECTION_DISPLAY_NAMES = SECTIONS.map((s) => s.displayName)

// ── Classification bands (authoritative) ──
export type Band = 'exceptional' | 'strong' | 'compatible' | 'some_differences' | 'meaningful_difference'

export interface BandResult {
  band: Band
  /** Display label. Special-cases a perfect 100 as "Fully Aligned". */
  label: string
  /** Design colour token (CSS var name, resolved by the UI layer). */
  colorToken: string
}

export function scoreToBand(score: number): BandResult {
  const s = clamp(score)
  if (s >= 90) {
    return { band: 'exceptional', label: s === 100 ? 'Fully Aligned' : 'Exceptional Alignment', colorToken: 'haevn-teal-strong' }
  }
  if (s >= 80) return { band: 'strong', label: 'Strong Alignment', colorToken: 'haevn-teal' }
  if (s >= 70) return { band: 'compatible', label: 'Compatible', colorToken: 'haevn-green' }
  if (s >= 60) return { band: 'some_differences', label: 'Some Differences', colorToken: 'haevn-amber' }
  return { band: 'meaningful_difference', label: 'Meaningful Difference', colorToken: 'haevn-red' }
}

/**
 * Overall match badge (unlocked card). Same five bands, uppercased "<BAND> MATCH".
 * Per the locked decision, engine `tier` (Platinum/Gold/…) stays internal and is
 * never shown to members.
 */
export function overallBadge(score: number): { band: Band; label: string } {
  const { band } = scoreToBand(score)
  const label =
    band === 'exceptional'
      ? 'EXCEPTIONAL MATCH'
      : band === 'strong'
        ? 'STRONG MATCH'
        : band === 'compatible'
          ? 'COMPATIBLE MATCH'
          : band === 'some_differences'
            ? 'FAIR MATCH'
            : 'LOW MATCH'
  return { band, label }
}

// ── Parse the raw engine breakdown array into ordered, banded sections ──
export interface EngineSubScore {
  key: string
  score: number
  reason: string
  matched: boolean
}

export interface Section {
  key: string
  engineCategory: SectionDef['engineCategory']
  displayName: string
  order: number
  score: number
  band: BandResult
  /** 0–1 fraction of the category backed by answered data (drives "limited data"). */
  coverage: number | null
  subScores: EngineSubScore[]
}

type RawCategory = {
  category?: string
  score?: number
  coverage?: number | null
  subScores?: Array<{ key?: string; score?: number; reason?: string; matched?: boolean }>
}

/**
 * Map the raw `computed_matches.breakdown` array → the five ordered sections.
 * Missing categories are surfaced with score 0 + null coverage (never dropped,
 * never fabricated). Always returns exactly five sections in engine order.
 */
export function parseSections(rawBreakdown: unknown): Section[] {
  const arr: RawCategory[] = Array.isArray(rawBreakdown) ? (rawBreakdown as RawCategory[]) : []
  const byCategory = new Map<string, RawCategory>()
  for (const c of arr) if (c && typeof c.category === 'string') byCategory.set(c.category, c)

  return SECTIONS.map((def) => {
    const raw = byCategory.get(def.engineCategory)
    const score = raw && typeof raw.score === 'number' ? Math.round(clamp(raw.score)) : 0
    const subScores: EngineSubScore[] = Array.isArray(raw?.subScores)
      ? raw!.subScores!.map((s) => ({
          key: String(s.key ?? ''),
          score: typeof s.score === 'number' ? Math.round(s.score) : 0,
          reason: String(s.reason ?? ''),
          matched: !!s.matched,
        }))
      : []
    return {
      key: def.key,
      engineCategory: def.engineCategory,
      displayName: def.displayName,
      order: def.order,
      score,
      band: scoreToBand(score),
      coverage: raw && typeof raw.coverage === 'number' ? raw.coverage : null,
      subScores,
    }
  })
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}
