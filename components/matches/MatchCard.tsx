'use client'

/**
 * Redesigned match card — three states per the client mock (Standard free /
 * Nudged / Unlocked). The client philosophy: FREE members get the full "why" —
 * the AI match_summary and the top-3 strongest areas with their explanation lines
 * are visible ungated; only identity, photo, and connect/message are HAEVN+-gated.
 *
 * Copy comes from the cached AI interpretation when present, else deterministic
 * fallback copy (so the why is never blank / never "unlock to read more"). All
 * section labels use the design vocabulary (never engine names).
 */

import { useRouter } from 'next/navigation'
import { Lock, MessageCircle, Heart, Star, Target, Users, Calendar, ChevronRight } from 'lucide-react'
import type { Section } from '@/lib/matches/sectionMapping'
import type { MatchInterpretation } from '@/lib/ai/matchInterpretationSchema'
import { topSections, fallbackMatchSummary, fallbackStrongestAreas } from '@/lib/matches/fallbackCopy'

export type MatchCardState = 'standard' | 'nudged' | 'unlocked'

export interface MatchCardIdentity {
  nameToken: string // "D***" for free, real first name for unlocked
  age: number
  photoUrl: string | null
  demographics: string | null
  city?: string
  distanceMiles?: number
}

export interface MatchCardProps {
  matchId: string
  score: number
  sections: Section[]
  interpretation: MatchInterpretation | null
  state: MatchCardState
  badge: { label: string } // overall band label (unlocked)
  identity: MatchCardIdentity
}

// Section display-name → lucide icon (design vocabulary, not engine names).
const SECTION_ICON: Record<string, typeof Target> = {
  'Goals & Expectations': Target,
  'Structure Fit': Users,
  'Emotional & Communication': MessageCircle,
  'Sexual Compatibility': Heart,
  'Practical Fit': Calendar,
}

