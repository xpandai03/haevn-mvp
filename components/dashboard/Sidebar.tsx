'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  Users as UsersIcon,
  MessageCircle,
  User as UserIcon,
  MapPin,
  Eye,
  Shield,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth/context'

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
  const router = useRouter()
  const { toast } = useToast()
  const { signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const footerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (!footerRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  const handleComingSoon = (label: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    toast({
      title: `${label} — coming soon`,
      description: 'This feature is on the way.',
    })
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      router.push('/')
      router.refresh()
    } catch (err) {
      console.error('[Sidebar] Sign out failed:', err)
      setSigningOut(false)
    }
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

      {/* User / tier footer — click to open sign-out menu */}
      <div
        ref={footerRef}
        className="relative border-t border-[color:var(--haevn-border)]"
      >
        {menuOpen && (
          <div className="absolute bottom-full left-0 right-0 bg-white border-t border-x border-[color:var(--haevn-border)] shadow-md">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full flex items-center gap-3 px-6 py-3 text-left text-sm text-[color:var(--haevn-navy)] hover:bg-[color:var(--haevn-dash-surface-alt)] disabled:opacity-50"
            >
              <LogOut size={16} strokeWidth={1.5} />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="w-full text-left px-6 py-5 hover:bg-[color:var(--haevn-dash-surface-alt)] transition-colors"
        >
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
        </button>
      </div>
    </aside>
  )
}
