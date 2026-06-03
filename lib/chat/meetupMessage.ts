/** Stored in messages.content; rendered as a card in chat UI. */
export const MEETUP_MESSAGE_PREFIX = '__HAEVN_MEETUP:v1__'

export type MeetupSuggestionPayload = {
  venue_name: string
  venue_type: string
  /** Distance line — e.g. "You: ~1.0 mi · Alex: ~1.3 mi" */
  distance: string
  note: string
  emoji?: string
  /** Optional helper line under the distances, e.g. "Roughly halfway…" */
  subtitle?: string
}

export function encodeMeetupSuggestionMessage(payload: MeetupSuggestionPayload): string {
  return MEETUP_MESSAGE_PREFIX + JSON.stringify(payload)
}

export function parseMeetupSuggestionMessage(
  body: string
): MeetupSuggestionPayload | null {
  if (!body || !body.startsWith(MEETUP_MESSAGE_PREFIX)) return null
  try {
    const raw = body.slice(MEETUP_MESSAGE_PREFIX.length)
    const o = JSON.parse(raw) as MeetupSuggestionPayload
    if (
      typeof o?.venue_name === 'string' &&
      typeof o?.venue_type === 'string' &&
      typeof o?.distance === 'string' &&
      typeof o?.note === 'string'
    ) {
      return o
    }
  } catch {
    /* ignore */
  }
  return null
}
