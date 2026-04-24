import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { UpgradeBar } from './UpgradeBar'
import { loadSidebarContext } from '@/lib/dashboard/loadSidebarContext'

interface DashboardShellProps {
  children: ReactNode
}

/**
 * Shared dashboard frame — desktop Sidebar + mobile BottomNav + cream bg.
 * Each post-login segment wraps its page in this via a tiny layout.tsx.
 *
 * Server component: loads sidebar context (user name + tier) once per
 * request. The actual dashboard data loading stays on each page.
 */
export async function DashboardShell({ children }: DashboardShellProps) {
  const ctx = await loadSidebarContext()

  return (
    <div className="dash-layout min-h-screen">
      <Sidebar tier={ctx.tier} userName={ctx.userName} />

      <UpgradeBar tier={ctx.tier} />

      <main className="md:ml-64 pb-24 md:pb-0">{children}</main>

      <BottomNav />
    </div>
  )
}
