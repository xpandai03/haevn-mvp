'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ExternalLink,
  Coffee,
  Wine,
  UtensilsCrossed,
  Building2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import {
  MEETUP_NEIGHBORHOODS,
  type MeetupVenueTag,
} from '@/lib/meetups/neighborhoodVenues'

const TAG_CONFIG: Record<
  MeetupVenueTag,
  { className: string; Icon: LucideIcon }
> = {
  Coffee: { className: 'bg-[#F9F5EB] text-[#92700C]', Icon: Coffee },
  Cocktails: { className: 'bg-[#EEF1F5] text-[#1E2A4A]', Icon: Wine },
  Dinner: { className: 'bg-[#F0ECEC] text-[#6B4040]', Icon: UtensilsCrossed },
  Hotel: { className: 'bg-[#E8F0F0] text-[#006868]', Icon: Building2 },
  Activity: { className: 'bg-[#F3EFF8] text-[#5B4A8A]', Icon: Sparkles },
}

export default function MeetupsPage() {
  // First neighborhood open by default; the rest collapsed.
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set([MEETUP_NEIGHBORHOODS[0]?.neighborhood])
  )

  const toggle = (neighborhood: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(neighborhood)) next.delete(neighborhood)
      else next.add(neighborhood)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-[#EEECEA]">
      {/* Centered content */}
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pb-12">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl tracking-tight text-[color:var(--haevn-navy)]">
            Meetup Spots
          </h1>
          <p className="mt-2 text-[13px] text-[color:var(--haevn-muted-fg)]">
            If you&rsquo;re looking for a good spot to meet up with your new
            connection, check out these local spots
          </p>
        </div>

        {/* Neighborhood accordions */}
        {MEETUP_NEIGHBORHOODS.map((section) => {
          const isOpen = openSections.has(section.neighborhood)
          const activeVenues = section.venues
            .filter((v) => v.status === 'active')
            .slice(0, 5)
          return (
            <div
              key={section.neighborhood}
              className="mb-4 overflow-hidden border border-[color:var(--haevn-border)] bg-white"
            >
              {/* Accordion header */}
              <button
                type="button"
                onClick={() => toggle(section.neighborhood)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-[color:var(--haevn-dash-surface-alt)]"
              >
                <div className="flex flex-1 items-center gap-3">
                  <h2 className="text-sm font-semibold text-[color:var(--haevn-navy)]">
                    {section.neighborhood}
                  </h2>
                  <span className="ml-auto shrink-0 text-xs text-[color:var(--haevn-muted-fg)]">
                    {activeVenues.length} spots
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  strokeWidth={2}
                  className={`ml-3 text-[color:var(--haevn-muted-fg)] transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Accordion content */}
              {isOpen && (
                <div className="border-t border-[color:var(--haevn-border)]">
                  {activeVenues.map((venue) => {
                    const tag = TAG_CONFIG[venue.tag]
                    const TagIcon = tag?.Icon
                    const isLink = venue.link !== '#'
                    return (
                      <a
                        key={venue.name}
                        href={venue.link}
                        target={isLink ? '_blank' : undefined}
                        rel={isLink ? 'noopener noreferrer' : undefined}
                        className="group flex items-center justify-between border-b border-[color:var(--haevn-border)] px-5 py-4 transition-colors last:border-b-0 hover:bg-[#FAFAF8]"
                      >
                        <div className="min-w-0">
                          <div className="mb-1 flex items-center gap-2">
                            <p className="text-sm font-semibold text-[color:var(--haevn-navy)] transition-colors group-hover:text-[color:var(--haevn-teal)]">
                              {venue.name}
                            </p>
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                                tag?.className ??
                                'bg-[#F3F4F6] text-[color:var(--haevn-muted-fg)]'
                              }`}
                            >
                              {TagIcon && <TagIcon size={10} strokeWidth={2} />}
                              {venue.tag}
                            </span>
                          </div>
                          <p className="text-[13px] text-[color:var(--haevn-muted-fg)]">
                            {venue.descriptor}
                          </p>
                          <p className="mt-1 text-xs text-[color:var(--haevn-teal)]">
                            Best for: {venue.bestFor}
                          </p>
                        </div>
                        <ExternalLink
                          size={14}
                          strokeWidth={1.5}
                          className="ml-4 shrink-0 text-[#9CA3AF] transition-colors group-hover:text-[color:var(--haevn-teal)]"
                        />
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
