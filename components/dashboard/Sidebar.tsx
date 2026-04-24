'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users as UsersIcon,
  MessageCircle,
  User as UserIcon,
  MapPin,
  Eye,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface SidebarProps {
  tier?: 'free' | 'plus' | 'select'
  userName?: string
  isAdmin?: boolean
}

const NAV_LINKS = [
  { href: '/dashboard/matches', label: 'Matches', Icon: UsersIcon },
  { href: '/messages', label: 'Messages', Icon: MessageCircle },
  {
    href: '#meetups',
    label: 'Meetups',
    Icon: MapPin,
    comingSoon: true,
  },
  {
    href: '#hidden',
    label: 'Hidden',
    Icon: Eye,
    comingSoon: true,
  },
  { href: '/profile', label: 'Profile', Icon: UserIcon },
] as const

export function Sidebar({
  tier = 'free',
  userName,
  isAdmin = false,
}: SidebarProps) {
  const pathname = usePathname() || ''
  const { toast } = useToast()

  const handleComingSoon = (label: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    toast({
      title: `${label} — coming soon`,
      description: 'This feature is on the way.',
    })
  }

  return (
    <aside
      data-testid="dash-sidebar"
      className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-white border-r border-[color:var(--haevn-border)] z-40"
    >
      {/* Logo */}
      <Link
        href="/dashboard"
        className="block px-6 py-8"
        aria-label="HAEVN home"
      >
        <img
          src="/haevn-wordmark.svg"
          alt="HAEVN"
          className="h-7 w-auto"
        />
        <p className="mt-2 text-[10px] tracking-[0.22em] uppercase text-[color:var(--haevn-muted-fg)]">
          Austin Network
        </p>
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1" aria-label="Primary">
        {NAV_LINKS.map(({ href, label, Icon, comingSoon }) => {
          const active =
            !comingSoon &&
            (pathname === href || pathname.startsWith(`${href}/`))
          return (
            <Link
              key={label}
              href={href}
              onClick={comingSoon ? handleComingSoon(label) : undefined}
              aria-current={active ? 'page' : undefined}
              data-disabled={comingSoon ? 'true' : undefined}
              className={cn(
                'dash-nav-link text-sm',
                active && 'font-medium'
              )}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2 : 1.5}
                className="shrink-0"
              />
              <span className="flex-1">{label}</span>
              {comingSoon && (
                <span className="text-[10px] tracking-wider uppercase text-[color:var(--haevn-muted-fg)]">
                  Soon
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Admin-only: control center link */}
      {isAdmin && (
        <div className="px-3 pb-2 pt-2 border-t border-[color:var(--haevn-border)]">
          <Link
            href="/admin/matching"
            aria-current={
              pathname.startsWith('/admin') ? 'page' : undefined
            }
            className={cn('dash-nav-link text-sm')}
          >
            <Shield size={18} strokeWidth={1.5} className="shrink-0" />
            <span className="flex-1">Control Center</span>
            <span className="text-[10px] tracking-wider uppercase text-[color:var(--haevn-muted-fg)]">
              Admin
            </span>
          </Link>
        </div>
      )}

      {/* User / tier footer */}
      <div className="px-6 py-5 border-t border-[color:var(--haevn-border)]">
        {userName && (
          <p className="text-sm text-[color:var(--haevn-navy)] truncate mb-1">
            {userName}
          </p>
        )}
        <span
          className={cn(
            'inline-block text-[10px] tracking-[0.14em] uppercase px-2 py-0.5',
            tier === 'free'
              ? 'text-[color:var(--haevn-muted-fg)] bg-[color:var(--haevn-dash-surface-alt)]'
              : 'text-[color:var(--haevn-gold)] bg-[rgba(226,158,12,0.08)]'
          )}
        >
          {tier === 'free' ? 'Member' : 'HAEVN+'}
        </span>
      </div>
    </aside>
  )
}
