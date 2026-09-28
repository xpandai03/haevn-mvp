'use client'

/**
 * /admin/network-performance/matches and /recommendations — the rows behind the
 * weekly Matches Generated / Recommendations Generated cards.
 *
 * Read-only. Every figure comes from /api/admin/weekly-pairs, which is
 * allowlist-gated and issues no writes. Same conventions as Founding Members:
 * short names, city, newest first.
 *
 * The count at the top is the CARD'S number. If the list cannot name every row
 * behind it (a past week whose rows were erased by account deletions, or a week
 * with no stored snapshot), the page says so in plain words — the card and its
 * list never silently disagree.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { HaevnLoader } from '@/components/ui/haevn-loader'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { currentReportingWeek, formatReportingWeek, recentWeeks } from '@/lib/metrics/reportingWeek'
import { PAIR_PAGE_SIZE, type Channel, type PairBand, type PairRow, type Reconcile } from '@/lib/admin/weeklyPairs'

interface Response {
  band: PairBand
  week: { weekEnding: string; label: string; isCurrent: boolean }
  scopeLabel: string | null
  source: 'computed_matches' | 'match_history'
  total: number
  pairs: number
  reconcile: Reconcile
  page: number
  pages: number
  rows: PairRow[]
  generatedAt: string
}

const COPY: Record<PairBand, { title: string; noun: string; other: string; band: string; empty: string }> = {
  match: {
    title: 'Matches Generated',
    noun: 'matches',
    other: 'Matched with',
    band: 'Score 80+',
    empty: 'No matches were generated in this reporting week.',
  },
  rec: {
    title: 'Recommendations Generated',
    noun: 'recommendations',
    other: 'Recommended',
    band: 'Score 77–79',
    empty: 'No recommendations were generated in this reporting week.',
  },
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—'

const CHANNEL_LABEL: Record<Channel, string> = {
  'sms+email': 'SMS + email',
  sms: 'SMS',
  email: 'Email',
  unrecorded: 'Channel not recorded',
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--haevn-muted-fg)] ${className}`}>
      {children}
    </th>
  )
}

/** The one place the card-vs-list relationship is put into words. */
function ReconcileNote({ r, noun }: { r: Reconcile; noun: string }) {
  if (r.kind === 'exact') return null
  const text =
    r.kind === 'no_card'
      ? `The dashboard card has no figure for this week — no weekly snapshot was stored. These ${r.listed.toLocaleString()} ${noun} come from the match history captured at that week's release.`
      : r.kind === 'removed'
        ? `The card counted ${r.card.toLocaleString()}; ${r.listed.toLocaleString()} can be listed. The other ${r.gap.toLocaleString()} involved members who have since deleted their accounts — deleting an account erases its match history, so those rows cannot be shown.`
        : `The card counted ${r.card.toLocaleString()} but ${r.listed.toLocaleString()} rows were found. This should not happen — please report it.`
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-snug text-amber-900">
      <AlertCircle size={15} className="mt-0.5 shrink-0" /> <span>{text}</span>
    </div>
  )
}

