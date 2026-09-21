'use client'

/**
 * Network Performance — Founding promo totals.
 *
 * Deliberately two numbers and a link, not a funnel. The dashboard answers
 * "how is the network doing"; "is the promo converting" is a different question
 * with its own page, and duplicating that funnel here would mean two places to
 * keep true. Reads the same allowlist-gated endpoint the page does.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Award, ArrowRight } from 'lucide-react'
import type { FoundingSummary } from '@/lib/admin/foundingMembers'

export function FoundingPromoRow() {
  const [s, setS] = useState<FoundingSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/founding-members', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.summary) setS(d.summary) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // A dashboard section must not break because one endpoint is slow or failing.
  if (!s) return null

  return (
    <Link
      href="/admin/founding-members"
      className="mt-4 flex items-center justify-between gap-4 rounded-xl border bg-white px-5 py-4 transition hover:bg-black/[0.02]"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md" style={{ background: '#00808014' }}>
          <Award size={17} style={{ color: '#008080' }} />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--haevn-muted-fg)]">
            Founding activations
          </p>
          <p className="text-[13px] text-[color:var(--haevn-muted-fg)]">
            {s.compCount > 0 ? `${s.compCount} comped accounts excluded` : 'promo activations only'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-2xl font-bold leading-none text-[color:var(--haevn-navy)]">{s.total}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-[color:var(--haevn-muted-fg)]">total</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold leading-none text-[color:var(--haevn-navy)]">{s.activatedThisWeek}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-[color:var(--haevn-muted-fg)]">7 days</p>
        </div>
        <ArrowRight size={16} className="text-[color:var(--haevn-muted-fg)]" />
      </div>
    </Link>
  )
}
