'use client'

/**
 * /admin/founding-members — who activated the Founding Member promo, and whether
 * it moved them toward a conversation.
 *
 * Read-only. Every figure comes from /api/admin/founding-members, which is
 * allowlist-gated and issues no writes.
 *
 * The four percentages are the funnel: activated -> came back -> connected ->
 * messaged. They are deliberately not dressed up. 0% messaged is the current
 * truth and is rendered as 0%, because that zero is the most useful number on
 * the page.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Award, Gift, MessageCircle, RefreshCw, UserCheck, Users } from 'lucide-react'
import { HaevnLoader } from '@/components/ui/haevn-loader'
import type { FoundingRow, FoundingSummary } from '@/lib/admin/foundingMembers'

interface Response {
  rows: FoundingRow[]
  summary: FoundingSummary
  generatedAt: string
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

function Tile({
  label, value, sub, icon: Icon, accent = '#008080',
}: {
  label: string
  value: string
  sub?: string
  icon: typeof Users
  accent?: string
}) {
  return (
    <div className="rounded-xl border bg-white px-5 py-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: `${accent}1a` }}>
          <Icon size={15} style={{ color: accent }} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--haevn-muted-fg)]">{label}</span>
      </div>
      <p className="text-3xl font-bold leading-none text-[color:var(--haevn-navy)]">{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-[color:var(--haevn-muted-fg)]">{sub}</p>}
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--haevn-muted-fg)] ${className}`}>
      {children}
    </th>
  )
}

function Rows({ rows, comp }: { rows: FoundingRow[]; comp: boolean }) {
  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={11} className="px-3 py-6 text-center text-sm text-[color:var(--haevn-muted-fg)]">
          {comp ? 'No comped accounts.' : 'No founding activations yet.'}
        </td>
      </tr>
    )
  }
  return (
    <>
      {rows.map((r) => (
        <tr key={r.partnershipId} className="border-t hover:bg-black/[0.02]">
          <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-[color:var(--haevn-navy)]">
            {r.name ?? '—'}
            {comp && (
              <span className="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--haevn-muted-fg)]">
                Comp
              </span>
            )}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm">{r.city ?? '—'}</td>
          <td className="whitespace-nowrap px-3 py-2 text-sm">{r.promoMarket ?? '—'}</td>
          {/* '/dashboard/recommendations' on nearly every row costs ~140px and
              says nothing the suffix doesn't. The full value stays in the title. */}
          <td className="whitespace-nowrap px-3 py-2 text-[13px] text-[color:var(--haevn-muted-fg)]" title={r.ctaSource ?? undefined}>
            {r.ctaSource ? r.ctaSource.replace(/^\/dashboard\//, '').replace(/^\//, '') : '—'}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm">{fmtDate(r.activatedAt)}</td>
          <td className="whitespace-nowrap px-3 py-2 text-sm">{fmtDate(r.expiresAt)}</td>
          <td className="whitespace-nowrap px-3 py-2 text-sm">
            {r.expired ? (
              <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold uppercase text-red-600">Expired</span>
            ) : r.daysToExpiry === null ? (
              <span className="text-[color:var(--haevn-muted-fg)]">No term</span>
            ) : (
              <span className={r.daysToExpiry <= 30 ? 'font-semibold text-amber-600' : ''}>{r.daysToExpiry}d</span>
            )}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm">
            {r.signedInSinceActivation ? (
              <span className="font-semibold text-emerald-600">Yes</span>
            ) : (
              <span className="text-[color:var(--haevn-muted-fg)]">No</span>
            )}
            <span className="ml-2 text-[11px] text-[color:var(--haevn-muted-fg)]">{fmtDate(r.lastSignInAt)}</span>
          </td>
          <td className="px-2 py-2 text-center text-sm tabular-nums">{r.nudgesSent || <span className="text-[color:var(--haevn-muted-fg)]">0</span>}</td>
          <td className="px-2 py-2 text-center text-sm tabular-nums">{r.connectionsAccepted || <span className="text-[color:var(--haevn-muted-fg)]">0</span>}</td>
          <td className="px-2 py-2 text-center text-sm tabular-nums">{r.messagesSent || <span className="text-[color:var(--haevn-muted-fg)]">0</span>}</td>
        </tr>
      ))}
    </>
  )
}

