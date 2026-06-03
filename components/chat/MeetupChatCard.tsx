import { MapPin } from 'lucide-react'
import type { MeetupSuggestionPayload } from '@/lib/chat/meetupMessage'

export function MeetupChatCard({ data }: { data: MeetupSuggestionPayload }) {
  const emoji = data.emoji ?? '☕'
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgba(0,128,128,0.1)]">
        <MapPin className="h-5 w-5 text-[color:var(--haevn-teal)]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-semibold text-[color:var(--haevn-navy)]">
          {emoji} {data.venue_name}
        </p>
        <p className="mt-0.5 text-xs text-[color:var(--haevn-charcoal)]/70">
          {data.venue_type} · {data.distance}
        </p>
        {data.subtitle && (
          <p className="mt-0.5 text-[11px] italic text-[color:var(--haevn-muted-fg)]">
            {data.subtitle}
          </p>
        )}
        <p className="mt-1 text-xs text-[color:var(--haevn-muted-fg)] leading-snug">
          {data.note}
        </p>
        <p className="mt-2 text-[10px] tracking-[0.12em] uppercase text-[color:var(--haevn-teal)]">
          Meetup suggestion
        </p>
      </div>
    </div>
  )
}
