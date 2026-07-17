import type { ReactNode } from 'react'
import { requireAdminPage } from '@/lib/admin/requireAdmin'
import { AdminShell } from '@/components/admin/AdminShell'

/**
 * Route-group layout — wraps ONLY the Network Performance dashboard (not the
 * existing /admin pages, which keep their own inline gates this PR). Gates once
 * here so the page component stays presentational.
 */
export default async function NetworkAdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage()
  return <AdminShell active="network-performance">{children}</AdminShell>
}