export function WeeklyPairsClient({ band }: { band: PairBand }) {
  const router = useRouter()
  const search = useSearchParams()
  const week = search.get('week') ?? currentReportingWeek().weekEnding
  const scope = search.get('scope')
  const page = Number(search.get('page') ?? '1') || 1
  const copy = COPY[band]

  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const weekOptions = useMemo(
    () => recentWeeks(8).map((w) => ({ value: w.weekEnding, label: formatReportingWeek(w) })),
    []
  )

  const hrefFor = useCallback(
    (next: { week?: string; page?: number }) => {
      const q = new URLSearchParams({ week: next.week ?? week })
      if (scope) q.set('scope', scope)
      if (next.page && next.page > 1) q.set('page', String(next.page))
      return `?${q.toString()}`
    },
    [week, scope]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ band, week, page: String(page) })
      if (scope) q.set('scope', scope)
      const res = await fetch(`/api/admin/weekly-pairs?${q.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(res.status === 401 ? 'Not authorized.' : `Request failed (${res.status})`)
      setData(await res.json())
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [band, week, page, scope])

  useEffect(() => { load() }, [load])

  const backHref = `/admin/network-performance`
  const headerCount = data ? (data.reconcile.card ?? data.total) : null
  const cols = 8

  return (
    <div className="space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-[color:var(--haevn-muted-fg)] hover:underline">
        <ArrowLeft size={14} /> Network Performance
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl text-[color:var(--haevn-navy)]">{copy.title}</h1>
          <p className="mt-1 text-sm text-[color:var(--haevn-muted-fg)]">
            Reporting week {data?.week.label ?? '…'} (UTC, Sunday–Saturday)
            {data?.week.isCurrent ? ' · current' : ''}
            {data?.scopeLabel && data.scopeLabel !== 'Network' ? ` · ${data.scopeLabel}` : ''} · {copy.band}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={week} onValueChange={(w) => router.push(hrefFor({ week: w }))}>
            <SelectTrigger className="w-[210px]"><SelectValue placeholder="Reporting week" /></SelectTrigger>
            <SelectContent>
              {weekOptions.map((w, i) => (
                <SelectItem key={w.value} value={w.value}>{w.label}{i === 0 ? ' (current)' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-[color:var(--haevn-navy)] hover:bg-black/[0.03]"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {loading && !data && <div className="p-12"><HaevnLoader /></div>}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {data && !error && (
        <>
          <div className="rounded-xl border bg-white px-5 py-4">
            <p className="text-3xl font-bold leading-none text-[color:var(--haevn-navy)]" data-testid="drill-count">
              {headerCount?.toLocaleString()}
            </p>
            <p className="mt-1.5 text-[13px] text-[color:var(--haevn-muted-fg)]">
              {copy.noun} ={' '}
              <strong className="text-[color:var(--haevn-navy)]">{data.pairs.toLocaleString()} unique pairs</strong>
              {' '}— every pair counts once for each side, exactly as the dashboard card does.
            </p>
          </div>

          <ReconcileNote r={data.reconcile} noun={copy.noun} />

          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[880px]">
              <thead className="bg-black/[0.02]">
                <tr>
                  <Th>Member</Th><Th>City</Th><Th>{copy.other}</Th><Th>City</Th>
                  <Th className="text-center">Score</Th>
                  {band === 'rec' ? <Th>Band</Th> : <Th>Notified</Th>}
                  <Th>Released</Th><Th>Generated</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={cols} className="px-3 py-6 text-center text-sm text-[color:var(--haevn-muted-fg)]">
                      {copy.empty}
                    </td>
                  </tr>
                ) : (
                  data.rows.map((r) => (
                    <tr key={r.key} className="border-t hover:bg-black/[0.02]">
                      <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-[color:var(--haevn-navy)]">{r.memberName ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm">{r.memberCity ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-[color:var(--haevn-navy)]">{r.matchName ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm">{r.matchCity ?? '—'}</td>
                      <td className="px-3 py-2 text-center text-sm font-semibold tabular-nums">{r.score ?? '—'}</td>
                      {band === 'rec' ? (
                        <td className="whitespace-nowrap px-3 py-2 text-[13px] text-[color:var(--haevn-muted-fg)]">Recommendation (77–79)</td>
                      ) : (
                        <td className="whitespace-nowrap px-3 py-2 text-sm">
                          {r.notified === true ? (
                            <span className="font-semibold text-emerald-600">{CHANNEL_LABEL[r.channel ?? 'unrecorded']}</span>
                          ) : r.notified === false ? (
                            <span className="text-[color:var(--haevn-muted-fg)]">Not yet</span>
                          ) : (
                            <span className="text-[color:var(--haevn-muted-fg)]" title="Past weeks keep no per-member notification stamp; no notification event was recorded for this member.">Not recorded</span>
                          )}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2 text-sm">
                        {r.released ? fmtDate(r.releasedAt) : (
                          <span className="text-amber-600">Scheduled {fmtDate(r.releasedAt)}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm">{fmtDate(r.computedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-[color:var(--haevn-muted-fg)]">
              <span>
                Rows {((data.page - 1) * PAIR_PAGE_SIZE + 1).toLocaleString()}–{Math.min(data.page * PAIR_PAGE_SIZE, data.total).toLocaleString()} of{' '}
                {data.total.toLocaleString()} · page {data.page} of {data.pages}
              </span>
              <div className="flex gap-2">
                <Link
                  aria-disabled={data.page <= 1}
                  href={hrefFor({ page: data.page - 1 })}
                  className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 ${data.page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-black/[0.03]'}`}
                >
                  <ChevronLeft size={14} /> Previous
                </Link>
                <Link
                  aria-disabled={data.page >= data.pages}
                  href={hrefFor({ page: data.page + 1 })}
                  className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 ${data.page >= data.pages ? 'pointer-events-none opacity-40' : 'hover:bg-black/[0.03]'}`}
                >
                  Next <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          )}

          <p className="text-[12px] leading-relaxed text-[color:var(--haevn-muted-fg)]">
            Source:{' '}
            {data.source === 'computed_matches'
              ? 'the live match table — the same rows, and the same filter, the card counts.'
              : 'the match history captured at each weekly release. The live match table is rewritten every Monday, so a past week can only be read from that capture.'}{' '}
            Names are first name and last initial.
            {data.generatedAt ? ` · generated ${new Date(data.generatedAt).toLocaleTimeString()}` : ''}
          </p>
        </>
      )}
    </div>
  )
}
