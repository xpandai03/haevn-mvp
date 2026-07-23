/**
 * Admin nav config. Run: npx tsx lib/admin/__tests__/adminNav.test.ts
 * The suite is EXACTLY four pages + Tools/Matching Ops; removed sections are gone.
 */
import { PRIMARY_NAV, TOOLS_NAV, deriveActive } from '../adminNav'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

// exactly four primary pages, in order
eq(PRIMARY_NAV.map((n) => n.key), ['network-performance', 'users', 'matches', 'surveys'], 'exactly four primary pages')
ok(PRIMARY_NAV.every((n) => n.href.startsWith('/admin/')), 'every primary item is a real /admin link')

// removed sections must be absent
const keys = new Set(PRIMARY_NAV.map((n) => n.key as string))
for (const gone of ['connections', 'content', 'reports', 'settings', 'utilities']) {
  ok(!keys.has(gone), `removed section absent: ${gone}`)
}

// Tools = Matching Ops
eq(TOOLS_NAV.href, '/admin/matching', 'Tools → Matching Ops')

// deriveActive mapping
eq(deriveActive('/admin/surveys'), 'surveys', 'surveys active')
eq(deriveActive('/admin/matches'), 'matches', 'matches active')
eq(deriveActive('/admin/users'), 'users', 'users active')
eq(deriveActive('/admin/network-performance'), 'network-performance', 'NP active')
eq(deriveActive('/admin/matching'), null, 'Matching Ops (Tools) is not a primary key')
eq(deriveActive('/admin/whatever'), null, 'unknown → null')

report('adminNav')
