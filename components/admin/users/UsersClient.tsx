'use client'

/**
 * /admin/users — member directory (card grid) + audited impersonation side-door.
 * Read-only except impersonation. All search/filter/sort/pagination server-side
 * in /api/admin/users. Impersonation POSTs /api/admin/impersonate (allowlist +
 * audit-first); the returned link is shown once, copied by the admin, and opened
 * in a separate browser profile — never auto-navigated.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, Check, Copy, KeyRound, RefreshCw, Search, ShieldAlert, X,
} from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { HaevnLoader } from '@/components/ui/haevn-loader'
import type { UserCard, UsersSummary, UserSortKey } from '@/lib/admin/userCards'
import type { MarketOption } from '@/components/admin/network/types'

interface UsersResponse {
  rows: UserCard[]
  total: number
  page: number
  pageSize: number
  summary: UsersSummary
  generatedAt: string
}

const PAGE_SIZE = 48
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export function UsersClient() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [survey, setSurvey] = useState('all')
  const [login, setLogin] = useState('all')
  const [tier, setTier] = useState('all')
  const [market, setMarket] = useState('all')
  const [photo, setPhoto] = useState('all')
  const [sort, setSort] = useState<UserSortKey>('name')
  const [page, setPage] = useState(1)

  const [markets, setMarkets] = useState<MarketOption[]>([])
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<UserCard | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => { setPage(1) }, [debounced, survey, login, tier, market, photo, sort])

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
        search: debounced, survey, login, tier, market, photo, sort, dir: sort === 'name' ? 'asc' : 'desc',
        page: String(page), pageSize: String(PAGE_SIZE),
      })
      const res = await fetch(`/api/admin/users?${qs}`, { cache: 'no-store' })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Request failed (${res.status})`) }
      setData(await res.json())
    } catch (e: any) { setError(e?.message || 'Failed to load users') } finally { setLoading(false) }
  }, [debounced, survey, login, tier, market, photo, sort, page])

  useEffect(() => { load() }, [load])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const s = data?.summary

  return (
    <div className="space-y-6">
      {/* Header + data-quality counts */}
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-haevn-navy">Users</h1>
            <p className="mt-0.5 text-sm text-gray-500">Member directory</p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex h-9 w-fit items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {s && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-xs text-gray-500">
            <Stat label="members" value={s.total.toLocaleString()} />
            <Stat label="with photos" value={`${pct(s.withPhoto, s.total)}%`} sub={`${s.withPhoto}`} />
            <Stat label="completed survey" value={`${pct(s.completedSurvey, s.total)}%`} sub={`${s.completedSurvey}`} />
            <Stat label="ever logged in" value={`${pct(s.loggedInEver, s.total)}%`} sub={`${s.loggedInEver}`} />
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
        <Filter value={survey} onChange={setSurvey} width={140} options={[['all', 'All surveys'], ['complete', 'Complete'], ['in_progress', 'In progress'], ['not_started', 'Not started']]} />
        <Filter value={login} onChange={setLogin} width={130} options={[['all', 'All logins'], ['ever', 'Logged in'], ['never', 'Never logged in']]} />
        <Filter value={tier} onChange={setTier} width={110} options={[['all', 'All tiers'], ['free', 'Free'], ['pro', 'Pro']]} />
        <Filter value={photo} onChange={setPhoto} width={120} options={[['all', 'All photos'], ['has', 'Has photo'], ['none', 'No photo']]} />
        <Filter value={market} onChange={setMarket} width={180} options={[['all', 'All markets'], ...markets.map((m) => [m.market_name, m.market_name] as [string, string]), ['unresolved', 'Unresolved']]} />
        <Filter value={sort} onChange={(v) => setSort(v as UserSortKey)} width={150} options={[['name', 'Sort: Name'], ['member_since', 'Sort: Newest'], ['last_sign_in', 'Sort: Last sign-in']]} />
      </div>

      {loading && !data && <div className="flex justify-center py-20"><HaevnLoader /></div>}
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-haevn-error/30 bg-haevn-error/5 px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-haevn-error"><AlertCircle className="h-4 w-4" />{error}</div>
          <button onClick={load} className="rounded-md border border-haevn-error/40 px-3 py-1.5 text-xs font-medium text-haevn-error hover:bg-haevn-error/10">Retry</button>
        </div>
      )}

      {data && (
        <>
          {data.rows.length === 0 ? (
            <div className="rounded-xl border bg-white px-5 py-12 text-center text-sm text-gray-400">No members match these filters.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.rows.map((u) => <MemberCard key={u.userId} user={u} onClick={() => setSelected(u)} />)}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Page {data.page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={data.page <= 1} onClick={() => setPage((x) => Math.max(1, x - 1))} className="rounded-md border px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">Prev</button>
              <button disabled={data.page >= totalPages} onClick={() => setPage((x) => x + 1)} className="rounded-md border px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        </>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected && <DetailPanel user={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <span><span className="font-semibold tabular-nums text-gray-900">{value}</span> {label}{sub && <span className="text-gray-400"> ({sub})</span>}</span>
}

function Filter({ value, onChange, options, width }: { value: string; onChange: (v: string) => void; options: [string, string][]; width: number }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-xs" style={{ width }}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  )
}

function Avatar({ user, size = 40 }: { user: UserCard; size?: number }) {
  const [failed, setFailed] = useState(false)
  const show = user.photoUrl && !failed
  return show ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.photoUrl!} alt="" onError={() => setFailed(true)}
      className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-haevn-teal/10 font-semibold text-haevn-teal"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>{user.initials}</span>
  )
}

function MemberCard({ user, onClick }: { user: UserCard; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col rounded-xl border bg-white p-4 text-left transition hover:border-haevn-teal/40 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar user={user} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-800">{user.name}</p>
          <p className="truncate text-xs text-gray-400">{user.email}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <TierChip tier={user.tier} />
        <SurveyChip status={user.surveyStatus} />
        {user.lastSignInAt == null && <Chip className="bg-gray-100 text-gray-500">Never logged in</Chip>}
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-2 text-[11px] text-gray-400">
        <span className="truncate">{user.city ?? user.market ?? '—'}</span>
        <span>Since {fmtDate(user.memberSince)}</span>
      </div>
      {user.partnerName && <p className="mt-1 truncate text-[11px] text-gray-400">Partner: {user.partnerName}</p>}
    </button>
  )
}

function DetailPanel({ user }: { user: UserCard }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="sr-only">Member detail</SheetTitle>
        <div className="flex items-center gap-3 text-left">
          <Avatar user={user} size={56} />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-haevn-navy">{user.name}</p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
      </SheetHeader>

      <div className="mt-5 space-y-4 text-sm">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Member ID" value={user.userId.slice(0, 8) + '…'} mono />
          <Field label="Member since" value={fmtDate(user.memberSince)} />
          <Field label="City" value={user.city ?? '—'} />
          <Field label="Market" value={user.market ?? 'Unresolved'} />
          <Field label="Tier" value={user.tier ?? '—'} />
          <Field label="Survey" value={`${user.surveyStatus.replace('_', ' ')}${user.completionPct != null ? ` (${user.completionPct}%)` : ''}`} />
          <Field label="Last sign-in" value={user.lastSignInAt ? fmtDate(user.lastSignInAt) : 'Never'} />
          <Field label="Partner" value={user.partnerName ?? '—'} />
        </dl>

        <div className="rounded-lg border bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Re-notification history: none recorded yet.
        </div>

        <ImpersonatePanel user={user} />
      </div>
    </>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className={`mt-0.5 text-gray-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}

function ImpersonatePanel({ user }: { user: UserCard }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: user.userId, reason }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`)
      setLink(body.url)
    } catch (e: any) { setErr(e?.message || 'Failed to generate link') } finally { setBusy(false) }
  }

  const copy = () => { if (link) { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) } }

  return (
    <div className="rounded-lg border-2 border-dashed border-haevn-orange/50 bg-haevn-orange/5 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-haevn-orange">
        <ShieldAlert className="h-3.5 w-3.5" /> Impersonation — audited
      </div>

      {!open && !link && (
        <button onClick={() => setOpen(true)} className="mt-2 flex items-center gap-1.5 rounded-md bg-haevn-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-haevn-navy/90">
          <KeyRound className="h-3.5 w-3.5" /> Sign in as this user
        </button>
      )}

      {open && !link && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] leading-snug text-amber-800/90">
            This generates a real sign-in link for <strong>{user.name}</strong> and is <strong>logged</strong> (who, whom, when, why).
            Open it in an <strong>incognito / separate browser profile</strong> — using it in this window will sign you out.
          </p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
            placeholder="Reason (required) — e.g. trust/safety: messaging report"
            className="w-full rounded-md border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-haevn-orange/40" />
          <div className="flex gap-2">
            <button onClick={generate} disabled={busy || !reason.trim()}
              className="rounded-md bg-haevn-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">
              {busy ? 'Generating…' : 'Generate sign-in link'}
            </button>
            <button onClick={() => { setOpen(false); setReason('') }} className="rounded-md border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
          {err && <p className="text-[11px] text-haevn-error">{err}</p>}
        </div>
      )}

      {link && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] font-medium text-amber-800">Link generated & logged. Open it in a <strong>Chrome guest profile</strong> — it lands on a confirmation page and uses nothing until you press the button there. Good for 15 minutes, once.</p>
          <div className="flex items-center gap-1.5">
            <input readOnly value={link} className="min-w-0 flex-1 rounded-md border bg-white px-2 py-1.5 font-mono text-[10px] text-gray-600" />
            <button onClick={copy} className="flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
              {copied ? <Check className="h-3.5 w-3.5 text-haevn-success" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button onClick={() => { setLink(null); setOpen(false); setReason('') }} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /> Done</button>
        </div>
      )}
    </div>
  )
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}>{children}</span>
}
function TierChip({ tier }: { tier: string | null }) {
  if (!tier) return null
  const isPro = tier === 'pro'
  return <Chip className={isPro ? 'bg-haevn-teal/10 text-haevn-teal' : 'bg-gray-100 text-gray-500'}>{tier}</Chip>
}
function SurveyChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    complete: 'bg-haevn-success/15 text-haevn-success',
    in_progress: 'bg-haevn-orange/15 text-haevn-orange',
    not_started: 'bg-gray-100 text-gray-400',
  }
  return <Chip className={map[status]}>{status.replace('_', ' ')}</Chip>
}
