/**
 * Pure logic for the /admin/users directory — survey-status/initials derivation
 * plus filter/sort/summary. No DB (the route batches reads and builds UserCard[]).
 */

import { paginate } from './matchRows'

export type SurveyStatus = 'complete' | 'in_progress' | 'not_started'
export type UserSortKey = 'name' | 'member_since' | 'last_sign_in'

export interface UserCard {
  userId: string
  name: string
  email: string
  memberSince: string | null
  city: string | null
  market: string | null
  tier: string | null
  partnerName: string | null
  surveyStatus: SurveyStatus
  completionPct: number | null
  lastSignInAt: string | null
  photoUrl: string | null
  initials: string
  partnershipId: string | null
}

export interface UserFilters {
  search?: string
  survey?: 'all' | SurveyStatus
  login?: 'all' | 'ever' | 'never'
  tier?: 'all' | 'free' | 'pro'
  market?: string // 'all' | <market_name> | 'unresolved'
  photo?: 'all' | 'has' | 'none'
}

export { paginate }

// ── derivations ──────────────────────────────────────────────────────────────

/** completion_pct → survey status (PR #7 definition). */
export function surveyStatusOf(pct: number | null | undefined): SurveyStatus {
  if (pct != null && pct >= 100) return 'complete'
  if (pct != null && pct >= 1) return 'in_progress'
  return 'not_started'
}

/** "Alex Chen" → "AC"; "Cher" → "C"; empty → "?". Uppercased. */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

// ── filter / sort / summary ──────────────────────────────────────────────────

export function filterUsers(rows: UserCard[], f: UserFilters): UserCard[] {
  const q = f.search?.trim().toLowerCase()
  return rows.filter((r) => {
    if (f.survey && f.survey !== 'all' && r.surveyStatus !== f.survey) return false
    if (f.login === 'ever' && r.lastSignInAt == null) return false
    if (f.login === 'never' && r.lastSignInAt != null) return false
    if (f.tier && f.tier !== 'all' && r.tier !== f.tier) return false
    if (f.market && f.market !== 'all') {
      if (f.market === 'unresolved') {
        if (r.market !== null) return false
      } else if (r.market !== f.market) return false
    }
    if (f.photo === 'has' && r.photoUrl == null) return false
    if (f.photo === 'none' && r.photoUrl != null) return false
    if (q) {
      const hay = `${r.name} ${r.email} ${r.userId}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function sortUsers(rows: UserCard[], key: UserSortKey, dir: 'asc' | 'desc'): UserCard[] {
  const mul = dir === 'asc' ? 1 : -1
  const val = (r: UserCard): string => {
    switch (key) {
      case 'name': return (r.name || '').toLowerCase()
      case 'member_since': return r.memberSince ?? ''
      case 'last_sign_in': return r.lastSignInAt ?? '' // nulls sort first asc / last desc
    }
  }
  return [...rows].sort((a, b) => {
    const va = val(a), vb = val(b)
    if (va < vb) return -1 * mul
    if (va > vb) return 1 * mul
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0
  })
}

export interface UsersSummary {
  total: number
  withPhoto: number
  completedSurvey: number
  loggedInEver: number
}

export function summarize(rows: UserCard[]): UsersSummary {
  const s: UsersSummary = { total: rows.length, withPhoto: 0, completedSurvey: 0, loggedInEver: 0 }
  for (const r of rows) {
    if (r.photoUrl != null) s.withPhoto++
    if (r.surveyStatus === 'complete') s.completedSurvey++
    if (r.lastSignInAt != null) s.loggedInEver++
  }
  return s
}
