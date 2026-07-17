'use client'

import { Lock, type LucideIcon } from 'lucide-react'
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
 * and a sparkline colored to match the accent. No cursor-pointer — drill-down is
 * a later phase, so the card promises nothing it can't do yet.
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
  unavailableNote,
  id,
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
  unavailableNote?: string
  id?: string
}) {
  return (
    <div id={id} className="rounded-xl border bg-white px-5 py-4 scroll-mt-24">
      <div className="mb-2 flex items-center gap-2">
        <IconSquare icon={icon} accent={accent} />
        <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
        <InfoTip text={tooltip} />
      </div>

      {value === null ? (
        <>
          <p className="text-2xl font-bold tabular-nums text-gray-300">—</p>
          <p className="mt-1 text-[11px] text-gray-400">
            {unavailableNote ?? 'No snapshot for this reporting week.'}
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
    </div>
  )
}

/**
 * A metric that cannot be sourced yet. Keeps the dashed-amber treatment but
 * adopts the same icon-square layout — explicit "Unavailable" + the honest
 * reason, never a fabricated number.
 */
export function BlockedCard({
  label,
  reason,
  icon,
}: {
  label: string
  reason: string
  icon: LucideIcon
}) {
  const Icon = icon
  return (
    <div className="rounded-xl border-2 border-dashed border-haevn-orange/50 bg-haevn-orange/5 px-5 py-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-haevn-orange/15 text-haevn-orange">
          <Icon className="h-4 w-4" />
        </span>
        <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-haevn-orange">
          <Lock className="h-3 w-3" />
          {label}
        </p>
        <InfoTip text={reason} />
      </div>
      <p className="text-base font-semibold text-amber-800">Unavailable</p>
      <p className="mt-1 text-[11px] leading-snug text-amber-700/80">{reason}</p>
    </div>
  )
}
