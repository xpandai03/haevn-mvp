'use client'

import { Lock } from 'lucide-react'
import { InfoTip, Sparkline, WowDelta } from './primitives'

/**
 * A sourceable KPI. Adapts the mockup's StatTile with a real WoW delta, an
 * inline sparkline, and an info tooltip. No cursor-pointer — drill-down is a
 * later phase, so the card promises nothing it can't do yet.
 */
export function KpiCard({
  label,
  value,
  prior,
  series,
  tooltip,
  footnote,
  unavailableNote,
}: {
  label: string
  /** null = no data for the selected (past) week — render a muted placeholder. */
  value: number | null
  prior: number | null
  series: number[]
  tooltip: string
  footnote?: string
  unavailableNote?: string
}) {
  return (
    <div className="rounded-xl border bg-white px-5 py-4">
      <div className="mb-1 flex items-center gap-1.5">
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
            <Sparkline series={series} />
          </div>
          <WowDelta current={value} prior={prior} />
          {footnote && <p className="mt-1 text-[10px] italic text-gray-400">{footnote}</p>}
        </>
      )}
    </div>
  )
}

/**
 * A metric that cannot be sourced yet. Adapts the mockup's BlockedTile — explicit
 * "Unavailable" + the honest reason, never a fabricated number.
 */
export function BlockedCard({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-haevn-orange/50 bg-haevn-orange/5 px-5 py-4">
      <div className="mb-1 flex items-center gap-1.5">
        <Lock className="h-3 w-3 text-haevn-orange" />
        <p className="text-xs uppercase tracking-wide text-haevn-orange">{label}</p>
        <InfoTip text={reason} />
      </div>
      <p className="text-base font-semibold text-amber-800">Unavailable</p>
      <p className="mt-1 text-[11px] leading-snug text-amber-700/80">{reason}</p>
    </div>
  )
}
