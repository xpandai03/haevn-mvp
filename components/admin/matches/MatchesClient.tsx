'use client'

/**
 * /admin/matches — searchable/sortable/filterable list of the CURRENT match set.
 * Read-only. All search/filter/sort/pagination happen server-side in
 * /api/admin/matches; this component just drives the params and renders.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowUpDown,
  Check,
  ExternalLink,
  RefreshCw,
  Search,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HaevnLoader } from '@/components/ui/haevn-loader'
import { marketDisplay, type MatchRow, type MatchCounts, type SortKey } from '@/lib/admin/matchRows'
import type { MarketOption } from '@/components/admin/network/types'

interface MatchesResponse {
  rows: MatchRow[]
  total: number
  page: number
  pageSize: number
  counts: MatchCounts
  lastComputedAt: string | null
  generatedAt: string
}

const PAGE_SIZE = 50
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

const CONNECTION_LABEL: Record<string, string> = {
  connected: 'Connected',
  conversation: 'Conversation',
  ready_to_meet: 'Ready to meet',
  passed: 'Passed',
}

export function MatchesClient() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [band, setBand] = useState('all')
  const [status, setStatus] = useState('all')
  const [market, setMarket] = useState('all')
  const [sort, setSort] = useState<SortKey>('score')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const [markets, setMarkets] = useState<MarketOption[]>([])
  const [data, setData] = useState<MatchesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])
  // reset to page 1 whenever a filter/search/sort changes
  useEffect(() => {
    setPage(1)
  }, [debounced, band, status, market, sort, dir])

  useEffect(() => {
    fetch('/api/admin/markets', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { markets: [] }))
      .then((j) => setMarkets((j.markets ?? []).filter((m: MarketOption) => m.is_live)))
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        search: debounced,
        band,
        status,
        market,
        sort,
        dir,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      const res = await fetch(`/api/admin/matches?${qs}`, { cache: 'no-store' })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || `Request failed (${res.status})`)
      }
      setData(await res.json())
    } catch (e: any) {
      setError(e?.message || 'Failed to load matches')
    } finally {
      setLoading(false)
    }
  }, [debounced, band, status, market, sort, dir, page])

  useEffect(() => {
    load()
  }, [load])

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(key)
      setDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-haevn-navy">Matches</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Current match set · unique pairs · computed {fmtDate(data?.lastComputedAt ?? null)}
              <span className="ml-2 text-xs text-gray-400">
                (rewritten each Monday — live set, not history)
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Counted as unique pairs (each match once). The dashboard&apos;s &ldquo;Matches Generated&rdquo;
              counts per member, so it reads about 2×.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex h-9 w-fit items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Counts strip */}
        {data && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-xs text-gray-500">
            <Count label="matches" n={data.counts.matches} />
            <Count label="recommendations" n={data.counts.recommendations} />
            <Count label="released" n={data.counts.released} />
            <Count label="notified" n={data.counts.notified} />
            <Count label="connected" n={data.counts.connected} />
            <span className="ml-auto text-gray-400">{data.total.toLocaleString()} in view</span>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or partnership ID…"
            className="h-9 w-full rounded-md border pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-haevn-teal/40"
          />
        </div>
        <FilterSelect value={band} onChange={setBand} placeholder="Band" width={130}
          options={[['all', 'All bands'], ['match', 'Matches (≥80)'], ['rec', 'Recommendations']]} />
        <FilterSelect value={status} onChange={setStatus} placeholder="Status" width={130}
          options={[['all', 'All status'], ['pending', 'Pending'], ['released', 'Released'], ['notified', 'Notified']]} />
        <FilterSelect value={market} onChange={setMarket} placeholder="Market" width={190}
          options={[['all', 'All markets'], ...markets.map((m) => [m.market_name, m.market_name] as [string, string]), ['unresolved', 'Unresolved']]} />
      </div>

      {/* States */}
      {loading && !data && (
        <div className="flex justify-center py-20"><HaevnLoader /></div>
      )}
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-haevn-error/30 bg-haevn-error/5 px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-haevn-error">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </div>
          <button onClick={load} className="rounded-md border border-haevn-error/40 px-3 py-1.5 text-xs font-medium text-haevn-error hover:bg-haevn-error/10">Retry</button>
        </div>
      )}

      {/* Table */}
      {data && (
        <div className="rounded-xl border bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead label="Pair" onClick={() => toggleSort('name')} active={sort === 'name'} dir={dir} />
                  <TableHead className="text-xs">Band</TableHead>
                  <SortHead label="Score" onClick={() => toggleSort('score')} active={sort === 'score'} dir={dir} align="right" />
                  <TableHead className="text-xs">Market / cities</TableHead>
                  <SortHead label="Computed" onClick={() => toggleSort('computed_at')} active={sort === 'computed_at'} dir={dir} />
                  <SortHead label="Release" onClick={() => toggleSort('release_at')} active={sort === 'release_at'} dir={dir} />
                  <TableHead className="text-xs">Notified</TableHead>
                  <TableHead className="text-xs">Expires</TableHead>
                  <TableHead className="text-xs">Connection</TableHead>
                  <TableHead className="text-xs"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-sm text-gray-400">
                      No matches for these filters.
                    </TableCell>
                  </TableRow>
                )}
                {data.rows.map((r) => (
                  <TableRow key={r.id} className="text-xs">
                    <TableCell className="max-w-[220px]">
                      <div className="truncate font-medium text-gray-800">
                        {r.nameA ?? 'Unknown'} <span className="text-gray-300">×</span> {r.nameB ?? 'Unknown'}
                      </div>
                      <div className="truncate font-mono text-[10px] text-gray-400">
                        {r.partnershipA.slice(0, 8)} · {r.partnershipB.slice(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell><BandBadge band={r.band} /></TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-gray-900">{r.score}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate text-gray-700">{marketDisplay(r.marketA, r.marketB)}</div>
                      <div className="truncate text-[10px] text-gray-400">{r.cityA ?? '?'} · {r.cityB ?? '?'}</div>
                    </TableCell>
                    <TableCell className="text-gray-600">{fmtDate(r.computedAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-600">{fmtDate(r.releaseAt)}</span>
                        <StatusChip status={r.releaseStatus} />
                      </div>
                    </TableCell>
                    <TableCell>{r.notified ? <Check className="h-3.5 w-3.5 text-haevn-success" /> : <span className="text-gray-300">—</span>}</TableCell>
                    <TableCell className="text-gray-600">{fmtDate(r.expiresAt)}</TableCell>
                    <TableCell>{r.connection ? <span className="text-gray-700">{CONNECTION_LABEL[r.connection]}</span> : <span className="text-gray-300">—</span>}</TableCell>
                    <TableCell>
                      <Link href={r.inspectHref} className="flex items-center gap-1 text-haevn-teal hover:underline">
                        Inspect <ExternalLink className="h-3 w-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-gray-500">
            <span>Page {data.page} of {totalPages} · {data.total.toLocaleString()} rows</span>
            <div className="flex gap-2">
              <button disabled={data.page <= 1} onClick={() => setPage((x) => Math.max(1, x - 1))}
                className="rounded-md border px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">Prev</button>
              <button disabled={data.page >= totalPages} onClick={() => setPage((x) => x + 1)}
                className="rounded-md border px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Count({ label, n }: { label: string; n: number }) {
  return <span><span className="font-semibold tabular-nums text-gray-900">{n.toLocaleString()}</span> {label}</span>
}

function FilterSelect({
  value, onChange, options, placeholder, width,
}: {
  value: string; onChange: (v: string) => void; options: [string, string][]; placeholder: string; width: number
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-xs" style={{ width }}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function SortHead({
  label, onClick, active, dir, align,
}: {
  label: string; onClick: () => void; active: boolean; dir: 'asc' | 'desc'; align?: 'right'
}) {
  return (
    <TableHead className={`text-xs ${align === 'right' ? 'text-right' : ''}`}>
      <button onClick={onClick} className={`inline-flex items-center gap-1 hover:text-gray-900 ${active ? 'text-haevn-teal' : 'text-gray-500'}`}>
        {label}
        <ArrowUpDown className="h-3 w-3" />
        {active && <span className="text-[9px]">{dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </TableHead>
  )
}

function BandBadge({ band }: { band: string }) {
  const isMatch = band === 'match'
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
      isMatch ? 'bg-haevn-teal/10 text-haevn-teal' : 'bg-haevn-orange/15 text-haevn-orange'
    }`}>
      {isMatch ? 'Match' : 'Rec'}
    </span>
  )
}

function StatusChip({ status }: { status: 'pending' | 'released' }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
      status === 'released' ? 'bg-haevn-success/15 text-haevn-success' : 'bg-gray-100 text-gray-500'
    }`}>
      {status}
    </span>
  )
}
