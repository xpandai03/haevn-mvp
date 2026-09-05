'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HaevnLoader } from '@/components/ui/haevn-loader'
import { activateFoundingMembership } from './actions'

/**
 * The offer. Copy is the client's spec text; the term and the city are the only
 * dynamic parts. The city is the caller's resolved displayCity — markets.display_name
 * when the member is in a market, else their own partnerships.city — never a literal,
 * and the sentence still reads correctly when there is neither.
 * Benefits are imported from the existing membership page, not duplicated, so the
 * two surfaces can never drift.
 */
export function FoundingOffer({
  cityName,
  termMonths,
  benefits,
  src,
}: {
  cityName: string
  termMonths: number
  benefits: readonly string[]
  src: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // "…founding members in Austin," when we have a display name; the sentence
  // still reads correctly without one rather than falling back to a hardcoded city.
  const thanks = cityName
    ? `As a thank you for being one of our founding members in ${cityName},`
    : 'As a thank you for being one of our founding members,'

  const activate = () => {
    setError(null)
    startTransition(async () => {
      const res = await activateFoundingMembership(src)
      if (res.status === 'activated' || res.status === 'already_active') {
        router.refresh()
      } else {
        // Eligibility changed under them (flag flipped, tier changed). Send them
        // to the standard page — never explain why, never mention payment.
        router.push('/onboarding/membership')
      }
    })
  }

  return (
    <div className="dash-layout min-h-screen bg-haevn-cream px-4 py-16">
      <div className="mx-auto w-full max-w-[520px] rounded-3xl bg-white p-8 shadow-sm sm:p-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--haevn-gold)]">
          Founding Member Offer
        </p>

        <h1 className="mt-3 font-heading text-3xl leading-tight text-[color:var(--haevn-navy)]">
          Your HAEVN+ upgrade is on us.
        </h1>

        <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--haevn-charcoal)]">
          {thanks} we&rsquo;re giving you {termMonths} months of HAEVN+ — complimentary.
        </p>

        <ul className="mt-6 flex flex-col gap-3">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2.5">
              <Check size={18} className="mt-0.5 shrink-0 text-[color:var(--haevn-teal)]" />
              <span className="text-[15px] text-[color:var(--haevn-charcoal)]">{b}</span>
            </li>
          ))}
        </ul>

        <Button
          onClick={activate}
          disabled={pending}
          size="lg"
          className="mt-8 w-full rounded-full bg-haevn-orange text-white hover:opacity-90"
          style={{ fontWeight: 500, fontSize: '17px' }}
        >
          {pending ? (
            <>
              <HaevnLoader size={18} className="mr-2" />
              Activating...
            </>
          ) : (
            'Activate HAEVN+ Free'
          )}
        </Button>

        <p className="mt-3 text-center text-[13px] text-[color:var(--haevn-muted-fg)]">
          {termMonths} months complimentary. No payment required.
        </p>

        {error && <p className="mt-3 text-center text-[13px] text-haevn-error">{error}</p>}
      </div>
    </div>
  )
}
