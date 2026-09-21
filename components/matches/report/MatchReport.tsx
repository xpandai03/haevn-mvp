'use client'

/**
 * The HAEVN match report document (v2), behind MATCH_REPORT_V2_ENABLED.
 *
 * Structure is the client's public sample at haevn.co/match-example, captured in
 * docs/specs/match-report-reference/. The reference IS the copy spec: nothing
 * here is invented, and where a section has no data source it renders NOTHING
 * rather than a placeholder.
 *
 * NOT RENDERED, and why (see the PR for the full list):
 *  - §01 About — cut for v1. `short_bio` is 0/757 in production, so the section
 *    would be empty for every member.
 *  - The distance badge — no coordinates exist. The location line states the
 *    city relationship instead; see lib/matches/reportLocation.ts.
 *  - The Veriff line and shield — rendered ONLY when the member is actually
 *    verified. `is_verified` is currently false for all 757 live members, so
 *    today this self-hides everywhere, which is the honest outcome. It is a
 *    conditional, never a static claim.
 *
 * MOBILE FIRST. The reference is 11,858px tall at 390px and its desktop
 * two-column category block collapses to one column. This builds single-column
 * and treats the two-column layout as the `md:` enhancement. Category details
 * start COLLAPSED — a document this long with everything open is not navigable
 * on a phone, and collapsed also keeps the gate position stable.
 */

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, Lock, ShieldCheck, MapPin, User } from 'lucide-react'
import type { MatchBreakdownData } from '@/lib/matches/getMatchCardData'
import type { Band, Section } from '@/lib/matches/sectionMapping'
import { verdictForScore } from '@/lib/matches/sectionMapping'
import { staticCopyFor } from '@/lib/matches/categoryCopy'
import { reportLocation } from '@/lib/matches/reportLocation'
import { BECOME_MEMBER_CTA, BREAKDOWN_GATE_SUPPORT } from '@/lib/matches/membershipCopy'

const BAND_COLOR: Record<Band, string> = {
  exceptional: 'var(--haevn-teal)',
  strong: 'var(--haevn-teal)',
  compatible: '#10b981',
  some_differences: '#f59e0b',
  meaningful_difference: '#ef4444',
}

/** The band pill reads as one short uppercase word, as the reference shows. */
const BAND_PILL: Record<Band, string> = {
  exceptional: 'EXCEPTIONAL',
  strong: 'STRONG',
  compatible: 'COMPATIBLE',
  some_differences: 'SOME DIFFERENCES',
  meaningful_difference: 'MEANINGFUL DIFFERENCE',
}

const PREPARING = 'Your full analysis is being prepared. Refresh in a moment to read it.'

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--haevn-teal)]">{children}</p>
  )
}

function SectionHeading({ num, title }: { num: string; title: string }) {
  return (
    <div className="mt-14 border-b border-black/10 pb-3">
      <p className="font-mono text-[11px] tracking-[0.2em] text-[color:var(--haevn-muted-fg)]">§ {num}</p>
      <h2 className="mt-1 font-heading text-[26px] leading-tight text-[color:var(--haevn-navy)] sm:text-3xl">{title}</h2>
    </div>
  )
}

