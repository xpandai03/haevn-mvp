import type { ReactNode } from 'react'
import { requireAdminPage } from '@/lib/admin/requireAdmin'
import { AdminShell } from '@/components/admin/AdminShell'

/**
 * Route-group layout for the legacy admin TOOLS pages (Matching Ops, Import
 * Users, Match Inspection). Mirrors the (network) group: gates once via
 * requireAdminPage() and wraps in AdminShell so the pages are presentational —
 * their old inline gates + header/back-link chrome are gone in favor of the shell.
 */
export default async function AdminToolsLayout({ children }: { children: ReactNode }) {
  await requireAdminPage()
  return <AdminShell>{children}</AdminShell>
}
