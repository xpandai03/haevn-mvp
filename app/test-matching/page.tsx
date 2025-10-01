'use client'

import { useState } from 'react'
import { calculateMatch, type UserProfile } from '@/lib/matching/scoring'
import { MatchCardSimple } from '@/components/MatchCardSimple'
import { MatchModal } from '@/components/MatchModal'

// Mock current user (Raunek)
const currentUser: UserProfile = {
  id: 'current-user',
  identity: 'single',
  seeking_targets: ['couples', 'women'],
  structure: 'ENM',
  intent: ['dating', 'play'],
  lat: 37.7749,
  lng: -122.4194,
  city: 'San Francisco',
  discretion_level: 'Medium',
  is_verified: true,
  has_background_check: false,
  display_name: 'Raunek',
  short_bio: 'Testing the matching system 🚀',
  age: 32
}

// Mock potential matches
const potentialMatches: UserProfile[] = [
  {
    id: '1',
    identity: 'couple',
    seeking_targets: ['singles', 'couples'],
    structure: 'ENM',
    intent: ['dating', 'play'],
    lat: 37.7849,
    lng: -122.4094,
    city: 'San Francisco',
    discretion_level: 'High',
    is_verified: true,
    has_background_check: true,
    display_name: 'Alex & Jordan',
    short_bio: 'Adventurous couple exploring connections',
    age: 29
  },
  {
    id: '2',
    identity: 'woman',
    seeking_targets: ['singles'],
    structure: 'ENM',
    intent: ['dating', 'long-term'],
    lat: 37.7649,
    lng: -122.4294,
    city: 'San Francisco',
    discretion_level: 'Medium',
    is_verified: true,
    has_background_check: false,
    display_name: 'Sarah',
    short_bio: 'Looking for meaningful connections',
    age: 30
  },
  {
    id: '3',
    identity: 'couple',
    seeking_targets: ['singles', 'women'],
    structure: 'Open',
    intent: ['play', 'social'],
    lat: 37.7949,
    lng: -122.3994,
    city: 'Oakland',
    discretion_level: 'Low',
    is_verified: false,
    has_background_check: false,
    display_name: 'Mike & Emma',
    short_bio: 'Fun-loving couple seeking new experiences',
    age: 35
  },
  {
    id: '4',
    identity: 'woman',
    seeking_targets: ['singles', 'couples'],
    structure: 'Poly',
    intent: ['dating', 'play'],
    lat: 37.8049,
    lng: -122.4394,
    city: 'Berkeley',
    discretion_level: 'Medium',
    is_verified: true,
    has_background_check: true,
    display_name: 'Lisa',
    short_bio: 'Polyamorous and proud',
    age: 28
  },
  {
    id: '5',
    identity: 'couple',
    seeking_targets: ['couples'],
    structure: 'Swinger',
    intent: ['play'],
    lat: 37.5485,
    lng: -121.9886,
    city: 'Fremont',
    discretion_level: 'High',
    is_verified: false,
    has_background_check: false,
    display_name: 'Tom & Jessica',
    short_bio: 'Discreet and respectful',
    age: 40
  }
]

export default function TestMatchingPage() {
  const [selectedMatch, setSelectedMatch] = useState<any>(null)

  // Calculate matches
  const matches = potentialMatches
    .map(profile => {
      const score = calculateMatch(currentUser, profile)
      return { profile, score }
    })
    .filter(m => m.score.tier !== 'Excluded')
    .sort((a, b) => b.score.totalScore - a.score.totalScore)

  // Group by tier
  const tierCounts = matches.reduce((acc, m) => {
    acc[m.score.tier] = (acc[m.score.tier] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-haevn-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-h1 text-haevn-gray-900 mb-2">
            Matching System Test
          </h1>
          <p className="text-body text-haevn-gray-700">
            Testing as: <strong className="text-haevn-gray-900">{currentUser.display_name}</strong> ({currentUser.identity}, seeking {currentUser.seeking_targets.join(', ')})
          </p>
        </div>

        {/* Tier Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {['Platinum', 'Gold', 'Silver', 'Bronze'].map(tier => (
            <div key={tier} className="bg-white rounded-2xl p-6 border-2 border-haevn-gray-300">
              <div className="text-caption font-medium text-haevn-gray-600 mb-1">{tier}</div>
              <div className="text-display-sm text-haevn-gray-900">
                {tierCounts[tier] || 0}
              </div>
            </div>
          ))}
        </div>

        {/* Matches Grid */}
        <div>
          <h2 className="text-h2 text-haevn-gray-900 mb-6">
            Your Matches ({matches.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map(({ profile, score }) => (
              <MatchCardSimple
                key={profile.id}
                match={{
                  partnership: {
                    id: profile.id,
                    display_name: profile.display_name,
                    short_bio: profile.short_bio,
                    identity: profile.identity,
                    city: profile.city,
                    age: profile.age
                  },
                  score: Math.round(score.totalScore),
                  tier: score.tier as 'Platinum' | 'Gold' | 'Silver' | 'Bronze'
                }}
                onClick={() => setSelectedMatch({ profile, score })}
              />
            ))}
          </div>

          {matches.length === 0 && (
            <div className="text-center py-12 text-body text-haevn-gray-600">
              We're still finding the right connections for you. Check back soon!
            </div>
          )}
        </div>
      </div>

      {/* Match Modal */}
      {selectedMatch && (
        <MatchModal
          open={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          match={{
            partnership: {
              id: selectedMatch.profile.id,
              display_name: selectedMatch.profile.display_name,
              short_bio: selectedMatch.profile.short_bio,
              identity: selectedMatch.profile.identity,
              city: selectedMatch.profile.city,
              age: selectedMatch.profile.age,
              discretion_level: selectedMatch.profile.discretion_level
            },
            score: Math.round(selectedMatch.score.totalScore),
            tier: selectedMatch.score.tier as 'Platinum' | 'Gold' | 'Silver' | 'Bronze',
            breakdown: selectedMatch.score.breakdown
          }}
        />
      )}
    </div>
  )
}