export function MatchCard({ matchId, score, sections, interpretation, state, badge, identity }: MatchCardProps) {
  const router = useRouter()
  const isFree = state !== 'unlocked'
  const nameHeading = `${identity.nameToken}, ${identity.age}`

  // The "why" — AI copy when cached, deterministic fallback otherwise (never blank).
  const whySummary = interpretation?.match_summary || fallbackMatchSummary(sections)
  const strongest =
    interpretation?.strongest_areas?.length
      ? interpretation.strongest_areas.slice(0, 3)
      : fallbackStrongestAreas(sections)

  const goUpgrade = () => router.push('/onboarding/membership')
  const goBreakdown = () => router.push(`/dashboard/matches/${matchId}/breakdown`)
  const goMessage = () => router.push(`/dashboard/matches/${matchId}`)

  return (
    <div className="dash-card group relative flex w-full flex-col overflow-hidden">
      {/* Nudged banner */}
      {state === 'nudged' && (
        <div className="flex items-center justify-center gap-2 bg-[color:var(--haevn-gold)] py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
          <Star size={13} strokeWidth={2.5} /> Someone wants to meet you
        </div>
      )}

      {/* Photo / silhouette + score ring */}
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden">
        {state === 'unlocked' && identity.photoUrl ? (
          <img src={identity.photoUrl} alt="" className="h-full w-full object-cover object-[center_25%]" />
        ) : (
          <Silhouette nudged={state === 'nudged'} />
        )}
        {/* City overlay top-left */}
        {identity.city && (
          <div className="absolute left-3 top-3 rounded bg-black/45 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
            {identity.city}
          </div>
        )}
        <ScoreRing score={score} />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* Eyebrow + badge */}
        {state === 'unlocked' ? (
          <span className="w-fit rounded bg-[color:var(--haevn-teal-light)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--haevn-teal)]">
            {badge.label}
          </span>
        ) : (
          <p className="text-[13px] font-semibold text-[color:var(--haevn-navy)]">This is one of your strongest matches.</p>
        )}

        {/* Name + demographics */}
        <div>
          <h3 className="font-heading text-2xl leading-tight text-[color:var(--haevn-navy)]">{nameHeading}</h3>
          {identity.demographics && (
            <p className="mt-0.5 text-sm text-[color:var(--haevn-muted-fg)]">{identity.demographics}</p>
          )}
        </div>

        {/* Nudged first-move line */}
        {state === 'nudged' && (
          <div className="flex items-start gap-2 rounded-lg bg-[color:var(--haevn-gold)]/10 p-3">
            <Heart size={16} className="mt-0.5 shrink-0 text-[color:var(--haevn-gold)]" />
            <p className="text-sm text-[color:var(--haevn-charcoal)]">
              <span className="font-semibold">They already made the first move.</span> Don&rsquo;t miss an opportunity to
              connect.
            </p>
          </div>
        )}

        {/* Why (FREE-VISIBLE) */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--haevn-muted-fg)]">
            {state === 'standard' ? 'Why HAEVN matched you' : 'Why you’re a strong match'}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--haevn-charcoal)]">{whySummary}</p>
        </div>

        {/* Strongest areas — top 3 WITH explanation lines (FREE-VISIBLE) */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--haevn-muted-fg)]">
            Your strongest areas of compatibility
          </p>
          <ul className="mt-2 flex flex-col gap-2.5">
            {strongest.map((a, i) => {
              const Icon = SECTION_ICON[a.category] ?? Target
              return (
                <li key={i} className="flex items-start gap-2.5">
                  <Icon size={17} className="mt-0.5 shrink-0 text-[color:var(--haevn-teal)]" />
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--haevn-navy)]">{a.category}</p>
                    <p className="text-[13px] leading-snug text-[color:var(--haevn-muted-fg)]">{a.summary}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Alignment-breakdown link row → expanded view */}
        <button
          type="button"
          onClick={goBreakdown}
          className="-mx-1 flex items-center justify-between rounded-lg border border-dashed border-[color:var(--haevn-border)] px-3 py-2.5 text-left transition-colors hover:border-[color:var(--haevn-teal)]/50"
        >
          <span>
            <span className="block text-sm font-semibold text-[color:var(--haevn-navy)]">
              See your full alignment breakdown
            </span>
            <span className="block text-[12px] text-[color:var(--haevn-muted-fg)]">Explore all 5 areas of compatibility</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-[color:var(--haevn-muted-fg)]" />
        </button>

        {/* CTA per state */}
        <div className="mt-auto pt-1">
          {state === 'unlocked' ? (
            <>
              <button type="button" onClick={goMessage} className="haevn-btn-teal flex w-full items-center justify-center gap-2 text-sm">
                <MessageCircle size={16} /> Send a Message
              </button>
              <p className="mt-2 text-center text-[12px] text-[color:var(--haevn-muted-fg)]">Start a conversation.</p>
            </>
          ) : (
            <>
              <button type="button" onClick={goUpgrade} className="haevn-btn-gold flex w-full items-center justify-center gap-2 text-sm">
                <Lock size={15} /> {state === 'nudged' ? 'See who nudged you' : `See who your ${score}% match is`}
              </button>
              <p className="mt-2 text-center text-[12px] leading-relaxed text-[color:var(--haevn-muted-fg)]">
                {state === 'nudged'
                  ? 'HAEVN+ membership required to view and respond.'
                  : 'Unlock their photos, full profile, complete compatibility breakdown and the ability to connect.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div className="absolute right-3 top-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#E8E6E3" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--haevn-teal)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="font-heading text-lg text-[color:var(--haevn-navy)] tabular-nums">{score}%</span>
        <span className="text-[8px] font-bold uppercase tracking-wider text-[color:var(--haevn-muted-fg)]">Match</span>
      </div>
    </div>
  )
}

function Silhouette({ nudged }: { nudged: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-b from-haevn-warm-gray to-[#D5D3D0]">
      <svg viewBox="0 0 200 200" className="h-24 w-24 opacity-30" aria-hidden>
        <circle cx="100" cy="70" r="40" fill="#9CA3AF" />
        <ellipse cx="100" cy="170" rx="60" ry="50" fill="#9CA3AF" />
      </svg>
      {nudged && (
        <div className="absolute flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--haevn-gold)] shadow-lg">
          <Heart size={26} className="text-white" fill="white" />
        </div>
      )}
    </div>
  )
}
