'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface ContextBarProps {
  tier: 'free' | 'plus'
  firstName?: string
  city?: string
  intent?: string
}

/**
 * Top context bar (black, sticky, full-width) — mirrors the Emergent demo's
 * DemoLayout context bar.
 *
 *  - Free/member: "Viewing as {firstName} · {city} · {intent}" + a gold
 *    "View as HAEVN+ Member" call-to-action linking to the upgrade flow.
 *  - HAEVN+: "HAEVN+ · Full access enabled".
 *
 * Product note: the demo's right-hand control is a literal tier *switch*.
 * Production has no member-preview mode, so for free users it links to the
 * upgrade page; for HAEVN+ users it is informational only (no toggle).
 */
export function ContextBar({ tier, firstName, city, intent }: ContextBarProps) {
  // Trailing segments after "Viewing as {name}" (city, intent).
  const trailing = [city, intent].filter(Boolean) as string[]

  return (
    <div className="sticky top-0 z-50 w-full bg-black text-white">
      <div className="flex h-11 items-center justify-between px-4 md:px-6">
        {tier === 'free' ? (
          <p className="truncate text-xs tracking-wide text-white/80">
            Viewing as{' '}
            <span className="font-medium text-white">
              {firstName || 'a Member'}
            </span>
            {trailing.map((seg) => (
              <span key={seg}>
                <span className="text-white/40"> · </span>
                {seg}
              </span>
            ))}
          </p>
        ) : (
          <p className="truncate text-xs tracking-wide text-white/80">
            <span className="font-medium text-[color:var(--haevn-gold)]">
              HAEVN+
            </span>{' '}
            · Full access enabled
          </p>
        )}

        {tier === 'free' && (
          <Link
            href="/onboarding/membership"
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-[color:var(--haevn-gold)] transition-colors hover:text-[#F5B731]"
          >
            <ChevronRight
              size={14}
              strokeWidth={2.5}
              className="animate-pulse"
            />
            View as HAEVN+ Member
          </Link>
        )}
      </div>
    </div>
  )
}
