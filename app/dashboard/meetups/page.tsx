'use client'

import { useMemo, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  PLACEHOLDER_MEETUP_VENUES,
  type MeetupVenueType,
} from '@/lib/meetups/placeholderVenues'

const FILTERS: Array<'All' | MeetupVenueType> = [
  'All',
  'Coffee',
  'Drinks',
  'Activity',
  'Dinner',
]

export default function MeetupsPage() {
  const { toast } = useToast()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')

  const venues = useMemo(() => {
    if (filter === 'All') return PLACEHOLDER_MEETUP_VENUES
    return PLACEHOLDER_MEETUP_VENUES.filter((v) => v.type === filter)
  }, [filter])

  return (
    <div className="w-full">
      <header className="border-b border-[color:var(--haevn-border)] px-6 pb-6 pt-10 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--haevn-teal)]">
            HAEVN Austin
          </p>
          <h1 className="font-heading mt-2 text-3xl leading-tight text-[color:var(--haevn-navy)] sm:text-4xl">
            Meetups
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--haevn-muted-fg)]">
            Curated spots recommended for you and your matches based on shared
            preferences — coffee, drinks, activities, and more. Venues shown
            here are placeholders while we onboard local partners.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 sm:px-10 sm:py-12">
        <div className="mb-8 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-[color:var(--haevn-teal)] text-white'
                  : 'border border-[color:var(--haevn-border)] bg-white text-[color:var(--haevn-charcoal)] hover:bg-[color:var(--haevn-dash-surface-alt)]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => (
            <article
              key={v.id}
              className="dash-card flex flex-col overflow-hidden p-5 transition-colors hover:border-[color:var(--haevn-teal)]/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xl" aria-hidden>
                  {v.emoji}
                </span>
                <span className="rounded-full bg-[rgba(0,128,128,0.1)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--haevn-teal)]">
                  {v.type}
                </span>
              </div>
              <h2 className="font-heading mt-3 text-lg text-[color:var(--haevn-navy)]">
                {v.name}
              </h2>
              <p className="mt-1 text-xs text-[color:var(--haevn-muted-fg)]">
                {v.neighborhood} · {v.distance}
              </p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-[color:var(--haevn-charcoal)]">
                {v.description}
              </p>
              <div className="mt-4 border-t border-[color:var(--haevn-border)] pt-4">
                <button
                  type="button"
                  className="haevn-btn-teal w-full text-sm"
                  onClick={() =>
                    toast({
                      title: 'Suggest to match',
                      description:
                        'Open Messages, pick a chat, and tap the location pin to share a meetup card like this.',
                    })
                  }
                >
                  Suggest to match
                </button>
              </div>
            </article>
          ))}
        </div>

        {venues.length === 0 && (
          <p className="text-center text-sm text-[color:var(--haevn-muted-fg)]">
            No venues in this category yet.
          </p>
        )}
      </main>
    </div>
  )
}
