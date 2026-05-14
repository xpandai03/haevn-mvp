import { format, isToday, isYesterday } from 'date-fns'
import { parseMeetupSuggestionMessage } from '@/lib/chat/meetupMessage'

/** Short relative / calendar label for conversation list rows. */
export function formatConversationListTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffM = Math.floor(diffMs / 60000)
  if (diffM < 1) return 'Just now'
  if (diffM < 60) return `${diffM}m ago`

  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d')
}

export function formatConversationPreviewText(
  body: string,
  imageUrl?: string | null
): string {
  const meetup = parseMeetupSuggestionMessage(body)
  if (meetup) {
    return `Meetup · ${meetup.venue_name}`
  }
  const t = body?.trim()
  if (t) {
    return t.length > 52 ? `${t.slice(0, 50)}…` : t
  }
  if (imageUrl) return 'Photo'
  return 'No messages yet'
}
