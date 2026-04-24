import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
