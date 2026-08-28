import { MessageCircle } from 'lucide-react'

/**
 * What the chat surface shows while MESSAGING_ENABLED is off.
 *
 * Deliberately says nothing about membership, upgrades, or payment: a member who
 * just activated HAEVN+ through the Founding Member promo lands here, and telling
 * them to upgrade would be both wrong and confusing. No send affordance is
 * rendered at all — the surface is inert, not disabled-looking.
 */
export function MessagingClosed() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--haevn-teal)]/10">
        <MessageCircle size={26} className="text-[color:var(--haevn-teal)]" />
      </div>
      <h2 className="mt-5 font-heading text-2xl text-[color:var(--haevn-navy)]">
        Messaging is coming soon
      </h2>
      <p className="mt-3 max-w-[380px] text-[15px] leading-relaxed text-[color:var(--haevn-muted-fg)]">
        We&rsquo;re putting the finishing touches on messaging. Your connections are
        saved — you&rsquo;ll be able to start conversations here shortly.
      </p>
    </div>
  )
}
