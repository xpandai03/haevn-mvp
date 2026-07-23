'use client'

/**
 * /admin/surveys — the survey funnel: every member's position (complete /
 * in-progress / never-started), with dates + login state. Read-only. All
 * search/filter/sort/pagination server-side in /api/admin/surveys.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Check, ExternalLink, RefreshCw, Search } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { HaevnLoader } from '@/components/ui/haevn-loader'
import type { SurveyRow, SurveySortKey, SurveySummary } from '@/lib/admin/surveyRows'
import type { MarketOption } from '@/components/admin/network/types'

interface SurveysResponse {
  rows: SurveyRow[]
  total: number
  page: number
  pageSize: number
  summary: SurveySummary
  generatedAt: string
}

const PAGE_SIZE = 48
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export function SurveysClient() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('all')
  const [band, setBand] = useState('all')
  const [market, setMarket] = useState('all')
  const [login, setLogin] = useState('all')
  const [source, setSource] = useState('all')
  const [sort, setSort] = useState<SurveySortKey>('pct')
  const [page, setPage] = useState(1)

  const [markets, setMarkets] = useState<MarketOption[]>([])
  const [data, setData] = useState<SurveysResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t) }, [search])
  useEffect(() => { setPage(1) }, [debounced, status, band, market, login, source, sort])
  useEffect(() => {
    fetch('/api/admin/markets', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { markets: [] }))
      .then((j) => setMarkets((j.markets ?? []).filter((m: MarketOption) => m.is_live)))
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const qs = new URLSearchParams({
        search: debounced, status, band, market, login, source, sort,
        dir: sort === 'name' ? 'asc' : 'desc', page: String(page), pageSize: String(PAGE_SIZE),
      })
      const res = await fetch(`/api/admin/surveys?${qs}`, { cache: 'no-store' })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Request failed (${res.status})`) }
      setData(await res.json())
    } catch (e: any) { setError(e?.message || 'Failed to load surveys') } finally { setLoading(false) }
  }, [debounced, status, band, market, login, source, sort, page])

  useEffect(() => { load() }, [load])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const s = data?.summary

  return (
    <div className="space-y-6">
      {/* Header + funnel counts */}
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-haevn-navy">Surveys</h1>
            <p className="mt-0.5 text-sm text-gray-500">Survey funnel — who&apos;s stuck, and where</p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex h-9 w-fit items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {s && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-xs text-gray-500">
            <Stat label="complete" value={s.complete} />
            <Stat label="in progress" value={s.inProgress} />
            <Stat label="never started" value={s.neverStarted} />
            {s.medianPctInProgress != null && <Stat label="median in-progress %" value={s.medianPctInProgress} />}
            {data && <span className="ml-auto text-gray-400">{data.total.toLocaleString()} in view</span>}
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, or member ID…"
            className="h-9 w-full rounded-md border pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-haevn-teal/40" />
        </div>
        <Filter value={status} onChange={setStatus} width={140} options={[['all', 'All statuses'], ['complete', 'Complete'], ['in_progress', 'In progress'], ['not_started', 'Not started']]} />
        <Filter value={band} onChange={setBand} width={140} options={[['all', 'Any progress'], ['lt25', 'Under 25%'], ['mid', '25–75%'], ['gt75', 'Over 75%']]} />
        <Filter value={login} onChange={setLogin} width={140} options={[['all', 'All logins'], ['ever', 'Logged in'], ['never', 'Never logged in']]} />
        <Filter value={source} onChange={setSource} width={130} options={[['all', 'All sources'], ['webhook', 'Webhook'], ['import', 'Import']]} />
        <Filter value={market} onChange={setMarket} width={170} options={[['all', 'All markets'], ...markets.map((m) => [m.market_name, m.market_name] as [string, string]), ['unresolved', 'Unresolved']]} />
        <Filter value={sort} onChange={(v) => setSort(v as SurveySortKey)} width={150} options={[['pct', 'Sort: Completion'], ['created', 'Sort: Newest'], ['last_sign_in', 'Sort: Last sign-in'], ['name', 'Sort: Name']]} />
      </div>

      {loading && !data && <div className="flex justify-center py-20"><HaevnLoader /></div>}
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-haevn-error/30 bg-haevn-error/5 px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-haevn-error"><AlertCircle className="h-4 w-4" />{error}</div>
          <button onClick={load} className="rounded-md border border-haevn-error/40 px-3 py-1.5 text-xs font-medium text-haevn-error hover:bg-haevn-error/10">Retry</button>
        </div>
      )}

      {data && (
        <div className="rounded-xl border bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Member</TableHead>
                  <TableHead className="text-xs">City / market</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Completion</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs">Source</TableHead>
                  <TableHead className="text-xs">Logged in</TableHead>
                  <TableHead className="text-xs"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-sm text-gray-400">No members match these filters.</TableCell></TableRow>
                )}
                {data.rows.map((r) => (
                  <TableRow key={r.userId} className="text-xs">
                    <TableCell className="max-w-[200px]">
                      <div className="truncate font-medium text-gray-800">{r.name}</div>
                      <div className="truncate text-[10px] text-gray-400">{r.email}</div>
                    </TableCell>
                    <TableCell className="max-w-[170px]">
                      <div className="truncate text-gray-700">{r.market ?? 'Unresolved'}</div>
                      <div className="truncate text-[10px] text-gray-400">{r.city ?? '—'}</div>
                    </TableCell>
                    <TableCell><StatusChip status={r.status} /></TableCell>
                    <TableCell className="w-[130px]"><Progress status={r.status} pct={r.completionPct} /></TableCell>
                    <TableCell className="text-gray-600">{fmtDate(r.createdAt)}</TableCell>
                    <TableCell>{r.source ? <span className="text-[11px] capitalize text-gray-500">{r.source}</span> : <span className="text-gray-300">—</span>}</TableCell>
                    <TableCell>{r.lastSignInAt ? <Check className="h-3.5 w-3.5 text-haevn-success" /> : <span className="text-gray-300">—</span>}</TableCell>
                    <TableCell>
                      <Link href="/admin/users" className="flex items-center gap-1 text-haevn-teal hover:underline" title="Open the Users directory">
                        Users <ExternalLink className="h-3 w-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-gray-500">
            <span>Page {data.page} of {totalPages} · {data.total.toLocaleString()} rows</span>
            <div className="flex gap-2">
              <button disabled={data.page <= 1} onClick={() => setPage((x) => Math.max(1, x - 1))} className="rounded-md border px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">Prev</button>
              <button disabled={data.page >= totalPages} onClick={() => setPage((x) => x + 1)} className="rounded-md border px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <span><span className="font-semibold tabular-nums text-gray-900">{value.toLocaleString()}</span> {label}</span>
}
function Filter({ value, onChange, options, width }: { value: string; onChange: (v: string) => void; options: [string, string][]; width: number }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-xs" style={{ width }}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  )
}
function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    complete: 'bg-haevn-success/15 text-haevn-success',
    in_progress: 'bg-haevn-orange/15 text-haevn-orange',
    not_started: 'bg-gray-100 text-gray-400',
  }
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[status]}`}>{status.replace('_', ' ')}</span>
}
function Progress({ status, pct }: { status: string; pct: number | null }) {
  if (status === 'not_started' || pct == null) return <span className="text-[11px] text-gray-300">—</span>
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-haevn-teal" style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums text-[11px] text-gray-600">{clamped}%</span>
    </div>
  )
}
