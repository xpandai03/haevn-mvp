'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users as UsersIcon,
  MessageCircle,
  User as UserIcon,
  MapPin,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const TABS = [
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
  { href: '/profile/edit', label: 'Profile', Icon: UserIcon },
] as const

export function BottomNav() {
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
    <nav
      data-testid="dash-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-xl border-t border-[color:var(--haevn-border)]"
      aria-label="Primary (mobile)"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch justify-around h-16 max-w-lg mx-auto">
        {TABS.map(({ href, label, Icon, comingSoon }) => {
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
                'flex flex-col items-center justify-center gap-1 min-w-[64px] px-3 transition-colors',
                active
                  ? 'text-[color:var(--haevn-gold)]'
                  : 'text-[#4B5563]',
                comingSoon && 'opacity-45'
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
