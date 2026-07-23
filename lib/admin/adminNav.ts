/**
 * Admin suite navigation config — pure data (no icons/JSX) so it's unit-testable.
 * AdminShell renders these + maps key→icon. The suite v1 is exactly four pages;
 * Connections/Content/Reports/Settings/Utilities were removed (client's Jul-20 call).
 */

export type NavKey = 'network-performance' | 'users' | 'matches' | 'surveys'

export interface NavEntry {
  key: NavKey
  label: string
  href: string
}

export const PRIMARY_NAV: NavEntry[] = [
  { key: 'network-performance', label: 'Network Performance', href: '/admin/network-performance' },
  { key: 'users', label: 'Users', href: '/admin/users' },
  { key: 'matches', label: 'Matches', href: '/admin/matches' },
  { key: 'surveys', label: 'Surveys', href: '/admin/surveys' },
]

/** Tools section — the ops tool, kept separate from the primary pages. */
export const TOOLS_NAV = { label: 'Matching Ops', href: '/admin/matching' } as const

/** Which nav item the current path maps to (null = none / a non-nav admin route). */
export function deriveActive(pathname: string): NavKey | null {
  if (pathname.startsWith('/admin/matches')) return 'matches'
  if (pathname.startsWith('/admin/users')) return 'users'
  if (pathname.startsWith('/admin/surveys')) return 'surveys'
  if (pathname.startsWith('/admin/network-performance')) return 'network-performance'
  return null
}
