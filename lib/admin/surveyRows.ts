/**
 * Pure logic for the /admin/surveys funnel view. Status = PR #7 completion_pct
 * (reuses surveyStatusOf); never-started rows (no survey record) are first-class.
 */

import { paginate } from './matchRows'
import { surveyStatusOf, type SurveyStatus } from './userCards'

export type { SurveyStatus }
export type SurveySource = 'webhook' | 'import' | null
export type SurveySortKey = 'pct' | 'created' | 'name' | 'last_sign_in'

export interface SurveyRow {
  userId: string
  name: string
  email: string
  city: string | null
  market: string | null
  status: SurveyStatus
  completionPct: number | null
  createdAt: string | null // HAEVN record/arrival time (NOT a live activity signal)
  lastSignInAt: string | null
  source: SurveySource
  partnershipId: string | null
}

export interface SurveyFilters {
  search?: string
  status?: 'all' | SurveyStatus
  band?: 'all' | 'lt25' | 'mid' | 'gt75' // in-progress sub-bands
  market?: string
  login?: 'all' | 'ever' | 'never'
  source?: 'all' | 'webhook' | 'import'
}

export { paginate, surveyStatusOf }

/** Whether an in-progress pct falls in the requested sub-band (1–24 / 25–75 / 76–99). */
export function inBand(pct: number | null, band: 'lt25' | 'mid' | 'gt75'): boolean {
  if (pct == null || pct < 1 || pct >= 100) return false
  if (band === 'lt25') return pct < 25
  if (band === 'mid') return pct >= 25 && pct <= 75
  return pct > 75 // gt75 → 76–99
}

export function filterSurveys(rows: SurveyRow[], f: SurveyFilters): SurveyRow[] {
  const q = f.search?.trim().toLowerCase()
  return rows.filter((r) => {
    if (f.status && f.status !== 'all' && r.status !== f.status) return false
    if (f.band && f.band !== 'all' && !inBand(r.completionPct, f.band)) return false
    if (f.market && f.market !== 'all') {
      if (f.market === 'unresolved') {
        if (r.market !== null) return false
      } else if (r.market !== f.market) return false
    }
    if (f.login === 'ever' && r.lastSignInAt == null) return false
    if (f.login === 'never' && r.lastSignInAt != null) return false
    if (f.source && f.source !== 'all' && r.source !== f.source) return false
    if (q) {
      const hay = `${r.name} ${r.email} ${r.userId}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function sortSurveys(rows: SurveyRow[], key: SurveySortKey, dir: 'asc' | 'desc'): SurveyRow[] {
  const mul = dir === 'asc' ? 1 : -1
  const val = (r: SurveyRow): string | number => {
    switch (key) {
      case 'pct': return r.completionPct ?? -1
      case 'created': return r.createdAt ?? ''
      case 'name': return (r.name || '').toLowerCase()
      case 'last_sign_in': return r.lastSignInAt ?? ''
    }
  }
  return [...rows].sort((a, b) => {
    const va = val(a), vb = val(b)
    if (va < vb) return -1 * mul
    if (va > vb) return 1 * mul
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0
  })
}

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

export interface SurveySummary {
  total: number
  complete: number
  inProgress: number
  neverStarted: number
  medianPctInProgress: number | null
}

export function summarizeSurveys(rows: SurveyRow[]): SurveySummary {
  const s: SurveySummary = { total: rows.length, complete: 0, inProgress: 0, neverStarted: 0, medianPctInProgress: null }
  const inProgPcts: number[] = []
  for (const r of rows) {
    if (r.status === 'complete') s.complete++
    else if (r.status === 'in_progress') { s.inProgress++; if (r.completionPct != null) inProgPcts.push(r.completionPct) }
    else s.neverStarted++
  }
  s.medianPctInProgress = median(inProgPcts)
  return s
}
