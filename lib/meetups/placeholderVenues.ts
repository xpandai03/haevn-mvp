export type MeetupVenueType = 'Coffee' | 'Drinks' | 'Activity' | 'Dinner'

export interface PlaceholderMeetupVenue {
  id: string
  name: string
  type: MeetupVenueType
  neighborhood: string
  distance: string
  description: string
  emoji: string
}

export const PLACEHOLDER_MEETUP_VENUES: PlaceholderMeetupVenue[] = [
  {
    id: '1',
    name: 'Blue Bottle Coffee',
    type: 'Coffee',
    neighborhood: 'South Congress',
    distance: '2.3 miles',
    description:
      'Specialty coffee in a relaxed, modern space. Perfect for a first conversation.',
    emoji: '☕',
  },
  {
    id: '2',
    name: 'The Roosevelt Room',
    type: 'Drinks',
    neighborhood: 'Downtown',
    distance: '3.1 miles',
    description: 'Craft cocktails in an intimate speakeasy setting.',
    emoji: '🍸',
  },
  {
    id: '3',
    name: 'Barton Springs Pool',
    type: 'Activity',
    neighborhood: 'Zilker',
    distance: '4.0 miles',
    description:
      'Natural spring-fed pool. Great for an active, casual date.',
    emoji: '🏊',
  },
  {
    id: '4',
    name: 'Launderette',
    type: 'Dinner',
    neighborhood: 'East Austin',
    distance: '1.8 miles',
    description:
      'New American cuisine in a stylish converted laundromat.',
    emoji: '🍽️',
  },
  {
    id: '5',
    name: 'Peter Pan Mini-Golf',
    type: 'Activity',
    neighborhood: 'South Lamar',
    distance: '2.7 miles',
    description:
      'Classic Austin mini-golf. Low-key and fun for a first meetup.',
    emoji: '⛳',
  },
]
