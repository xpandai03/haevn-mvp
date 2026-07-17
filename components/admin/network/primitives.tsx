'use client'

import { ArrowDownRight, ArrowUpRight, Info, Minus } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** Info dot with the metric's honest definition. */
export function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label="What this means"
          className="text-gray-300 transition hover:text-gray-500"
        >
          <Info className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs leading-snug">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Week-over-week delta. `prior === null` → no stored prior snapshot yet, so we
 * show a quiet "collecting history" state instead of a fabricated 0%.
 */
export function WowDelta({
  current,
  prior,
}: {
  current: number
  prior: number | null
}) {
  if (prior === null) {
    return (
      <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
        <Minus className="h-3 w-3" />
        collecting history
      </p>
    )
  }

  const delta = current - prior
  const pct = prior !== 0 ? Math.round((delta / prior) * 100) : null

  if (delta === 0) {
    return (
      <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
        <Minus className="h-3 w-3" />
        no change vs prior week
      </p>
    )
  }

  const up = delta > 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  const color = up ? 'text-haevn-success' : 'text-haevn-error'
  const sign = up ? '+' : '−'
  const mag = Math.abs(delta)

  return (
    <p className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {sign}
      {mag.toLocaleString()}
      {pct !== null && (
        <span className="font-normal text-gray-400">
          ({sign}
          {Math.abs(pct)}%)
        </span>
      )}
      <span className="font-normal text-gray-400">vs prior week</span>
    </p>
  )
}

/**
 * Inline-SVG sparkline (no chart lib — recharts is reserved for the composition
 * charts). 0–1 points renders a single dot; the full line fills in as weekly
 * snapshots accumulate.
 */
export function Sparkline({
  series,
  color = '#008080',
  width = 72,
  height = 22,
}: {
  series: number[]
  /** CSS color for the line + dot (per-card accent). Defaults to haevn-teal. */
  color?: string
  width?: number
  height?: number
}) {
  const pad = 2
  const pts = series.filter((n) => typeof n === 'number' && !Number.isNaN(n))

  if (pts.length <= 1) {
    return (
      <svg width={width} height={height} className="mt-1 opacity-70" aria-hidden="true">
        <circle cx={pad + 2} cy={height / 2} r={2} style={{ fill: color }} />
      </svg>
    )
  }

  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const stepX = (width - pad * 2) / (pts.length - 1)

  const coords = pts.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (1 - (v - min) / span) * (height - pad * 2)
    return [x, y] as const
  })
  const d = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = coords[coords.length - 1]

  return (
    <svg width={width} height={height} className="mt-1" aria-hidden="true">
      <polyline
        points={d}
        fill="none"
        style={{ stroke: color }}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lx} cy={ly} r={1.8} style={{ fill: color }} />
    </svg>
  )
}
