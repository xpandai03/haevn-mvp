/**
 * Goose result copy — the five approved result experiences, VERBATIM from the
 * locked Goose integration contract v1.0 ("Band copy"). Static per band; no AI.
 *
 * Event-neutral on purpose: a 38% and a 91% must both read honestly to a guest
 * looking up someone standing in the same room, and nothing claims "HAEVN
 * matched you". This is NOT the member-app vocabulary in
 * lib/matches/sectionMapping.ts (different labels, different 0–59 wording) and
 * must not be merged with it.
 *
 * Do not edit wording here without a contract revision.
 */

export type GooseBand = 'exceptional' | 'strong' | 'compatible' | 'some_differences' | 'meaningful_differences'

export interface GooseBandCopy {
  band: GooseBand
  /** Inclusive score range. */
  min: number
  max: number
  classification: string
  headline: string
  considerations: string
}

export const GOOSE_BAND_COPY: readonly GooseBandCopy[] = [
  {
    band: 'exceptional',
    min: 90,
    max: 100,
    classification: 'Exceptional Alignment',
    headline: 'AN EXCEPTIONAL MATCH',
    considerations:
      "You two align across nearly everything that matters: what you're looking for, how you connect, and how you live. Conversations here tend to feel easy from the start.",
  },
  {
    band: 'strong',
    min: 80,
    max: 89,
    classification: 'Strong Alignment',
    headline: 'A STRONG MATCH',
    considerations:
      "You share strong common ground in what you want and how you relate. A few differences exist, and they're the interesting kind worth talking about.",
  },
  {
    band: 'compatible',
    min: 70,
    max: 79,
    classification: 'Compatible',
    headline: 'A COMPATIBLE MATCH',
    considerations:
      "There's real compatibility here: your goals and styles line up in several core areas, with some genuine differences that a good conversation would surface.",
  },
  {
    band: 'some_differences',
    min: 60,
    max: 69,
    classification: 'Some Differences',
    headline: 'A MIXED MATCH',
    considerations:
      'You connect in some areas and differ in others that tend to matter. Worth a conversation if something about them already caught your attention.',
  },
  {
    band: 'meaningful_differences',
    min: 0,
    max: 59,
    classification: 'Meaningful Differences',
    headline: 'A LONG-SHOT MATCH',
    considerations:
      "Your answers point in different directions on several things that usually matter. That doesn't rule out a great conversation, but the compatibility signals are limited.",
  },
] as const

/** Clamp to an integer 0–100. Non-finite input reads as 0 (never throws). */
export function toCompatibilityPct(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(100, Math.round(score)))
}

/** The band for a score. Hard-gated pairs score 0 and land in the 0–59 band. */
export function gooseBandFor(score: number): GooseBandCopy {
  const pct = toCompatibilityPct(score)
  return GOOSE_BAND_COPY.find((b) => pct >= b.min && pct <= b.max)!
}

export function gooseCopyForBand(band: GooseBand): GooseBandCopy {
  const copy = GOOSE_BAND_COPY.find((b) => b.band === band)
  if (!copy) throw new Error(`unknown goose band: ${band}`)
  return copy
}
