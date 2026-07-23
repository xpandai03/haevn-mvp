'use client'

/**
 * Persistent admin shell: fixed left sidebar (desktop) / slide-over (tablet+mobile).
 * Phase 1 wraps only the Network Performance dashboard (route group
 * app/admin/(network)); other nav items are reserved, disabled, and link nowhere
 * — no dead links promising pages that don't exist yet.
 */

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Users,
  ClipboardList,
  Sparkles,
  Link2,
  FileText,
  FileBarChart,
  Settings,
  SlidersHorizontal,
  Wrench,
  Menu,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

type NavKey = 'network-performance' | 'matches' | 'users'

/** Which nav item the current path maps to (null = none / a non-nav admin route). */
function deriveActive(pathname: string): NavKey | null {
  if (pathname.startsWith('/admin/matches')) return 'matches'
  if (pathname.startsWith('/admin/users')) return 'users'
  if (pathname.startsWith('/admin/network-performance')) return 'network-performance'
  return null
}

interface NavItem {
  key: string
  label: string
  icon: typeof BarChart3
  href?: string
}

const PRIMARY_NAV: NavItem[] = [
  { key: 'network-performance', label: 'Network Performance', icon: BarChart3, href: '/admin/network-performance' },
  { key: 'users', label: 'Users', icon: Users, href: '/admin/users' },
  { key: 'surveys', label: 'Surveys', icon: ClipboardList },
  { key: 'matches', label: 'Matches', icon: Sparkles, href: '/admin/matches' },
  { key: 'connections', label: 'Connections', icon: Link2 },
  { key: 'content', label: 'Content', icon: FileText },
  { key: 'reports', label: 'Reports', icon: FileBarChart },
  { key: 'settings', label: 'Settings', icon: Settings },
]

function NavList({ active, onNavigate }: { active: NavKey | null; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {PRIMARY_NAV.map((item) => {
        const Icon = item.icon
        const isActive = item.key === active
        const base =
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition'

        // Any item with an href is a real link (active-styled when current), so
        // built pages navigate between each other. Others stay reserved/disabled.
        if (item.href) {
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={`${base} ${
                isActive ? 'bg-haevn-teal/10 text-haevn-teal' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        }

        // Reserved / coming-soon — not a link, not clickable.
        return (
          <div
            key={item.key}
            aria-disabled="true"
            title="Coming soon"
            className={`${base} cursor-not-allowed text-gray-400`}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-60" />
            <span>{item.label}</span>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-300">soon</span>
          </div>
        )
      })}

      {/* Tools area. */}
      <div className="mt-6 border-t pt-4">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Tools
        </p>
        <Link
          href="/admin/matching"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          Matching Ops
        </Link>
        <div
          aria-disabled="true"
          title="Coming soon"
          className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400"
        >
          <Wrench className="h-4 w-4 shrink-0 opacity-60" />
          <span>Utilities</span>
          <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-300">soon</span>
        </div>
      </div>
    </nav>
  )
}

function SidebarInner({ active, onNavigate }: { active: NavKey | null; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b px-5 py-4">
        <Link href="/admin/network-performance" onClick={onNavigate} className="inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/haevn-logo-with-icon.svg" alt="HAEVN" className="h-8 w-auto" />
        </Link>
        <p className="mt-1.5 text-[10px] uppercase tracking-wide text-gray-400">Admin Console</p>
      </div>
      <NavList active={active} onNavigate={onNavigate} />
    </div>
  )
}

export function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const active = deriveActive(usePathname() ?? '')

  return (
    <div className="min-h-screen bg-haevn-cream">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r lg:block">
        <SidebarInner active={active} />
      </aside>

      {/* Mobile / tablet top bar with slide-over */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white px-4 py-3 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            aria-label="Open navigation"
            className="rounded-md border p-1.5 text-gray-600 hover:bg-gray-50"
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarInner active={active} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <p className="text-sm font-semibold text-haevn-navy">HAEVN Admin</p>
      </div>

      <main className="lg:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
