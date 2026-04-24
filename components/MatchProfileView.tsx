'use client'

import { ArrowLeft, X, Lock } from 'lucide-react'

interface MatchProfileViewProps {
  match: {
    partnership: {
      id: string
      display_name: string | null
      short_bio: string | null
      connection_summary?: string | null
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
  Platinum: 'Platinum match',
  Gold: 'High match',
  Silver: 'Good match',
  Bronze: 'Match',
}

// 5 compatibility categories
const CATEGORIES = [
  {
    key: 'goals_expectations',
    label: 'Goals & Expectations',
    description:
      'What each of you is looking for right now — dating, play, exploration, or something more defined.',
  },
  {
    key: 'structure_fit',
    label: 'Structure Fit',
    description:
      "How well your relationship setups line up, whether you're solo, partnered, or part of a more complex structure.",
  },
  {
    key: 'boundaries_comfort',
    label: 'Boundaries & Comfort',
    description:
      "What each person is open to, what each isn't, and whether those limits work together.",
  },
  {
    key: 'openness_curiosity',
    label: 'Openness & Curiosity',
    description:
      'How comfortable each of you is with trying new things or learning as you go.',
  },
  {
    key: 'sexual_energy',
    label: 'Sexual Energy',
    description:
      'The kind of tone, pace, and vibe each of you naturally enjoys.',
  },
]

export function MatchProfileView({
  match,
  open,
  onClose,
  onConnect,
  onPass,
  targetMembershipTier,
}: MatchProfileViewProps) {
  if (!match || !open) return null

  const { partnership, score, tier, breakdown } = match

  const initials =
    partnership.display_name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '??'

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
    <div className="dash-layout fixed inset-0 z-50 bg-[color:var(--haevn-dash-bg)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between h-14 px-5 sm:px-8 border-b border-[color:var(--haevn-border)] bg-white">
        <button
          onClick={onClose}
          className="text-[color:var(--haevn-navy)] flex items-center gap-2 text-sm"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span>Back</span>
        </button>
        <button
          onClick={onClose}
          className="text-[color:var(--haevn-muted-fg)] hover:text-[color:var(--haevn-navy)] p-2"
          aria-label="Close"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 pt-8 pb-32 space-y-8">
          {/* Photo / identity */}
          <div className="flex flex-col items-start gap-5">
            <div className="w-full aspect-[3/4] max-w-xs bg-white border border-[color:var(--haevn-border)] overflow-hidden">
              {partnership.photo_url ? (
                <img
                  src={partnership.photo_url}
                  alt={partnership.display_name || 'Match'}
                  className="w-full h-full object-cover object-[center_25%]"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-b from-[#E8E6E3] to-[#D5D3D0] flex items-center justify-center font-heading text-4xl text-[color:var(--haevn-navy)]">
                  {initials}
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
                {TIER_LABELS[tier]}
              </p>
              <h1 className="font-heading text-3xl sm:text-4xl text-[color:var(--haevn-navy)] mt-2">
                {partnership.display_name || 'Anonymous'}
              </h1>
              <p className="text-sm text-[color:var(--haevn-muted-fg)] mt-1 capitalize">
                {partnership.identity} · {partnership.age} · {partnership.city}
              </p>
            </div>
          </div>

          {/* Compat score */}
          <div className="border-t border-[color:var(--haevn-border)] pt-6">
            <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--haevn-muted-fg)]">
              Compatibility score
            </p>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-heading text-5xl text-[color:var(--haevn-gold)] tabular-nums">
                {score}%
              </span>
            </div>
            <p className="text-sm text-[color:var(--haevn-charcoal)] mt-2 leading-relaxed">
              Strong alignment across core categories.
            </p>
          </div>

          {/* Intro */}
          {(partnership.connection_summary || partnership.short_bio) && (
            <div className="border-t border-[color:var(--haevn-border)] pt-6">
              <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--haevn-muted-fg)]">
                {partnership.connection_summary
                  ? 'Connection summary'
                  : 'In their words'}
              </p>
              <p className="text-base text-[color:var(--haevn-charcoal)] mt-3 leading-relaxed italic">
                {partnership.connection_summary ?? partnership.short_bio}
              </p>
            </div>
          )}

          {/* Breakdown */}
          <div className="border-t border-[color:var(--haevn-border)] pt-6">
            <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
              Compatibility breakdown
            </p>
            <div className="mt-4 space-y-3">
              {CATEGORIES.map(cat => {
                const pct = getPercentage(cat.key)
                return (
                  <div
                    key={cat.key}
                    className="bg-white border border-[color:var(--haevn-border)] p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-heading text-sm text-[color:var(--haevn-navy)]">
                        {cat.label}
                      </span>
                      <span className="font-heading text-sm text-[color:var(--haevn-navy)] tabular-nums">
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full h-[3px] bg-[color:var(--haevn-border)] overflow-hidden mb-2">
                      <div
                        className="h-full bg-[color:var(--haevn-teal)] transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-[color:var(--haevn-muted-fg)] leading-relaxed">
                      {cat.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed bottom action bar */}
      <div className="bg-white border-t border-[color:var(--haevn-border)]">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              onPass?.(partnership.id)
              onClose()
            }}
            className="haevn-btn-secondary flex-1"
          >
            Pass
          </button>
          <button
            type="button"
            onClick={() => onConnect?.(partnership.id)}
            className="haevn-btn-gold flex-1 inline-flex items-center gap-2"
          >
            {targetMembershipTier === 'free' && <Lock className="w-4 h-4" />}
            {targetMembershipTier === 'free' ? 'Nudge' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}
