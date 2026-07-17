'use client'

/**
 * Composition charts — the first real recharts usage in the app, on the shadcn
 * chart.tsx wrapper, themed with the --chart-1..5 tokens.
 *
 * Donut for nominal single-select (Gender, Orientation); horizontal bar for
 * Age (ordinal — natural order kept) and Relationship Intent (multi-select —
 * percentages intentionally do NOT sum to 100). A precise legend beneath every
 * chart carries count + %, and the caption carries "total represented", so the
 * numbers are exact regardless of how the chart renders.
 *
 * Segments are keyed and mapped so a click handler can be attached later (drill-
 * down / cross-filter) without restructuring — none is wired in this phase.
 */

import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { CompositionBucket } from '@/lib/metrics/types'
import { InfoTip } from './primitives'

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

/**
 * Display aliases for the survey answer codes (presentation only — not a change
 * to what's counted). Unknown codes fall through to the raw value.
 */
const BUCKET_LABELS: Record<string, string> = {
  // gender
  man: 'Man', woman: 'Woman', nb: 'Non-binary', tm: 'Trans masc', tw: 'Trans femme',
  gq: 'Genderqueer', oth: 'Other', pns: 'Prefer not to say',
  // orientation
  straight: 'Straight', bi: 'Bisexual', gay: 'Gay / Lesbian', pan: 'Pansexual',
  queer: 'Queer', q: 'Questioning', demi: 'Demisexual', ace: 'Asexual',
  // intent
  lt: 'Long-term', st: 'Short-term', play: 'Play', fwb: 'Friends w/ benefits',
  comm: 'Community', poly_group: 'Poly / group',
  // shared
  unknown: 'Unknown',
}

function labelFor(bucket: string): string {
  return BUCKET_LABELS[bucket] ?? bucket
}

function pct(n: number, base: number): number {
  return base > 0 ? Math.round((n / base) * 100) : 0
}

export function CompositionChart({
  title,
  buckets,
  variant,
  ordinal = false,
  /** Denominator for %. Omit → sum of buckets (single-select, sums to ~100%). */
  percentBase,
  caption,
  note,
  tooltip,
}: {
  title: string
  buckets: CompositionBucket[]
  variant: 'donut' | 'bar'
  ordinal?: boolean
  percentBase?: number
  caption: string
  note?: string
  tooltip: string
}) {
  const rows = ordinal ? buckets : [...buckets].sort((a, b) => b.count - a.count)
  const sum = rows.reduce((s, b) => s + b.count, 0)
  const base = percentBase ?? sum

  const header = (
    <div className="mb-1 flex items-center gap-1.5">
      <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
      <InfoTip text={tooltip} />
    </div>
  )

  if (rows.length === 0 || sum === 0) {
    return (
      <div className="rounded-xl border bg-white p-5">
        {header}
        <p className="py-8 text-center text-xs text-gray-400">No data available for this scope yet.</p>
      </div>
    )
  }

  // Stable color per segment (by sorted position).
  const colored = rows.map((b, i) => ({
    ...b,
    label: labelFor(b.bucket),
    color: COLORS[i % COLORS.length],
    key: `${b.dimension}:${b.bucket}`,
  }))

  return (
    <div className="rounded-xl border bg-white p-5">
      {header}
      <p className="mb-3 text-[11px] text-gray-400">Total represented: {sum.toLocaleString()}</p>

      {variant === 'donut' ? (
        <ChartContainer config={{}} className="mx-auto aspect-square max-h-[190px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
            <Pie
              data={colored}
              dataKey="count"
              nameKey="label"
              innerRadius={48}
              outerRadius={78}
              paddingAngle={2}
              strokeWidth={0}
            >
              {colored.map((d) => (
                // data-segment enables a future onClick without restructuring.
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      ) : (
        <ChartContainer config={{}} className="h-[190px] w-full">
          <BarChart data={colored} layout="vertical" margin={{ left: 4, right: 16, top: 2, bottom: 2 }}>
            <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={116}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#6b7280' }}
            />
            <Bar dataKey="count" radius={4} fill="hsl(var(--chart-1))" />
          </BarChart>
        </ChartContainer>
      )}

      {/* Precise legend: count + %. */}
      <ul className="mt-3 space-y-1.5 border-t pt-3">
        {colored.map((d) => (
          <li key={d.key} className="flex items-center gap-2 text-xs">
            {variant === 'donut' && (
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
            )}
            <span className="truncate text-gray-600" title={d.label}>
              {d.label}
            </span>
            <span className="ml-auto shrink-0 tabular-nums font-medium text-gray-700">
              {d.count.toLocaleString()} <span className="font-normal text-gray-400">({pct(d.count, base)}%)</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-gray-400">{caption}</p>
      {note && <p className="mt-1 text-[11px] italic text-gray-400">{note}</p>}
    </div>
  )
}