/** Circular score ring. Pure SVG so it scales cleanly at 380px. */
function MatchRing({ score, band }: { score: number; band: Band }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 120 120" className="h-[120px] w-[120px]" role="img" aria-label={`${score}% match`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="8" />
      <circle
        cx="60" cy="60" r={r} fill="none" stroke={BAND_COLOR[band]} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(c * Math.min(100, Math.max(0, score))) / 100} ${c}`}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="58" textAnchor="middle" className="fill-[color:var(--haevn-navy)]" style={{ fontSize: 26, fontWeight: 700 }}>{score}%</text>
      <text x="60" y="76" textAnchor="middle" className="fill-[color:var(--haevn-muted-fg)]" style={{ fontSize: 9, letterSpacing: 1.5 }}>MATCH</text>
    </svg>
  )
}

function GlanceField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null // absent data renders nothing, never "Unknown"
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--haevn-muted-fg)]">{label}</p>
      <p className="mt-0.5 text-[15px] text-[color:var(--haevn-navy)]">{value}</p>
    </div>
  )
}

function CategoryBlock({
  index, section, interp, pending, defaultExpanded = false,
}: {
  index: number
  section: Section
  interp?: { overview?: string; your_alignment?: string; where_you_differ?: string; interpretation?: string }
  pending: boolean
  /** Start open. Static rendering has no click, so this is the only way tests and
   *  screenshots can reach the detail fields at all. */
  defaultExpanded?: boolean
}) {
  const [open, setOpen] = useState(defaultExpanded)
  const statik = staticCopyFor(section.key)
  const summary = interp?.overview || (pending ? PREPARING : null)

  return (
    <div className="border-b border-black/10 py-8">
      <div className="md:grid md:grid-cols-[minmax(0,340px)_1fr] md:gap-10">
        <div>
          <p className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--haevn-muted-fg)]">CATEGORY {index + 1}</p>
          <h3 className="mt-1 font-heading text-xl text-[color:var(--haevn-navy)]">{section.displayName}</h3>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[34px] font-bold leading-none text-[color:var(--haevn-navy)]">{section.score}%</span>
            <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--haevn-muted-fg)]">FIT</span>
            <span
              className="rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.1em]"
              style={{ color: BAND_COLOR[section.band.band], background: `${BAND_COLOR[section.band.band]}1a` }}
            >
              {BAND_PILL[section.band.band]}
            </span>
          </div>
          <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full transition-all" style={{ width: `${section.score}%`, background: BAND_COLOR[section.band.band] }} />
          </div>
        </div>

        <div className="mt-5 md:mt-0">
          {summary && (
            <p className={`text-[15px] leading-relaxed ${interp?.overview ? 'text-[color:var(--haevn-navy)]' : 'italic text-[color:var(--haevn-muted-fg)]'}`}>
              {summary}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-5 flex min-h-[44px] items-center gap-1.5 font-mono text-[11px] font-bold tracking-[0.14em] text-[color:var(--haevn-teal)]"
      >
        {open ? 'HIDE DETAILS' : 'VIEW DETAILS'}
        <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div className="mt-5 space-y-5 md:max-w-[680px]">
          {statik && (
            <>
              <Detail label="WHAT THIS MEASURES" body={statik.whatThisMeasures} />
              <Detail label="WHY IT MATTERS" body={statik.whyItMatters} />
            </>
          )}
          <Detail label="YOUR ALIGNMENT" body={interp?.your_alignment} pending={pending} />
          <Detail label="WHERE YOU DIFFER" body={interp?.where_you_differ} pending={pending} />
          {interp?.interpretation && (
            <div className="border-l-2 pl-4" style={{ borderColor: 'var(--haevn-teal)' }}>
              <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-[color:var(--haevn-teal)]">HAEVN&rsquo;S READ</p>
              <p className="mt-1 text-[15px] font-medium leading-relaxed text-[color:var(--haevn-navy)]">{interp.interpretation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Detail({ label, body, pending }: { label: string; body?: string; pending?: boolean }) {
  if (!body && !pending) return null // no data -> render nothing
  return (
    <div className="border-t border-black/5 pt-4">
      <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-[color:var(--haevn-teal)]">{label}</p>
      <p className={`mt-1 text-[15px] leading-relaxed ${body ? 'text-[color:var(--haevn-navy)]' : 'italic text-[color:var(--haevn-muted-fg)]'}`}>
        {body || PREPARING}
      </p>
    </div>
  )
}

/**
 * The document itself — PURE. No router, no data fetching: navigation arrives as
 * callbacks so the whole document can be rendered to static markup in a test and
 * asserted on (the redaction contract, the Veriff conditional, the degraded
 * state). The router lives in the thin default export below.
 */
export function MatchReportDocument({
  data, onBack, onUpgrade, expandAll = false,
}: {
  data: MatchBreakdownData
  onBack: () => void
  onUpgrade: () => void
  /** Render every category's details open. Static-render harnesses only. */
  expandAll?: boolean
}) {
  const isFree = data.state !== 'unlocked'
  const p = data.interpretation
  const pending = data.interpretationPending || (!p && data.degraded)
  const id = data.identity
  const loc = reportLocation(data.viewerCity, id.city)
  // ALWAYS derived here, never read from the payload. The validator already
  // overwrites the model's echo, but the strip is the one place a bad verdict
  // would be visible to a member, so it derives its own rather than trusting a
  // stored value that a future writer might set by another path.
  const verdict = verdictForScore(data.matchScore)

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-24 pt-5 sm:px-8">
      {/* masthead */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.18em] text-[color:var(--haevn-muted-fg)]">
          <span className="font-bold text-[color:var(--haevn-teal)]">HAEVN MATCH REPORT</span>
          <span className="hidden sm:inline">|</span>
          <span>PREPARED FOR A HAEVN MEMBER</span>
        </div>
        <button onClick={onBack} className="flex min-h-[44px] items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] text-[color:var(--haevn-muted-fg)]">
          <ArrowLeft size={13} /> BACK TO HAEVN
        </button>
      </div>

      {/* header */}
      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[320px_1fr] md:items-start">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[color:var(--haevn-navy)]/5">
          {id.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={id.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User size={72} className="text-[color:var(--haevn-navy)]/20" aria-hidden />
            </div>
          )}
          {loc.label && (
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[12px] text-white backdrop-blur">
              <MapPin size={12} /> {loc.label}
            </div>
          )}
          {/* On a real photo the overlay sits on imagery and needs white with a
              scrim. On the silhouette there is no imagery, so white-on-near-white
              would be unreadable — it renders in navy instead. */}
          <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
            <span
              className={`text-[22px] font-semibold ${id.photoUrl ? 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]' : 'text-[color:var(--haevn-navy)]'}`}
            >
              {isFree ? id.nameToken : id.displayName || id.nameToken}{id.age ? `, ${id.age}` : ''}
            </span>
            {data.matchVerified && (
              <ShieldCheck
                size={17}
                className={id.photoUrl ? 'text-white' : 'text-[color:var(--haevn-teal)]'}
                aria-label="Identity verified"
              />
            )}
          </div>
        </div>

        <div>
          <Eyebrow>YOUR MATCH</Eyebrow>
          <h1 className="mt-2 font-heading text-[30px] leading-[1.15] text-[color:var(--haevn-navy)] sm:text-[40px]">
            Your {data.matchScore}% Match with {isFree ? id.nameToken : id.displayName || id.nameToken}.
          </h1>
          {(p?.match_summary || pending) && (
            <p className={`mt-4 text-[16px] leading-relaxed ${p?.match_summary ? 'text-[color:var(--haevn-muted-fg)]' : 'italic text-[color:var(--haevn-muted-fg)]'}`}>
              {p?.match_summary || PREPARING}
            </p>
          )}
          <div className="mt-7 flex flex-wrap items-center gap-8">
            <MatchRing score={data.matchScore} band={data.badge.band} />
            <div className="space-y-4">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-[color:var(--haevn-muted-fg)]">THRESHOLD</p>
                <p className="text-[15px] text-[color:var(--haevn-navy)]">80% minimum</p>
              </div>
              {data.matchVerified && (
                <div>
                  <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-[color:var(--haevn-muted-fg)]">VERIFIED</p>
                  <p className="flex items-center gap-1.5 text-[15px] text-[color:var(--haevn-navy)]">
                    <ShieldCheck size={15} className="text-[color:var(--haevn-teal)]" /> Identity confirmed via Veriff
                  </p>
                </div>
              )}
            </div>
          </div>
          {loc.crossMarket && (
            <p className="mt-5 max-w-[460px] text-[13px] leading-relaxed text-[color:var(--haevn-muted-fg)]">
              HAEVN matches across cities. You may be introduced to someone outside your metro.
            </p>
          )}
        </div>
      </div>

      {/* profile at a glance */}
      <div className="mt-10 border-y border-black/10 py-6">
        <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-[color:var(--haevn-muted-fg)]">PROFILE AT A GLANCE</p>
        <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          <GlanceField label="GENDER" value={id.gender} />
          <GlanceField label="AGE" value={id.age ? String(id.age) : null} />
          <GlanceField label="ORIENTATION" value={id.orientation} />
          <GlanceField label="LOCATION" value={id.city || null} />
          <GlanceField label="STRUCTURE" value={id.structure} />
        </div>
      </div>

      {/* §02 */}
      <SectionHeading num="02" title="Why HAEVN Made This Introduction" />
      <div className="mt-5 space-y-4 text-[16px] leading-relaxed text-[color:var(--haevn-navy)] md:max-w-[720px]">
        {p?.why_this_introduction ? (
          <>
            <p>{p.why_this_introduction.what_aligns}</p>
            <p>{p.why_this_introduction.what_differs}</p>
            <p className="font-medium">{p.why_this_introduction.the_verdict}</p>
          </>
        ) : (
          <p className="italic text-[color:var(--haevn-muted-fg)]">{PREPARING}</p>
        )}
      </div>

      {/* §03 */}
      <SectionHeading num="03" title="Compatibility Breakdown" />
      <p className="mt-4 text-[17px] font-medium text-[color:var(--haevn-navy)]">Five categories. Each one earned.</p>
      <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--haevn-muted-fg)] md:max-w-[720px]">
        Every HAEVN match is evaluated across five core areas. The scores below show where you align, where you
        differ, and what may be worth understanding as you get to know each other.
      </p>
      <div className="mt-6">
        {data.sections.map((s, i) => (
          <CategoryBlock key={s.key} index={i} section={s} interp={p?.sections?.[i]} pending={pending} defaultExpanded={expandAll} />
        ))}
      </div>

      {/* §04 — omitted entirely when absent */}
      {p?.worth_talking_about?.items?.length ? (
        <>
          <SectionHeading num="04" title="Worth Talking About" />
          <ol className="mt-5 space-y-4 md:max-w-[720px]">
            {p.worth_talking_about.items.map((it, i) => (
              <li key={i} className="flex gap-4">
                <span className="font-mono text-[11px] text-[color:var(--haevn-teal)]">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[15px] leading-relaxed text-[color:var(--haevn-navy)]">{it}</span>
              </li>
            ))}
          </ol>
          {p.worth_talking_about.closing && (
            <p className="mt-5 text-[15px] leading-relaxed text-[color:var(--haevn-muted-fg)] md:max-w-[720px]">{p.worth_talking_about.closing}</p>
          )}
        </>
      ) : null}

      {/* §05 */}
      {p?.signals_that_mattered?.length ? (
        <>
          <SectionHeading num="05" title="The Signals That Mattered" />
          <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--haevn-muted-fg)] md:max-w-[720px]">
            What pushed this introduction above the line — the evidence HAEVN weighted most heavily.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {p.signals_that_mattered.map((c, i) => (
              <span key={i} className="rounded-full border border-[color:var(--haevn-teal)]/30 bg-[color:var(--haevn-teal)]/5 px-3.5 py-1.5 text-[13px] text-[color:var(--haevn-navy)]">
                {c}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {/* the gate — after the analysis, before the action */}
      {isFree && (
        <div className="mt-14 rounded-2xl border border-[color:var(--haevn-teal)]/25 bg-[color:var(--haevn-teal)]/5 p-7 text-center">
          <Lock size={20} className="mx-auto text-[color:var(--haevn-teal)]" />
          <p className="mt-3 font-heading text-xl text-[color:var(--haevn-navy)]">{BECOME_MEMBER_CTA}</p>
          <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-relaxed text-[color:var(--haevn-muted-fg)]">
            {BREAKDOWN_GATE_SUPPORT}
          </p>
          <button
            onClick={onUpgrade}
            className="mt-5 min-h-[44px] rounded-full bg-[color:var(--haevn-orange)] px-7 py-3 text-[16px] font-medium text-white"
          >
            {BECOME_MEMBER_CTA}
          </button>
        </div>
      )}

      {/* §06 — paid only */}
      {!isFree && p?.conversation_starters?.length ? (
        <>
          <SectionHeading num="06" title="Conversation Starters" />
          <ol className="mt-5 space-y-4 md:max-w-[720px]">
            {p.conversation_starters.map((c, i) => (
              <li key={i} className="flex gap-4">
                <span className="font-mono text-[11px] text-[color:var(--haevn-teal)]">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[15px] leading-relaxed text-[color:var(--haevn-navy)]">{c}</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {/* closing read */}
      <div className="mt-14 border-t-2 border-[color:var(--haevn-teal)] pt-6">
        <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-[color:var(--haevn-teal)]">HAEVN&rsquo;S READ</p>
        <p className="mt-2 font-mono text-[13px] font-bold tracking-[0.1em] text-[color:var(--haevn-navy)]">
          {data.matchScore}% MATCH · {verdict}
        </p>
        <p className={`mt-4 text-[16px] leading-relaxed md:max-w-[720px] ${p?.closing_read?.statement ? 'text-[color:var(--haevn-navy)]' : 'italic text-[color:var(--haevn-muted-fg)]'}`}>
          {p?.closing_read?.statement || PREPARING}
        </p>
      </div>
    </div>
  )
}

/** Thin wrapper: supplies navigation. The route renders this. */
export default function MatchReport({ data }: { data: MatchBreakdownData }) {
  const router = useRouter()
  return (
    <MatchReportDocument
      data={data}
      onBack={() => router.push('/dashboard/matches')}
      // Routing is unchanged — same membership surface the card already links to.
      onUpgrade={() => router.push('/onboarding/membership?src=/dashboard/matches')}
    />
  )
}
