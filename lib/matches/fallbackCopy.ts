/**
 * Deterministic fallback copy for the "why" when an AI interpretation is not yet
 * cached or has degraded. The client philosophy is that free members ALWAYS get
 * the full why — so the card/breakdown must never show empty analysis or an
 * "unlock to read more" gate. This module derives honest, engine-grounded copy
 * from the section scores + bands alone (zero AI), so a card is fully readable
 * the instant it loads; the richer AI prose replaces it once generation lands.
 *
 * Everything here is app-owned and uses the design section vocabulary — never
 * engine names.
 */

import type { Section } from './sectionMapping'

/** Top N sections by score (ties broken by engine order). */
export function topSections(sections: Section[], n: number): Section[] {
  return [...sections].sort((a, b) => b.score - a.score || a.order - b.order).slice(0, n)
}

/** A grounded one-paragraph "Why HAEVN matched you" from the strongest sections. */
export function fallbackMatchSummary(sections: Section[]): string {
  const top = topSections(sections, 3).filter((s) => s.score >= 70)
  if (top.length === 0) return 'HAEVN matched you on your overall compatibility across the five areas that shape a connection.'
  const names = top.map((s) => s.displayName.toLowerCase())
  const lead = names.slice(0, 2).join(' and ')
  return `You align most on ${lead}${names[2] ? `, with compatible ${names[2]}` : ''} — the areas HAEVN weighs most heavily when deciding an introduction is worth making.`
}

export interface FallbackArea {
  category: string
  summary: string
}

/** Top-3 strongest areas with a short, band-grounded explanation line each. */
export function fallbackStrongestAreas(sections: Section[]): FallbackArea[] {
  return topSections(sections, 3).map((s) => {
    const aligned = s.subScores.find((ss) => ss.matched && ss.score >= 70 && ss.reason)
    const detail = aligned ? aligned.reason.replace(/:\s*\d+%.*$/, '').trim() : s.band.label
    return { category: s.displayName, summary: `${s.band.label} — ${lower(detail)}.` }
  })
}

/** The executive summary fallback for the expanded breakdown header. */
export function fallbackExecutiveSummary(sections: Section[], matchScore: number | null): string {
  const strong = sections.filter((s) => s.score >= 80).map((s) => s.displayName.toLowerCase())
  const weak = [...sections].sort((a, b) => a.score - b.score)[0]
  const strongPart = strong.length ? `strong alignment in ${strong.slice(0, 3).join(', ')}` : 'compatibility across the core areas'
  const weakPart = weak && weak.score < 70 ? `, with ${weak.displayName.toLowerCase()} the area most worth a conversation` : ''
  return `This match is built on ${strongPart}${weakPart}. HAEVN surfaces the pattern, not a promise — the sections below show exactly where you line up.`
}

function lower(s: string): string {
  if (!s) return s
  return s.charAt(0).toLowerCase() + s.slice(1)
}
