import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export default function ChatLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
