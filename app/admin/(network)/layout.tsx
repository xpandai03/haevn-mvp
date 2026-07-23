import type { ReactNode } from 'react'
import { requireAdminPage } from '@/lib/admin/requireAdmin'
import { AdminShell } from '@/components/admin/AdminShell'

/**
 * Route-group layout for the AdminShell pages (Network Performance + Matches).
 * The other legacy /admin pages keep their own inline gates. Gates once here so
 * the page components stay presentational; AdminShell derives the active nav item
 * from the pathname.
 */
export default async function AdminShellLayout({ children }: { children: ReactNode }) {
  await requireAdminPage()
  return <AdminShell>{children}</AdminShell>
}
