'use client'

import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { InfoTip, Sparkline, WowDelta } from './primitives'

/** Small icon in a tinted rounded square, accent-colored. */
function IconSquare({ icon: Icon, accent }: { icon: LucideIcon; accent: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: `${accent}1A`, color: accent }}
    >
      <Icon className="h-4 w-4" />
    </span>
  )
}

/**
 * A sourceable KPI. Icon square (per-metric accent), label, large value, WoW,
 * and a sparkline colored to match the accent. With `href` the whole card links
 * to the list behind its number (the Founding Activations pattern); without it
 * the card has no pointer affordance, so it promises nothing it can't do.
 */
export function KpiCard({
  label,
  value,
  prior,
  series,
  tooltip,
  icon,
  accent = '#008080',
  footnote,
  emptyNote,
  id,
  href,
}: {
  label: string
  /** null = no data for the selected (past) week — render a muted placeholder. */
  value: number | null
  prior: number | null
  series: number[]
  tooltip: string
  icon: LucideIcon
  /** Hex accent color for the icon square + sparkline. */
  accent?: string
  footnote?: string
  emptyNote?: string
  id?: string
  /** Drill-down target. The card becomes a link to the rows behind its number. */
  href?: string
}) {
  const body = (
    <>
      <div className="relative z-10 mb-2 flex w-fit items-center gap-2">
        <IconSquare icon={icon} accent={accent} />
        <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
        <InfoTip text={tooltip} />
      </div>

      {value === null ? (
        <>
          <p className="text-2xl font-bold tabular-nums text-gray-300">—</p>
          <p className="mt-1 text-[11px] text-gray-400">
            {emptyNote ?? 'No snapshot for this reporting week.'}
          </p>
        </>
      ) : (
        <>
          <div className="flex items-end justify-between gap-2">
            <p className="text-2xl font-bold tabular-nums text-gray-900">{value.toLocaleString()}</p>
            <Sparkline series={series} color={accent} />
          </div>
          <WowDelta current={value} prior={prior} />
          {footnote && <p className="mt-1 text-[10px] italic text-gray-400">{footnote}</p>}
        </>
      )}
      {href && (
        <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-haevn-teal">
          View list <ArrowRight className="h-3 w-3" />
        </p>
      )}
    </>
  )

  // Stretched link, not a wrapping <a>: the info tip is a <button>, which may not
  // nest inside a link, and tapping it must open the tip rather than navigate.
  return (
    <div
      id={id}
      className={`relative rounded-xl border bg-white px-5 py-4 scroll-mt-24${
        href ? ' transition hover:border-haevn-teal/40 hover:bg-black/[0.02]' : ''
      }`}
    >
      {href && <Link href={href} aria-label={`${label} — view list`} className="absolute inset-0 rounded-xl" />}
      {body}
    </div>
  )
}
