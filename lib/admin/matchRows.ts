/**
 * Pure row logic for the /admin/matches list — band/status/name/market derivation
 * plus filter/sort/paginate/counts. No DB here (the route batches the reads and
 * builds MatchRow[]); this is the tested core so search/sort/filter stay correct
 * and server-side.
 */

import { MATCH_MIN_SCORE, REC_MIN_SCORE } from '@/lib/matching/scoreBands'

export type Band = 'match' | 'rec' | 'below'
export type ReleaseStatus = 'pending' | 'released'
export type Connection = 'connected' | 'conversation' | 'passed' | 'ready_to_meet' | null

export interface MatchRow {
  id: string
  partnershipA: string
  partnershipB: string
  nameA: string | null
  nameB: string | null
  score: number
  band: Band
  tier: string | null
  cityA: string | null
  cityB: string | null
  marketA: string | null
  marketB: string | null
  computedAt: string | null
  releaseAt: string | null
  expiresAt: string | null
  releaseStatus: ReleaseStatus
  notified: boolean
  saved: boolean
  connection: Connection
  inspectHref: string
}

export interface MatchFilters {
  search?: string
  band?: 'all' | 'match' | 'rec'
  status?: 'all' | 'pending' | 'released' | 'notified'
  market?: string // 'all' | <market_name> | 'unresolved'
  scoreMin?: number
  scoreMax?: number
}

export type SortKey = 'score' | 'computed_at' | 'release_at' | 'name'

// ── derivations ──────────────────────────────────────────────────────────────

/** Band from score — same source of truth as the dashboard (scoreBands). */
export function bandOf(score: number): Band {
  if (score >= MATCH_MIN_SCORE) return 'match'
  if (score >= REC_MIN_SCORE) return 'rec'
  return 'below'
}

export function releaseStatusOf(releaseAt: string | null, nowIso: string): ReleaseStatus {
  return releaseAt != null && releaseAt <= nowIso ? 'released' : 'pending'
}

/** "Alex Chen" → "Alex C."; single name → "Alex"; empty → null. PII ≤ old page. */
export function shortName(fullName: string | null | undefined): string | null {
  if (!fullName) return null
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  const first = parts[0]
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  return last ? `${first} ${last[0].toUpperCase()}.` : first
}

/** Column label from the two sides' resolved markets: market once if both agree. */
export function marketDisplay(marketA: string | null, marketB: string | null): string {
  if (marketA && marketB && marketA === marketB) return marketA
  const a = marketA ?? 'Unresolved'
  const b = marketB ?? 'Unresolved'
  return a === b ? a : `${a} / ${b}`
}

// ── filter / sort / paginate / counts ────────────────────────────────────────

export function filterRows(rows: MatchRow[], f: MatchFilters): MatchRow[] {
  const q = f.search?.trim().toLowerCase()
  return rows.filter((r) => {
    if (f.band === 'match' && r.band !== 'match') return false
    if (f.band === 'rec' && r.band !== 'rec') return false

    if (f.status === 'pending' && r.releaseStatus !== 'pending') return false
    if (f.status === 'released' && r.releaseStatus !== 'released') return false
    if (f.status === 'notified' && !r.notified) return false

    if (f.market && f.market !== 'all') {
      if (f.market === 'unresolved') {
        if (r.marketA !== null || r.marketB !== null) return false
      } else if (r.marketA !== f.market && r.marketB !== f.market) {
        return false
      }
    }

    if (typeof f.scoreMin === 'number' && r.score < f.scoreMin) return false
    if (typeof f.scoreMax === 'number' && r.score > f.scoreMax) return false

    if (q) {
      const hay = `${r.nameA ?? ''} ${r.nameB ?? ''} ${r.partnershipA} ${r.partnershipB}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function sortRows(rows: MatchRow[], key: SortKey, dir: 'asc' | 'desc'): MatchRow[] {
  const mul = dir === 'asc' ? 1 : -1
  const val = (r: MatchRow): string | number => {
    switch (key) {
      case 'score': return r.score
      case 'computed_at': return r.computedAt ?? ''
      case 'release_at': return r.releaseAt ?? ''
      case 'name': return (r.nameA ?? r.partnershipA).toLowerCase()
    }
  }
  // stable sort with id tiebreak
  return [...rows].sort((a, b) => {
    const va = val(a), vb = val(b)
    if (va < vb) return -1 * mul
    if (va > vb) return 1 * mul
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

export function paginate<T>(rows: T[], page: number, pageSize: number): { pageRows: T[]; total: number } {
  const total = rows.length
  const start = Math.max(0, (page - 1) * pageSize)
  return { pageRows: rows.slice(start, start + pageSize), total }
}

export interface MatchCounts {
  matches: number
  recommendations: number
  released: number
  notified: number
  connected: number
}

export function computeCounts(rows: MatchRow[]): MatchCounts {
  const c: MatchCounts = { matches: 0, recommendations: 0, released: 0, notified: 0, connected: 0 }
  for (const r of rows) {
    if (r.band === 'match') c.matches++
    else if (r.band === 'rec') c.recommendations++
    if (r.releaseStatus === 'released') c.released++
    if (r.notified) c.notified++
    if (r.connection === 'connected') c.connected++
  }
  return c
}
