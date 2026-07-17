'use client'

/**
 * Network Performance dashboard — live data, wired to /api/admin/network-metrics.
 *
 * Sections: Network Snapshot (cumulative-current), Weekly Activity (per selected
 * reporting week), Network Composition (survey distributions). Scope = network or
 * a live market; week = a recent reporting week. One fetch per scope/week change.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Info, RefreshCw } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HaevnLoader } from '@/components/ui/haevn-loader'
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

const NETWORK = 'network'
const AGE_ORDER = ['18-24', '25-34', '35-44', '45-54', '55+', 'unknown']

export function NetworkPerformanceClient() {
  const [scope, setScope] = useState<string>(NETWORK)
  const [weekEnding, setWeekEnding] = useState<string>(() => currentReportingWeek().weekEnding)
  const [markets, setMarkets] = useState<MarketOption[]>([])
  const [data, setData] = useState<NetworkMetricsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const weekOptions = useMemo(
    () => recentWeeks(8).map((w) => ({ value: w.weekEnding, label: formatReportingWeek(w) })),
    []
  )

  // Live markets for the scope picker.
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

  const scopeLabel =
    scope === NETWORK ? 'Network (All Cities)' : scope

  return (
    <div className="space-y-6">
      {/* Header + selectors */}
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-haevn-navy">Network Performance</h1>
            <p className="mt-0.5 text-sm text-gray-500">Network Health Overview</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-9 w-[220px] text-xs">
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
              <SelectTrigger className="h-9 w-[210px] text-xs">
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
          </div>
        </div>

        {data && (
          <p className="mt-3 border-t pt-3 text-xs text-gray-500">
            Viewing <span className="font-medium text-gray-700">{scopeLabel}</span>
            <span className="mx-2 text-gray-300">·</span>
            Reporting week{' '}
            <span className="font-medium text-gray-700">{data.selectedWeek.label}</span>
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
          <Sections data={data} />
          <footer className="rounded-xl border bg-haevn-gray-50 px-5 py-3 text-[11px] text-gray-500">
            Data as of{' '}
            {new Date(data.metrics.generatedAt).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            <span className="mx-2 text-gray-300">·</span>
            {scopeLabel}
            <span className="mx-2 text-gray-300">·</span>
            Reporting week {data.selectedWeek.label}
          </footer>
        </>
      )}
    </div>
  )
}

// ── sections ──────────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
    </div>
  )
}

function Sections({ data }: { data: NetworkMetricsPayload }) {
  const snap = data.metrics.snapshot
  const sel = data.selectedWeek
  const surveyed = data.surveyedInScope

  const totalMembers = snapshotMetric(data, 'totalMembers')
  const incomplete = snapshotMetric(data, 'incompleteSurveys')
  const completed = snapshotMetric(data, 'completedSurveys')
  const free = snapshotMetric(data, 'membersFree')
  const noMatch = snapshotMetric(data, 'noCurrentMatch')

  const weekly: Array<{ key: keyof WeeklyMetrics; label: string; footnote?: string }> = [
    { key: 'matchesGenerated', label: 'Matches Generated', footnote: 'Score ≥ 80 band' },
    { key: 'recommendationsGenerated', label: 'Recommendations Generated', footnote: 'Score 77–79 band' },
    { key: 'nudgesSent', label: 'Nudges Sent' },
    { key: 'readyToMeetSignals', label: 'Ready to Meet Signals' },
    { key: 'newConnections', label: 'New Connections' },
    { key: 'conversationsStarted', label: 'Conversations Started' },
  ]

  // Age keeps its natural (ordinal) order.
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
        <SectionHeader title="Network Snapshot" subtitle="Cumulative current state, with week-over-week" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Members" {...totalMembers} tooltip={TOOLTIPS.totalMembers} />
          <KpiCard label="Incomplete Surveys" {...incomplete} tooltip={TOOLTIPS.incompleteSurveys} />
          <KpiCard label="Completed Surveys" {...completed} tooltip={TOOLTIPS.completedSurveys} />
          <KpiCard label="Members (Free)" {...free} tooltip={TOOLTIPS.membersFree} />
          <BlockedCard label="Plus Members" reason={(snap.plusMembers as BlockedMetric).reason} />
          <BlockedCard label="Plus Conversion" reason={(snap.plusConversion as BlockedMetric).reason} />
          <KpiCard
            label="Never Matched"
            {...noMatch}
            tooltip={TOOLTIPS.noCurrentMatch}
            footnote="Currently: no current match"
          />
          <BlockedCard label="Meetup Shares" reason={(snap.meetupShares as BlockedMetric).reason} />
        </div>
      </section>

      {/* Section 2 — Weekly Activity */}
      <section>
        <SectionHeader
          title="Weekly Activity"
          subtitle={`Reporting week ${sel.label}${sel.isCurrent ? ' (current)' : ''}`}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {weekly.map((w) => {
            const m = weeklyMetric(data, w.key)
            return (
              <KpiCard
                key={w.key}
                label={w.label}
                value={m.value}
                prior={m.prior}
                series={m.series}
                tooltip={TOOLTIPS[w.key]}
                footnote={m.value !== null ? w.footnote : undefined}
                unavailableNote="No activity recorded for this reporting week."
              />
            )
          })}
        </div>
      </section>

      {/* Section 3 — Network Composition */}
      <section>
        <SectionHeader title="Network Composition" subtitle="Distributions across the member base (survey data)" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
    </div>
  )
}
