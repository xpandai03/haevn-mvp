'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'

/**
 * Post-activation state. Also what a returning founding member sees if they open
 * the offer link again — so re-entry is always a confirmation, never a second offer.
 */
export function FoundingConfirmation({ cityName }: { cityName: string }) {
  return (
    <div className="dash-layout min-h-screen bg-haevn-cream px-4 py-16">
      <div className="mx-auto w-full max-w-[520px] rounded-3xl bg-white p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--haevn-teal)]/10">
          <Check size={26} className="text-[color:var(--haevn-teal)]" />
        </div>

        <h1 className="mt-5 font-heading text-3xl leading-tight text-[color:var(--haevn-navy)]">
          Welcome to HAEVN+
        </h1>

        <p className="mt-2 text-[17px] font-medium text-[color:var(--haevn-charcoal)]">
          You&rsquo;re upgraded.
        </p>

        <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--haevn-charcoal)]">
          {cityName
            ? `You're one of our founding members in ${cityName}, and everything HAEVN+ has to offer is open to you.`
            : `You're one of our founding members, and everything HAEVN+ has to offer is open to you.`}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--haevn-charcoal)]">
          Full profiles, compatibility breakdowns, and the ability to connect are all
          yours now.
        </p>

        <Link
          href="/dashboard/matches"
          className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-haevn-orange px-6 py-3 text-white hover:opacity-90"
          style={{ fontWeight: 500, fontSize: '17px' }}
        >
          Continue to HAEVN
        </Link>
      </div>
    </div>
  )
}
