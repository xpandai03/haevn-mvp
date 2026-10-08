/**
 * Pair math for event cohorts. Pure.
 *
 * A cohort's result set is every unordered pair of DISTINCT finalized members,
 * stored once with member_a < member_b (the table's CHECK enforces the same
 * order, so a mirrored row cannot exist).
 */

import { createHash } from 'crypto'
import type { Coverage, PairResultRow } from './types'

/** N(N-1)/2 over distinct ids. */
export function expectedPairs(n: number): number {
  return n < 2 ? 0 : (n * (n - 1)) / 2
}

/** Distinct ids in ascending order — the canonical population. */
export function canonicalPopulation(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort()
}

/** Order a pair the way the table stores it. */
export function canonicalPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x]
}

/** Every unordered pair of a population, canonical order, no self-pairs. */
export function enumeratePairs(ids: readonly string[]): Array<[string, string]> {
  const pop = canonicalPopulation(ids)
  const out: Array<[string, string]> = []
  for (let i = 0; i < pop.length; i++) {
    for (let j = i + 1; j < pop.length; j++) out.push([pop[i], pop[j]])
  }
  return out
}

/** sha256 of the sorted distinct ids — lets both sides prove they mean the same population. */
export function populationHash(ids: readonly string[]): string {
  return createHash('sha256').update(canonicalPopulation(ids).join(',')).digest('hex')
}

/**
 * The coverage rule, in TypeScript. Mirrors public.goose_cohort_coverage
 * (migration 062) so the readiness logic is testable without a database:
 * only rows of the current finalization, canonical, distinct, and with BOTH
 * members in the finalized set count. Duplicates, mirrors, self-pairs,
 * outsiders and stale-finalization rows all fall out.
 */
export function countCoverage(
  finalizedIds: readonly string[],
  rows: ReadonlyArray<Pick<PairResultRow, 'member_a' | 'member_b' | 'finalization_id'>>,
  currentFinalizationId: string | null
): Coverage {
  const pop = new Set(finalizedIds)
  const seen = new Set<string>()
  for (const r of rows) {
    if (!currentFinalizationId || r.finalization_id !== currentFinalizationId) continue
    if (!(r.member_a < r.member_b)) continue // mirror or self-pair: the CHECK rejects these
    if (!pop.has(r.member_a) || !pop.has(r.member_b)) continue
    seen.add(`${r.member_a}|${r.member_b}`) // a repeat collapses: the PK rejects these
  }
  return { finalized_members: pop.size, expected_pairs: expectedPairs(pop.size), completed_pairs: seen.size }
}

export function isComplete(c: Coverage): boolean {
  return c.completed_pairs === c.expected_pairs
}