export function FoundingMembersClient() {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/founding-members', { cache: 'no-store' })
      if (!res.ok) throw new Error(res.status === 401 ? 'Not authorized.' : `Request failed (${res.status})`)
      setData(await res.json())
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading && !data) return <div className="p-12"><HaevnLoader /></div>
  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle size={16} /> {error}
      </div>
    )
  }
  if (!data) return null

  const { summary, rows } = data
  const founding = rows.filter((r) => r.group === 'founding')
  const comps = rows.filter((r) => r.group === 'comp')
  const paid = rows.filter((r) => r.group === 'paid')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl text-[color:var(--haevn-navy)]">Founding Members</h1>
          <p className="mt-1 text-sm text-[color:var(--haevn-muted-fg)]">
            Who activated the promo, and whether it moved them toward a conversation.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-[color:var(--haevn-navy)] hover:bg-black/[0.03]"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* The funnel. Founding only — comps never move these. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Tile label="Activations" value={String(summary.total)} sub={`${summary.compCount} comped (not counted)`} icon={Award} />
        <Tile label="This week" value={String(summary.activatedThisWeek)} sub="last 7 days" icon={Gift} accent="#E4703A" />
        <Tile label="Signed in since" value={`${summary.pctSignedInSince}%`} sub={`${summary.signedInSinceCount} of ${summary.total} came back after activating`} icon={UserCheck} />
        <Tile label="Connected" value={`${summary.pctConnected}%`} sub={`${summary.connectedCount} with an accepted connection`} icon={Users} />
        <Tile label="Messaged" value={`${summary.pctMessaged}%`} sub={`${summary.messagedCount} have sent a message`} icon={MessageCircle} accent={summary.pctMessaged === 0 ? '#9C9C91' : '#008080'} />
        <Tile label="Next expiry" value={summary.nextExpiryAt ? fmtDate(summary.nextExpiryAt) : '—'} sub={summary.expiredCount > 0 ? `${summary.expiredCount} already expired` : 'none expired yet'} icon={AlertCircle} accent="#9C9C91" />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[920px]">
          <thead className="bg-black/[0.02]">
            <tr>
              <Th>Member</Th><Th>City</Th><Th>Market</Th><Th>CTA</Th>
              <Th>Activated</Th><Th>Expires</Th><Th>Days left</Th><Th>Back since</Th>
              <Th className="text-center">Nudges</Th><Th className="text-center">Conns</Th><Th className="text-center">Msgs</Th>
            </tr>
          </thead>
          <tbody>
            <Rows rows={founding} comp={false} />
            {(comps.length > 0 || paid.length > 0) && (
              <tr className="border-t bg-black/[0.03]">
                <td colSpan={11} className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--haevn-muted-fg)]">
                  Comped &amp; legacy — shown for completeness, excluded from every figure above
                </td>
              </tr>
            )}
            <Rows rows={[...comps, ...paid]} comp />
          </tbody>
        </table>
      </div>

      <p className="text-[12px] leading-relaxed text-[color:var(--haevn-muted-fg)]">
        Sources: sign-in from auth; nudges from ready-to-meet signals; connections from accepted
        handshakes; messages from sent messages. <strong>&ldquo;Opened a breakdown&rdquo; is not shown</strong> — the
        only candidate signal (a cached match interpretation) stopped meaning &ldquo;they looked&rdquo; once the
        warm cron began pre-generating them, so it would overstate engagement. It needs a real
        page-view event.{' '}
        <Link href="/admin/network-performance" className="underline">Network Performance</Link>
        {data.generatedAt ? ` · generated ${new Date(data.generatedAt).toLocaleTimeString()}` : ''}
      </p>
    </div>
  )
}
