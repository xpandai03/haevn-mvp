'use client'

/**
 * Expanded compatibility breakdown — the full five-section report. Per the client
 * philosophy, this is FREE-VISIBLE in its entirety (analysis, scores, bands, AI
 * copy, conversation starters); only identity/photo/connect stay HAEVN+-gated
 * (left summary + sticky upgrade bar). Desktop two-column; stacks on mobile.
 *
 * Linked from every card's "See your full alignment breakdown" row.
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Lock, Info, Lightbulb, Target, Users, MessageCircle, Heart, Calendar } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { getMatchBreakdownData, type MatchBreakdownData } from '@/lib/matches/getMatchCardData'
import { fallbackExecutiveSummary } from '@/lib/matches/fallbackCopy'
import type { Band, Section } from '@/lib/matches/sectionMapping'

const SECTION_ICON: Record<string, typeof Target> = {
  'Goals & Expectations': Target,
  'Structure Fit': Users,
  'Emotional & Communication': MessageCircle,
  'Sexual Compatibility': Heart,
  'Practical Fit': Calendar,
}

const BAND_UI: Record<Band, { bar: string; text: string }> = {
  exceptional: { bar: 'bg-[color:var(--haevn-teal)]', text: 'text-[color:var(--haevn-teal)]' },
  strong: { bar: 'bg-[color:var(--haevn-teal)]/80', text: 'text-[color:var(--haevn-teal)]' },
  compatible: { bar: 'bg-emerald-500', text: 'text-emerald-600' },
  some_differences: { bar: 'bg-amber-500', text: 'text-amber-600' },
  meaningful_difference: { bar: 'bg-red-500', text: 'text-red-600' },
}

export default function BreakdownPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const matchId = params.id as string
  const [data, setData] = useState<MatchBreakdownData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return
    getMatchBreakdownData(matchId)
      .then((d) => {
        if (!d) setNotFound(true)
        else setData(d)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [authLoading, user, matchId])

  if (loading) return <div className="p-10 text-center text-[color:var(--haevn-muted-fg)]">Loading your breakdown…</div>
  if (notFound || !data) return <div className="p-10 text-center text-[color:var(--haevn-muted-fg)]">Match not found.</div>

  const isFree = data.state !== 'unlocked'
  const interp = data.interpretation
  const execSummary = interp?.executive_summary || fallbackExecutiveSummary(data.sections, data.matchScore)

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-8">
      <button onClick={() => router.push('/dashboard/matches')} className="mb-6 flex items-center gap-2 text-sm text-[color:var(--haevn-muted-fg)] hover:text-[color:var(--haevn-navy)]">
        <ArrowLeft size={16} /> Back to Matches
      </button>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[340px_1fr]">
        {/* LEFT — summary + gated identity */}
        <aside className="flex flex-col gap-4">
          <div className="dash-card overflow-hidden">
            <div className="relative aspect-[4/3] w-full bg-gradient-to-b from-haevn-warm-gray to-[#D5D3D0]">
              {data.state === 'unlocked' && data.identity.photoUrl ? (
                <img src={data.identity.photoUrl} alt="" className="h-full w-full object-cover object-[center_25%]" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center">
                  <Lock size={22} className="text-[color:var(--haevn-muted-fg)]" />
                  <p className="px-6 text-sm font-medium text-[color:var(--haevn-charcoal)]">Reveal your {data.matchScore}% match</p>
                  <p className="px-6 text-[12px] text-[color:var(--haevn-muted-fg)]">Unlock to see their photos and full profile.</p>
                </div>
              )}
            </div>
            <div className="p-5">
              <h1 className="font-heading text-2xl text-[color:var(--haevn-navy)]">
                {data.identity.nameToken}, {data.identity.age}
              </h1>
              {data.identity.demographics && (
                <p className="mt-0.5 text-sm text-[color:var(--haevn-muted-fg)]">{data.identity.demographics}</p>
              )}
              <div className="mt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--haevn-muted-fg)]">Why this is a strong match</p>
                <p className="mt-1 text-sm leading-relaxed text-[color:var(--haevn-charcoal)]">
                  {interp?.match_summary || execSummary}
                </p>
              </div>
              <blockquote className="mt-4 border-l-2 border-[color:var(--haevn-teal)] pl-3 text-[13px] italic leading-relaxed text-[color:var(--haevn-muted-fg)]">
                We don’t match on surface-level preferences. We match on what actually matters.
                <span className="mt-1 block not-italic text-[11px] font-semibold uppercase tracking-wider">— The HAEVN Approach</span>
              </blockquote>
            </div>
          </div>
        </aside>

        {/* RIGHT — the full five-section report (free-visible) */}
        <main className="flex flex-col gap-6">
          <header>
            <h2 className="font-heading text-3xl text-[color:var(--haevn-navy)]">Your {data.matchScore}% Match</h2>
            <p className="mt-1 text-sm text-[color:var(--haevn-muted-fg)]">Based on your alignment across five core areas.</p>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--haevn-charcoal)]">{execSummary}</p>
          </header>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--haevn-navy)]">Your compatibility breakdown</h3>
              <Info size={14} className="text-[color:var(--haevn-muted-fg)]" />
            </div>
            <div className="flex flex-col divide-y divide-[color:var(--haevn-border)]">
              {data.sections.map((s, i) => (
                <SectionDetail key={s.key} section={s} interp={interp?.sections?.[i]} />
              ))}
            </div>
            <BandLegend />
          </section>

          {/* What HAEVN thinks + conversation starters */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl bg-[color:var(--haevn-teal-light)] p-5">
              <div className="mb-2 flex items-center gap-2">
                <Lightbulb size={16} className="text-[color:var(--haevn-teal)]" />
                <h3 className="text-sm font-bold text-[color:var(--haevn-navy)]">What HAEVN thinks you should know</h3>
              </div>
              {interp?.what_haevn_thinks_you_should_know ? (
                <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-[color:var(--haevn-charcoal)]">
                  <p>{interp.what_haevn_thinks_you_should_know.strongest_reason}</p>
                  {interp.what_haevn_thinks_you_should_know.most_meaningful_difference && (
                    <p>{interp.what_haevn_thinks_you_should_know.most_meaningful_difference}</p>
                  )}
                  <p className="mt-1 border-t border-[color:var(--haevn-teal)]/20 pt-2">
                    {interp.what_haevn_thinks_you_should_know.haevn_assessment}
                  </p>
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed text-[color:var(--haevn-charcoal)]">
                  Your strongest alignment is in the areas that most shape a lasting connection. HAEVN surfaces the
                  pattern — the sections above show exactly where you line up and where a conversation is worth having.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-[color:var(--haevn-border)] p-5">
              <h3 className="mb-2 text-sm font-bold text-[color:var(--haevn-navy)]">Potential conversation starters</h3>
              <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-[color:var(--haevn-charcoal)]">
                {(interp?.conversation_starters?.length
                  ? interp.conversation_starters
                  : ['What does intentional connection mean to you?', 'How do you like to spend a slow weekend?', 'What are you hoping to find here?']
                ).map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[color:var(--haevn-teal)]">•</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </main>
      </div>

      {/* Sticky upgrade bar — free viewers only */}
      {isFree && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[color:var(--haevn-border)] bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-3 sm:flex-row sm:justify-between sm:px-8">
            <div className="flex items-center gap-3">
              <Lock size={18} className="text-[color:var(--haevn-gold)]" />
              <p className="text-[13px] text-[color:var(--haevn-charcoal)]">
                <span className="font-semibold">You’ve seen why we matched you.</span> Upgrade to reveal their photos and
                profile and decide if you’d like to connect.
              </p>
            </div>
            <button onClick={() => router.push('/onboarding/membership')} className="haevn-btn-gold flex shrink-0 items-center gap-2 px-6 text-sm">
              <Lock size={15} /> Reveal my match
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionDetail({ section, interp }: { section: Section; interp?: MatchInterpretationSection }) {
  const Icon = SECTION_ICON[section.displayName] ?? Target
  const ui = BAND_UI[section.band.band]
  const overview = interp?.overview || `Your alignment here is ${section.band.label.toLowerCase()}.`
  return (
    <div className="py-4">
      <div className="flex items-start gap-3">
        <Icon size={20} className="mt-0.5 shrink-0 text-[color:var(--haevn-teal)]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h4 className="font-semibold text-[color:var(--haevn-navy)]">{section.displayName}</h4>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-lg tabular-nums text-[color:var(--haevn-navy)]">{section.score}%</span>
              <span className={`text-[12px] font-semibold ${ui.text}`}>{section.band.label}</span>
            </div>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--haevn-muted-fg)]">{overview}</p>
          {/* progress bar */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[color:var(--haevn-border)]">
            <div className={`h-full rounded-full ${ui.bar}`} style={{ width: `${section.score}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function BandLegend() {
  const items: { label: string; range: string; dot: string }[] = [
    { label: 'Exceptional', range: '90–100', dot: 'bg-[color:var(--haevn-teal)]' },
    { label: 'Strong', range: '80–89', dot: 'bg-[color:var(--haevn-teal)]/80' },
    { label: 'Compatible', range: '70–79', dot: 'bg-emerald-500' },
    { label: 'Some Differences', range: '60–69', dot: 'bg-amber-500' },
    { label: 'Meaningful Difference', range: '<60', dot: 'bg-red-500' },
  ]
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 rounded-lg bg-[color:var(--haevn-dash-surface-alt)] p-3">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${it.dot}`} />
          <span className="text-[11px] text-[color:var(--haevn-charcoal)]">
            {it.label} <span className="text-[color:var(--haevn-muted-fg)]">{it.range}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

type MatchInterpretationSection = NonNullable<MatchBreakdownData['interpretation']>['sections'][number]
