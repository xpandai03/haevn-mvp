import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export default function AccountDetailsLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
