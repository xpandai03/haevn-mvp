'use client'

/**
 * Network Performance dashboard — live data, wired to /api/admin/network-metrics.
 *
 * Sections: Network Snapshot (cumulative-current), Weekly Activity (per selected
 * reporting week), Network Composition (survey distributions). Scope = network or
 * a live market; week = a recent reporting week. One fetch per scope/week change.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  Bell,
  Camera,
  CircleUser,
  ClipboardCheck,
  ClipboardList,
  Download,
  HeartCrack,
  Info,
  Link2,
  ListFilter,
  MessageCircle,
  Percent,
  RefreshCw,
  Share2,
  Sparkles,
  Star,
  ThumbsUp,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HaevnLoader } from '@/components/ui/haevn-loader'
import { useToast } from '@/hooks/use-toast'
import {
  currentReportingWeek,
  formatReportingWeek,
  recentWeeks,
} from '@/lib/metrics/reportingWeek'
import type { BlockedMetric, WeeklyMetrics } from '@/lib/metrics/types'
import type { MarketOption, NetworkMetricsPayload } from './types'
import { snapshotMetric, weeklyMetric } from './derive'
import { TOOLTIPS } from './tooltips'
import { KpiCard, BlockedCard } from './cards'
import { CompositionChart } from './CompositionChart'
import { EngagementStrip } from './EngagementStrip'

const NETWORK = 'network'
const AGE_ORDER = ['18-24', '25-34', '35-44', '45-54', '55+', 'unknown']

// Per-card accent hexes (brand + a few distinct hues) so sparklines aren't all-teal.
const TEAL = '#008080'
const ORANGE = '#E29E0C'
const NAVY = '#1E2A4A'
const GREEN = '#388E3C'
const BLUE = '#2F6DB5'
const VIOLET = '#7C5CBF'

function relativeTime(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'moments'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'}`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

export function NetworkPerformanceClient() {
  const { toast } = useToast()
  const [scope, setScope] = useState<string>(NETWORK)
  const [weekEnding, setWeekEnding] = useState<string>(() => currentReportingWeek().weekEnding)
  const [markets, setMarkets] = useState<MarketOption[]>([])
  const [data, setData] = useState<NetworkMetricsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snapping, setSnapping] = useState(false)

  const weekOptions = useMemo(
    () => recentWeeks(8).map((w) => ({ value: w.weekEnding, label: formatReportingWeek(w) })),
    []
  )

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/markets', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { markets: [] }))
      .then((j) => {
        if (!cancelled) setMarkets((j.markets ?? []).filter((m: MarketOption) => m.is_live))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/network-metrics?scope=${encodeURIComponent(scope)}&week=${weekEnding}`,
        { cache: 'no-store' }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      setData(await res.json())
    } catch (e: any) {
      setError(e?.message || 'Failed to load network metrics')
    } finally {
      setLoading(false)
    }
  }, [scope, weekEnding])

  useEffect(() => {
    load()
  }, [load])

  const runSnapshot = useCallback(async () => {
    setSnapping(true)
    try {
      const res = await fetch('/api/admin/snapshot-network', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body.ok === false) throw new Error(body.error || `Failed (${res.status})`)
      toast({
        title: 'Snapshot written',
        description: `${body.written} row${body.written === 1 ? '' : 's'} for week ${body.weekEnding}.`,
      })
      await load()
    } catch (e: any) {
      toast({ title: 'Snapshot failed', description: e?.message || 'Unknown error', variant: 'destructive' })
    } finally {
      setSnapping(false)
    }
  }, [toast, load])

  const exportMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/export-members?scope=${encodeURIComponent(scope)}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Export failed (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `haevn-members-${scope === NETWORK ? 'network' : 'market'}-${
        data?.selectedWeek.weekEnding ?? 'export'
      }.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast({ title: 'Export failed', description: e?.message || 'Unknown error', variant: 'destructive' })
    }
  }, [scope, data, toast])

  const viewNeverMatched = useCallback(() => {
    document.getElementById('never-matched-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    toast({ title: 'Never Matched', description: 'Filtered drill-downs arrive in the next phase.' })
  }, [toast])

  const scopeLabel = scope === NETWORK ? 'Network (All Cities)' : scope
  const generatedAt = data?.generatedAt ?? data?.metrics.generatedAt

  return (
    <div className="space-y-6">
      {/* Header + selectors */}
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-haevn-navy">Network Performance</h1>
            <p className="mt-0.5 text-sm text-gray-500">Network Health Overview</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-9 w-[210px] text-xs">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NETWORK}>Network (All Cities)</SelectItem>
                {markets.map((m) => (
                  <SelectItem key={m.market_name} value={m.market_name}>
                    {m.market_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={weekEnding} onValueChange={setWeekEnding}>
              <SelectTrigger className="h-9 w-[200px] text-xs">
                <SelectValue placeholder="Reporting week" />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map((w, i) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                    {i === 0 ? ' (current)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              onClick={load}
              disabled={loading}
              className="flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={runSnapshot}
              disabled={snapping}
              className="flex h-9 items-center gap-1.5 rounded-md bg-haevn-teal px-3 text-xs font-medium text-white transition hover:bg-haevn-teal/90 disabled:opacity-50"
            >
              <Camera className={`h-3.5 w-3.5 ${snapping ? 'animate-pulse' : ''}`} />
              {snapping ? 'Saving…' : 'Run snapshot'}
            </button>
          </div>
        </div>

        {data && (
          <p className="mt-3 border-t pt-3 text-xs text-gray-500">
            Viewing <span className="font-medium text-gray-700">{scopeLabel}</span>
            <span className="mx-2 text-gray-300">·</span>
            Reporting week <span className="font-medium text-gray-700">{data.selectedWeek.label}</span>
            <span className="ml-1 text-gray-400">(vs {data.selectedWeek.priorLabel})</span>
          </p>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-haevn-teal/30 bg-haevn-teal/5 px-5 py-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-haevn-teal" />
        <div className="text-xs leading-relaxed text-gray-600">
          <p className="font-semibold text-haevn-navy">Live network health</p>
          <p className="mt-0.5">
            The Snapshot section is cumulative-current; Weekly Activity is bucketed by the selected
            reporting week (UTC, Sunday–Saturday). Week-over-week fills in as weekly snapshots
            accumulate. Three metrics are temporarily unavailable — each card explains why.
          </p>
        </div>
      </div>

      {/* States */}
      {loading && !data && (
        <div className="flex justify-center py-20">
          <HaevnLoader />
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-haevn-error/30 bg-haevn-error/5 px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-haevn-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
          <button
            onClick={load}
            className="rounded-md border border-haevn-error/40 px-3 py-1.5 text-xs font-medium text-haevn-error transition hover:bg-haevn-error/10"
          >
            Retry
          </button>
        </div>
      )}

      {data && data.metrics.partnershipsInScope === 0 && !error && (
        <div className="rounded-xl border bg-white px-5 py-12 text-center text-sm text-gray-400">
          No data available for this scope yet.
        </div>
      )}

      {data && data.metrics.partnershipsInScope > 0 && (
        <>
          <Sections data={data} onExport={exportMembers} onViewNeverMatched={viewNeverMatched} />
          {generatedAt && (
            <footer className="rounded-xl border bg-haevn-gray-50 px-5 py-3 text-[11px] leading-relaxed text-gray-500">
              Data refreshed <span className="font-medium text-gray-600">{relativeTime(generatedAt)}</span> ago
              <span className="mx-1.5 text-gray-300">·</span>
              Current State metrics are live. Weekly Activity reflects the selected reporting week. WoW
              compares to the immediately preceding reporting week.
            </footer>
          )}
        </>
      )}
    </div>
  )
}

// ── section header (numbered) ─────────────────────────────────────────────────
function SectionHeader({
  n,
  title,
  subtitle,
  helper,
}: {
  n: number
  title: string
  subtitle: string
  helper?: string
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-haevn-teal text-xs font-bold text-white">
          {n}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      {helper && <p className="hidden max-w-[280px] text-right text-[11px] text-gray-400 sm:block">{helper}</p>}
    </div>
  )
}

// ── card icon + accent maps ───────────────────────────────────────────────────
const WEEKLY_META: Record<
  keyof WeeklyMetrics,
  { label: string; icon: LucideIcon; accent: string; footnote?: string }
> = {
  matchesGenerated: { label: 'Matches Generated', icon: Sparkles, accent: TEAL, footnote: 'Score ≥ 80 band' },
  recommendationsGenerated: { label: 'Recommendations Generated', icon: ThumbsUp, accent: BLUE, footnote: 'Score 77–79 band' },
  nudgesSent: { label: 'Nudges Sent', icon: Bell, accent: ORANGE },
  readyToMeetSignals: { label: 'Ready to Meet Signals', icon: Zap, accent: GREEN },
  newConnections: { label: 'New Connections', icon: Link2, accent: VIOLET },
  conversationsStarted: { label: 'Conversations Started', icon: MessageCircle, accent: NAVY },
}
const WEEKLY_ORDER: Array<keyof WeeklyMetrics> = [
  'matchesGenerated',
  'recommendationsGenerated',
  'nudgesSent',
  'readyToMeetSignals',
  'newConnections',
  'conversationsStarted',
]

function Sections({
  data,
  onExport,
  onViewNeverMatched,
}: {
  data: NetworkMetricsPayload
  onExport: () => void
  onViewNeverMatched: () => void
}) {
  const snap = data.metrics.snapshot
  const sel = data.selectedWeek
  const surveyed = data.surveyedInScope

  const totalMembers = snapshotMetric(data, 'totalMembers')
  const incomplete = snapshotMetric(data, 'incompleteSurveys')
  const completed = snapshotMetric(data, 'completedSurveys')
  const free = snapshotMetric(data, 'membersFree')
  const noMatch = snapshotMetric(data, 'noCurrentMatch')

  const ageBuckets = [...data.composition.age].sort(
    (a, b) => AGE_ORDER.indexOf(a.bucket) - AGE_ORDER.indexOf(b.bucket)
  )

  const coverage = (buckets: { count: number }[]) => {
    const sum = buckets.reduce((s, b) => s + b.count, 0)
    const p = surveyed > 0 ? Math.round((sum / surveyed) * 100) : 0
    return `Based on ${sum.toLocaleString()} of ${surveyed.toLocaleString()} survey responses (${p}%)`
  }

  return (
    <div className="space-y-8">
      {/* Section 1 — Network Snapshot */}
      <section>
        <SectionHeader
          n={1}
          title="Network Snapshot"
          subtitle="Cumulative current state"
          helper="All metrics show week-over-week vs the prior reporting week."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Members" {...totalMembers} icon={Users} accent={TEAL} tooltip={TOOLTIPS.totalMembers} />
          <KpiCard label="Incomplete Surveys" {...incomplete} icon={ClipboardList} accent={ORANGE} tooltip={TOOLTIPS.incompleteSurveys} />
          <KpiCard label="Completed Surveys" {...completed} icon={ClipboardCheck} accent={GREEN} tooltip={TOOLTIPS.completedSurveys} />
          <KpiCard label="Members (Free)" {...free} icon={CircleUser} accent={NAVY} tooltip={TOOLTIPS.membersFree} />
          <BlockedCard label="Plus Members" icon={Star} reason={(snap.plusMembers as BlockedMetric).reason} />
          <BlockedCard label="Plus Conversion" icon={Percent} reason={(snap.plusConversion as BlockedMetric).reason} />
          <KpiCard
            id="never-matched-card"
            label="Never Matched"
            {...noMatch}
            icon={HeartCrack}
            accent={VIOLET}
            tooltip={TOOLTIPS.noCurrentMatch}
            footnote="Currently: no current match"
          />
          <BlockedCard label="Meetup Shares" icon={Share2} reason={(snap.meetupShares as BlockedMetric).reason} />
        </div>
      </section>

      {/* Section 2 — Weekly Activity */}
      <section>
        <SectionHeader
          n={2}
          title="Weekly Activity"
          subtitle={`Reporting week ${sel.label}${sel.isCurrent ? ' (current)' : ''}`}
          helper="These metrics reset each reporting week."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WEEKLY_ORDER.map((key) => {
            const meta = WEEKLY_META[key]
            const m = weeklyMetric(data, key)
            return (
              <KpiCard
                key={key}
                label={meta.label}
                value={m.value}
                prior={m.prior}
                series={m.series}
                icon={meta.icon}
                accent={meta.accent}
                tooltip={TOOLTIPS[key]}
                footnote={m.value !== null ? meta.footnote : undefined}
                unavailableNote="No activity recorded for this reporting week."
              />
            )
          })}
        </div>
      </section>

      {/* Engagement — un-numbered, between Weekly (2) and Composition (3) */}
      <EngagementStrip data={data} />

      {/* Section 3 — Network Composition */}
      <section>
        <SectionHeader n={3} title="Network Composition" subtitle="Distributions across the member base" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CompositionChart
            title="Gender"
            variant="donut"
            buckets={data.composition.gender}
            caption={coverage(data.composition.gender)}
            tooltip="Self-reported gender identity from the onboarding survey."
          />
          <CompositionChart
            title="Orientation"
            variant="donut"
            buckets={data.composition.orientation}
            caption={coverage(data.composition.orientation)}
            tooltip="Self-reported sexual orientation from the onboarding survey."
          />
          <CompositionChart
            title="Relationship Intent"
            variant="bar"
            buckets={data.composition.relationshipIntent}
            percentBase={surveyed}
            caption={`Based on ${surveyed.toLocaleString()} survey responses`}
            note="Multi-select — members may select multiple intents, so bars do not sum to 100%."
            tooltip="What members are looking for. Multi-select, so a member can appear in multiple buckets."
          />
          <CompositionChart
            title="Age Distribution"
            variant="bar"
            buckets={ageBuckets}
            ordinal
            caption={coverage(ageBuckets)}
            tooltip="Age derived from survey birthdate, in brackets."
          />
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-5 py-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Quick actions</span>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export Member List
          </button>
          <button
            onClick={onViewNeverMatched}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <ListFilter className="h-3.5 w-3.5" />
            View Never Matched
          </button>
          <span className="ml-auto hidden items-center gap-1 text-[11px] text-gray-400 sm:flex">
            <ArrowDownToLine className="h-3 w-3" />
            CSV excludes all PII
          </span>
        </div>
      </section>
    </div>
  )
}
