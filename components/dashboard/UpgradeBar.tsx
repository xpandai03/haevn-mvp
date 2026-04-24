'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X } from 'lucide-react'

interface UpgradeBarProps {
  tier: 'free' | 'plus' | 'select'
  /** Delay before appearing (ms). Defaults to 15 seconds, matching Emergent. */
  delayMs?: number
}

const STORAGE_KEY = 'haevn_upgrade_nudge_dismissed_v1'

/**
 * Session-level upgrade nudge for free-tier users.
 *
 * Respects sessionStorage so dismissing persists within a single session
 * without annoying the user across tabs. Free-tier only — returns null for
 * paid tiers.
 */
export function UpgradeBar({ tier, delayMs = 15_000 }: UpgradeBarProps) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (tier !== 'free') return
    // Skip if already dismissed this session
    if (typeof window !== 'undefined') {
      try {
        if (sessionStorage.getItem(STORAGE_KEY) === '1') {
          setDismissed(true)
          return
        }
      } catch {
        // sessionStorage may be unavailable (e.g. private mode) — fall through
      }
    }
    const timer = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(timer)
  }, [tier, delayMs])

  const handleDismiss = () => {
    setVisible(false)
    setDismissed(true)
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* noop */
    }
  }

  if (tier !== 'free' || dismissed || !visible) return null

  return (
    <div
      data-testid="upgrade-bar"
      className="md:ml-64 bg-[color:var(--haevn-teal)] text-white"
      role="status"
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-10 py-3 flex items-center gap-4">
        <Sparkles className="w-4 h-4 shrink-0" strokeWidth={1.75} />
        <p className="flex-1 text-sm leading-snug">
          You&rsquo;re viewing as a <span className="font-medium">Member</span>.
          Upgrade to HAEVN+ to unlock full profiles, connect, and message.
        </p>
        <Link
          href="/onboarding/membership"
          className="hidden sm:inline-flex text-sm font-medium underline underline-offset-2 decoration-white/60 hover:decoration-white whitespace-nowrap"
        >
          Upgrade
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
