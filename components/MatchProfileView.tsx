'use client'

import { MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MatchProfileViewProps {
  match: {
    partnership: {
      id: string
      display_name: string | null
      short_bio: string | null
      identity: string
      city: string
      age: number
      discretion_level: string
      photo_url?: string | null
    }
    score: number
    tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze'
    breakdown: any
  } | null
  open: boolean
  onClose: () => void
  onConnect?: (partnershipId: string) => void
  onPass?: (partnershipId: string) => void
  targetMembershipTier?: 'free' | 'plus'
}

const TIER_LABELS = {
  Platinum: 'PLATINUM MATCH',
  Gold: 'HIGH MATCH',
  Silver: 'GOOD MATCH',
  Bronze: 'MATCH',
}

// 5 compatibility categories matching PPT with descriptions
const CATEGORIES = [
  {
    key: 'goals_expectations',
    label: 'Goals & Expectations',
    description: 'What each of you is looking for right now; dating, play, exploration, or something more defined.'
  },
  {
    key: 'structure_fit',
    label: 'Structure Fit',
    description: "How well your relationship setups line up, whether you're solo, partnered, or part of a more complex structure."
  },
  {
    key: 'boundaries_comfort',
    label: 'Boundaries & Comfort Levels',
    description: "What each person is open to, what each person isn't open to, and whether those limits work together."
  },
  {
    key: 'openness_curiosity',
    label: 'Openness & Curiosity',
    description: 'How comfortable each of you is with trying new things, exploring different dynamics, or learning as you go.'
  },
  {
    key: 'sexual_energy',
    label: 'Sexual Energy',
    description: 'The kind of sexual tone, pace, and vibe each of you naturally enjoys.'
  },
]

export function MatchProfileView({ match, open, onClose, onConnect, onPass, targetMembershipTier }: MatchProfileViewProps) {
  if (!match || !open) return null

  const { partnership, score, tier, breakdown } = match

  // Get initials for avatar
  const initials = partnership.display_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??'

  // Parse breakdown - get percentages for each category
  const sections = breakdown?.raw_sections || breakdown?.sections || {}
  const getPercentage = (key: string): number => {
    const data = sections[key]
    if (!data) return 0
    if (typeof data === 'number') return Math.round(data)
    if (data?.contribution && data?.weight) {
      return Math.round((data.contribution / data.weight) * 100)
    }
    return data?.score ?? 0
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Teal Header Bar */}
      <div className="bg-[#1B9A9A] h-12 flex items-center justify-between px-4">
        <button
          onClick={onClose}
          className="text-white text-sm font-medium flex items-center gap-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={onClose}
          className="text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Avatar */}
        <div className="flex justify-center mb-3">
          {partnership.photo_url ? (
            <img
              src={partnership.photo_url}
              alt={partnership.display_name || 'Match'}
              className="w-20 h-20 rounded-full object-cover border-3 border-[#1B9A9A]"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#0F2A4A] flex items-center justify-center text-white text-2xl font-bold">
              {initials}
            </div>
          )}
        </div>

        {/* Name and Info - Single Line */}
        <div className="text-center mb-3">
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            {partnership.display_name || 'Anonymous'}
          </h1>
          <p className="text-sm text-gray-600">
            <span className="capitalize">{partnership.identity}</span>
            <span className="mx-1">·</span>
            <span>{partnership.age}</span>
            <span className="mx-1">·</span>
            <span>{partnership.city}</span>
          </p>
        </div>

        {/* Compatibility Score */}
        <div className="text-center mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Compatibility Score</p>
          <p className="text-4xl font-bold text-[#1B9A9A]">{score}%</p>
          <p className="text-sm font-semibold text-[#1B9A9A] uppercase tracking-wide">
            {TIER_LABELS[tier]}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Strong Alignment Across Core Categories.</p>
        </div>

        {/* Their Intent Section */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-1">Their Intent, In Their Words:</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            {partnership.short_bio || 'No bio available'}
          </p>
        </div>

        {/* Compatibility Breakdown */}
        <div className="pb-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">Compatibility Breakdown</p>
          <div className="space-y-3">
            {CATEGORIES.map((cat) => {
              const pct = getPercentage(cat.key)
              return (
                <div key={cat.key} className="bg-white border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-800">{cat.label}</span>
                    <span className="text-sm font-bold text-gray-700">{pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-[#1B9A9A] rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{cat.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Buttons */}
      <div className="px-5 pb-6 pt-3 bg-white border-t border-gray-100">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12 text-base font-semibold border-2 border-gray-300 text-gray-500 hover:bg-gray-50 rounded-full"
            onClick={() => {
              if (onPass) onPass(partnership.id)
              onClose()
            }}
          >
            PASS
          </Button>
          <Button
            className="flex-1 h-12 text-base font-semibold bg-[#1B9A9A] hover:bg-[#178787] text-white rounded-full"
            onClick={() => {
              if (onConnect) onConnect(partnership.id)
            }}
          >
            {targetMembershipTier === 'free' ? 'NUDGE' : 'CONNECT'}
          </Button>
        </div>
      </div>
    </div>
  )
}
