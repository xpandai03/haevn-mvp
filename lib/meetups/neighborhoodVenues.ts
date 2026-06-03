/**
 * Meetup venue guide — organized by Austin neighborhood ("anchors" and
 * "bridges"), mirroring the Emergent demo's MatchGuideScreen data
 * (frontend/src/data/matchGuideData.js). Each neighborhood has up to 5
 * curated venues. Placeholder links (`#`) until local partners are onboarded.
 */

export type MeetupVenueTag =
  | 'Coffee'
  | 'Cocktails'
  | 'Dinner'
  | 'Hotel'
  | 'Activity'

export interface MeetupVenue {
  name: string
  descriptor: string
  tag: MeetupVenueTag
  bestFor: string
  link: string
  status: 'active' | 'coming-soon'
}

export interface MeetupNeighborhood {
  /** Neighborhood name, shown as the accordion header */
  neighborhood: string
  /** Short positioning line (not rendered in the demo, kept for context) */
  context: string
  venues: MeetupVenue[]
}

const STANDARD = { link: '#', status: 'active' as const }

export const MEETUP_NEIGHBORHOODS: MeetupNeighborhood[] = [
  {
    neighborhood: 'Downtown',
    context: 'The Central Anchor — ultimate neutral ground for everyone',
    venues: [
      { name: 'Houndstooth Coffee', descriptor: 'Clean, simple, no pressure', tag: 'Coffee', bestFor: 'First meet', ...STANDARD },
      { name: 'Small Victory', descriptor: 'Dark, intimate cocktail bar', tag: 'Cocktails', bestFor: 'Second date', ...STANDARD },
      { name: 'Red Ash', descriptor: 'High-energy Italian, better for strong matches', tag: 'Dinner', bestFor: 'Strong match', ...STANDARD },
      { name: 'Proper Hotel', descriptor: 'Modern luxury, rooftop bar with downtown views', tag: 'Hotel', bestFor: 'When things are going well', ...STANDARD },
      { name: 'Elephant Room', descriptor: 'Underground jazz, unique and memorable', tag: 'Activity', bestFor: 'When things are going well', ...STANDARD },
    ],
  },
  {
    neighborhood: 'East Austin',
    context: 'The East Anchor — primary destination for a cool, creative vibe',
    venues: [
      { name: 'Flitch Coffee', descriptor: 'Mobile coffee spot, casual and easy start', tag: 'Coffee', bestFor: 'First meet', ...STANDARD },
      { name: "Whisler's", descriptor: 'Dim cocktail bar, strong first-meet energy', tag: 'Cocktails', bestFor: 'First meet', ...STANDARD },
      { name: 'Suerte', descriptor: 'Elevated Mexican, good for a longer sit-down', tag: 'Dinner', bestFor: 'Second or third date', ...STANDARD },
      { name: 'Arrive Austin', descriptor: 'Boutique stay, clean and modern', tag: 'Hotel', bestFor: 'When things are going well', ...STANDARD },
      { name: 'Urban Axes', descriptor: 'Axe throwing — interactive and surprisingly fun', tag: 'Activity', bestFor: 'Casual energy', ...STANDARD },
    ],
  },
  {
    neighborhood: 'Domain / North Burnet',
    context: 'The North Anchor — captures everyone north of 183',
    venues: [
      { name: 'Merit Coffee', descriptor: 'Bright, easy daytime meet', tag: 'Coffee', bestFor: 'First meet', ...STANDARD },
      { name: 'The Roosevelt Room', descriptor: 'Cocktail-focused, a bit more intentional', tag: 'Cocktails', bestFor: 'Second date', ...STANDARD },
      { name: "Perry's Steakhouse", descriptor: 'Classic dinner, more formal option', tag: 'Dinner', bestFor: 'Strong match', ...STANDARD },
      { name: 'Archer Hotel', descriptor: 'Boutique feel in a structured area', tag: 'Hotel', bestFor: 'When things are going well', ...STANDARD },
      { name: 'TopGolf', descriptor: 'Games + drinks, lighter and interactive', tag: 'Activity', bestFor: 'Casual energy', ...STANDARD },
    ],
  },
  {
    neighborhood: 'South Congress',
    context: 'The South Anchor — the gold standard for boutique hotels and walkability',
    venues: [
      { name: "Jo's Coffee", descriptor: 'Classic, low-pressure first meet', tag: 'Coffee', bestFor: 'First meet', ...STANDARD },
      { name: 'Hotel San José Courtyard', descriptor: 'Quiet, intimate outdoor drinks', tag: 'Cocktails', bestFor: 'Second date', ...STANDARD },
      { name: "Perla's", descriptor: 'Seafood + patio, lively but still conversational', tag: 'Dinner', bestFor: 'Strong match', ...STANDARD },
      { name: 'Saint Cecilia', descriptor: 'Intimate, exclusive boutique hotel', tag: 'Hotel', bestFor: 'When things are going well', ...STANDARD },
      { name: 'Continental Club', descriptor: 'Live music, good if things are going well', tag: 'Activity', bestFor: 'When things are going well', ...STANDARD },
    ],
  },
  {
    neighborhood: 'South Lamar',
    context: 'The South-West Bridge — perfect midpoint for Westlake and East Austin',
    venues: [
      { name: 'Radio Coffee & Beer', descriptor: 'Outdoor yard, low-key and easy', tag: 'Coffee', bestFor: 'First meet', ...STANDARD },
      { name: 'Infinite Monkey Theorem', descriptor: 'Urban winery, unexpected and memorable', tag: 'Cocktails', bestFor: 'Second date', ...STANDARD },
      { name: 'Uchi', descriptor: 'World-class Japanese, strong match energy', tag: 'Dinner', bestFor: 'Strong match', ...STANDARD },
      { name: 'Carpenter Hotel', descriptor: 'Design-forward boutique, South Lamar corridor', tag: 'Hotel', bestFor: 'When things are going well', ...STANDARD },
      { name: 'Peter Pan Mini Golf', descriptor: 'Nostalgic, playful, breaks the ice', tag: 'Activity', bestFor: 'Casual energy', ...STANDARD },
    ],
  },
  {
    neighborhood: 'Rainey Street',
    context: 'The High-Volume Bridge — connects East Side and Downtown',
    venues: [
      { name: 'Brew & Brew', descriptor: 'Coffee-forward, good daytime meeting spot', tag: 'Coffee', bestFor: 'First meet', ...STANDARD },
      { name: 'Half Step', descriptor: 'Craft cocktails in a bungalow setting', tag: 'Cocktails', bestFor: 'Second date', ...STANDARD },
      { name: 'Emmer & Rye', descriptor: 'Inventive tasting menu, memorable and intimate', tag: 'Dinner', bestFor: 'Strong match', ...STANDARD },
      { name: 'Hotel Van Zandt', descriptor: 'Upscale Kimpton, rooftop bar, Rainey adjacent', tag: 'Hotel', bestFor: 'When things are going well', ...STANDARD },
      { name: "Banger's", descriptor: 'Beer garden with live music, high energy', tag: 'Activity', bestFor: 'Weekend afternoon', ...STANDARD },
    ],
  },
  {
    neighborhood: 'North Loop / Triangle',
    context: 'The North-Central Bridge — geographic center for north-to-south matches',
    venues: [
      { name: 'Epoch Coffee', descriptor: 'Chill, 24-hour vibes, no pretension', tag: 'Coffee', bestFor: 'First meet', ...STANDARD },
      { name: 'Workhorse Bar', descriptor: 'Dive-adjacent cocktails, approachable', tag: 'Cocktails', bestFor: 'First meet', ...STANDARD },
      { name: 'Foreign & Domestic', descriptor: 'Inventive American, intimate and chef-driven', tag: 'Dinner', bestFor: 'Second or third date', ...STANDARD },
      { name: 'Origin Hotel', descriptor: 'New boutique on Airport Blvd corridor', tag: 'Hotel', bestFor: 'When things are going well', ...STANDARD },
      { name: 'Breakaway Records', descriptor: 'Vinyl shopping + beer — unique and low-pressure', tag: 'Activity', bestFor: 'Casual energy', ...STANDARD },
    ],
  },
]
