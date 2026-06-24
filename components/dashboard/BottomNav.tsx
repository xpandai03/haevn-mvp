'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users as UsersIcon,
  Sparkles,
  MessageCircle,
  User as UserIcon,
  MapPin,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/dashboard/matches', label: 'Matches', Icon: UsersIcon },
  { href: '/dashboard/recommendations', label: 'For You', Icon: Sparkles },
  { href: '/messages', label: 'Messages', Icon: MessageCircle },
  { href: '/dashboard/hidden', label: 'Hidden', Icon: Eye },
  { href: '/dashboard/meetups', label: 'Meetups', Icon: MapPin },
  { href: '/profile', label: 'Profile', Icon: UserIcon },
] as const

export function BottomNav() {
  const pathname = usePathname() || ''

  return (
    <nav
      data-testid="dash-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-xl border-t border-[color:var(--haevn-border)]"
      aria-label="Primary (mobile)"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch justify-around h-16 max-w-lg mx-auto">
        {TABS.map((item) => {
          const { href, label, Icon } = item
          const active =
            pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-1 min-w-[64px] px-3 transition-colors',
                active ? 'text-[color:var(--haevn-gold)]' : 'text-[#4B5563]'
              )}
            >
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
              <span className="text-[10px] tracking-[0.12em] uppercase">
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
