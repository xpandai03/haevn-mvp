'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  Search, X, ChevronDown, ChevronRight, Users,
  CheckCircle2, AlertTriangle, XCircle, Zap, Code, Settings, Clock, Rocket
} from 'lucide-react'
import { HaevnLoader } from '@/components/ui/haevn-loader'
import { MatchingEngineOverview } from './MatchingEngineOverview'
import { ZipControl } from './ZipControl'

// ─── Types ──────────────────────────────────────────────────────

interface PairDiag {
  candidate: string
  candidateId?: string
  score: number
  tier: string
  outcome: string
  reason?: string
  breakdown?: any
}

interface RecomputeDetail {
  partnershipId: string
  displayName?: string | null
  success: boolean
  matchesComputed: number
  candidatesEvaluated?: number
  error?: string
  pairDiagnostics?: PairDiag[]
  upsertError?: string
  _debug?: any
}

interface RecomputeResult {
  total: number
  computed: number
  errors: number
  details: RecomputeDetail[]
}

// ─── Human-readable labels ──────────────────────────────────────

const CONSTRAINT_LABELS: Record<string, string> = {
  core_intent: 'Different relationship goals',
  mutual_interest: "Not open to each other's type",
  age_range: 'Outside preferred age range',
  distance: 'Too far apart',
  language: 'No shared language',
  couple_permissions: "Couple restrictions don't fit",
  race_preference: 'Outside stated preferences',
  hard_boundaries: 'Boundary conflict detected',
  boundaries: 'Boundary conflict detected',
  safer_sex: 'Safer sex practices too different',
  health: 'Health/testing practices conflict',
}

const OUTCOME_LABELS: Record<string, string> = {
  stored: 'Matched',
  'below-threshold': 'Not strong enough match',
  'constraint-failed': 'Not compatible',
  'no-survey': 'Survey not completed',
  'no-members': 'No members in partnership',
  handshake: 'Already connected',
  'scoring-error': 'Scoring error occurred',
}

function humanizeOutcome(outcome: string, reason?: string): string {
  if (outcome === 'constraint-failed' && reason) {
    // Extract gate name from reason like "core_intent: ..."
    const gateName = reason.split(':')[0]?.trim().toLowerCase()
    return CONSTRAINT_LABELS[gateName] || reason
  }
  return OUTCOME_LABELS[outcome] || outcome
}

// ─── Category bar colors ────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  intent: 'bg-blue-500',
  structure: 'bg-purple-500',
  connection: 'bg-pink-500',
  chemistry: 'bg-red-500',
  lifestyle: 'bg-green-500',
}

const CATEGORY_LABELS: Record<string, string> = {
  intent: 'Intent & Goals',
  structure: 'Structure Fit',
  connection: 'Connection Style',
  chemistry: 'Sexual Chemistry',
  lifestyle: 'Lifestyle Fit',
}

// ─── Data transformations ───────────────────────────────────────

interface UserCardData {
  partnershipId: string
  name: string
  matchCount: number
  closeCount: number
  blockedCount: number
  topCandidates: PairDiag[]
  detail: RecomputeDetail
}

function transformToCards(result: RecomputeResult): UserCardData[] {
  return result.details.map((d) => {
    const diags = d.pairDiagnostics || []
    const stored = diags.filter((p) => p.outcome === 'stored')
    const close = diags.filter(
      (p) => p.outcome !== 'stored' && p.outcome !== 'constraint-failed' && p.score >= 50
    )
    const blocked = diags.filter(
      (p) => p.outcome === 'constraint-failed' || (p.outcome !== 'stored' && p.score < 50)
    )

    // Top candidates: stored first, then by score desc, exclude 0%
    const viable = diags
      .filter((p) => p.score > 0)
      .sort((a, b) => {
        if (a.outcome === 'stored' && b.outcome !== 'stored') return -1
        if (b.outcome === 'stored' && a.outcome !== 'stored') return 1
        return b.score - a.score
      })

    return {
      partnershipId: d.partnershipId,
      name: d.displayName || d.partnershipId.slice(0, 8),
      matchCount: stored.length,
      closeCount: close.length,
      blockedCount: blocked.length,
      topCandidates: viable.slice(0, 3),
      detail: d,
    }
  })
}

function computeSummary(cards: UserCardData[], result: RecomputeResult) {
  const totalUsers = cards.length
  const withMatches = cards.filter((c) => c.matchCount > 0).length
  const withClose = cards.filter((c) => c.closeCount > 0 && c.matchCount === 0).length
  const noViable = totalUsers - withMatches - withClose

  // Best pair across all diagnostics
  let bestPair: { a: string; b: string; score: number } | null = null
  for (const card of cards) {
    for (const diag of card.detail.pairDiagnostics || []) {
      if (!bestPair || diag.score > bestPair.score) {
        bestPair = { a: card.name, b: diag.candidate, score: diag.score }
      }
    }
  }

  return { totalUsers, withMatches, withClose, noViable, bestPair, errors: result.errors }
}

// ─── Main Dashboard Component ───────────────────────────────────

interface MatchingDashboardProps {
  userEmail: string
}

interface NotificationEvent {
  at: string
  triggeredBy: string
  notification_type: 'match' | 'message'
  phone?: string | null
  email?: string | null
  sms_sent: boolean
  email_sent: boolean
  sms_error?: string | null
  email_error?: string | null
  partnership_id?: string | null
}

interface SystemStatus {
  lastComputation: { at: string; triggeredBy: string; computed?: number } | null
  lastRelease: { at: string; released?: number } | null
  lastSmsNotification: { at: string; sent?: number } | null
  nextRelease: string
  pendingMatches: number
  activeMatches: number
  expiredMatches: number
  recentNotifications: NotificationEvent[]
  systemState: string
}

export function MatchingDashboard({ userEmail }: MatchingDashboardProps) {
  const [recomputing, setRecomputing] = useState(false)
  const [recomputeResult, setRecomputeResult] = useState<RecomputeResult | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showZipModal, setShowZipModal] = useState(false)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [releasing, setReleasing] = useState(false)
  const [runningCycle, setRunningCycle] = useState(false)
  const { toast } = useToast()

  // Load system status on mount and after actions
  const loadSystemStatus = async () => {
    try {
      const res = await fetch('/api/admin/system-status')
      if (res.ok) setSystemStatus(await res.json())
    } catch {}
  }

  React.useEffect(() => { loadSystemStatus() }, [])

  // Transform data
  const cards = useMemo(
    () => (recomputeResult ? transformToCards(recomputeResult) : []),
    [recomputeResult]
  )
  const summary = useMemo(
    () => (recomputeResult ? computeSummary(cards, recomputeResult) : null),
    [cards, recomputeResult]
  )

  // Filter cards by search
  const filteredCards = useMemo(
    () =>
      searchQuery
        ? cards.filter((c) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : cards,
    [cards, searchQuery]
  )

  // ─── Handlers ───────────────────────────────────────────────

  const handleRecompute = async () => {
    setRecomputing(true)
    setRecomputeResult(null)
    setSelectedId(null)
    try {
      const response = await fetch('/api/admin/recompute-matches', { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setRecomputeResult(data.result)
        toast({
          title: 'Matches Recomputed',
          description: `${data.result.total} users evaluated, ${data.result.computed} matches found.`,
        })
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to recompute', variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setRecomputing(false)
      loadSystemStatus()
    }
  }

  const handleRunFullCycle = async () => {
    setRunningCycle(true)
    try {
      const res = await fetch('/api/admin/run-full-cycle', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast({
          title: 'Full Cycle Complete',
          description: `Computed: ${data.compute.computed}/${data.compute.total} | Released: ${data.release.released} | Notified: ${data.notify.sent} (${data.notify.skipped} skipped)`,
        })
      } else {
        toast({ title: 'Error', description: data.error || 'Full cycle failed', variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setRunningCycle(false)
      loadSystemStatus()
    }
  }

  const handleForceRelease = async () => {
    setReleasing(true)
    try {
      const res = await fetch('/api/admin/trigger-release', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Matches Released', description: `${data.released} pending matches released.` })
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setReleasing(false)
      loadSystemStatus()
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── System Status ── */}
      {systemStatus && (
        <div className="border rounded-xl bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-800">System Status</h3>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleForceRelease}
              disabled={releasing || systemStatus.pendingMatches === 0}
              className="gap-2 text-xs"
            >
              {releasing ? <HaevnLoader size={14} /> : <Rocket className="h-3 w-3" />}
              Force Release Now
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-gray-400 uppercase tracking-wide mb-0.5">Last Compute</p>
              <p className="text-gray-700 font-medium">
                {systemStatus.lastComputation
                  ? new Date(systemStatus.lastComputation.at).toLocaleString()
                  : 'Never'}
              </p>
              {systemStatus.lastComputation?.triggeredBy && (
                <p className="text-gray-400">{systemStatus.lastComputation.triggeredBy}</p>
              )}
            </div>
            <div>
              <p className="text-gray-400 uppercase tracking-wide mb-0.5">Last Release</p>
              <p className="text-gray-700 font-medium">
                {systemStatus.lastRelease
                  ? new Date(systemStatus.lastRelease.at).toLocaleString()
                  : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-gray-400 uppercase tracking-wide mb-0.5">Next Release</p>
              <p className="text-gray-700 font-medium">
                {new Date(systemStatus.nextRelease).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'short', day: 'numeric'
                })} — 8:00 AM ET
              </p>
              <p className="text-gray-400">
                {(() => {
                  const ms = new Date(systemStatus.nextRelease).getTime() - Date.now()
                  if (ms <= 0) return 'Now'
                  const h = Math.floor(ms / 3600000)
                  const d = Math.floor(h / 24)
                  const rh = h % 24
                  return d > 0 ? `in ${d}d ${rh}h` : `in ${rh}h`
                })()}
              </p>
            </div>
          </div>

          <div className="flex gap-4 mt-4 pt-3 border-t text-xs">
            <span className="text-amber-600 font-medium">
              {systemStatus.pendingMatches} pending
            </span>
            <span className="text-green-600 font-medium">
              {systemStatus.activeMatches} active
            </span>
            <span className="text-gray-400 font-medium">
              {systemStatus.expiredMatches} expired
            </span>
          </div>
        </div>
      )}

      {/* ── Recent Notifications ── */}
      {systemStatus && systemStatus.recentNotifications?.length > 0 && (
        <div className="border rounded-xl bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Recent Notifications</h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {systemStatus.recentNotifications.map((n, i) => {
              const smsFailed = !n.sms_sent && n.phone
              const emailFailed = !n.email_sent && n.email
              const allFailed = smsFailed && emailFailed
              const status = allFailed ? 'failed' : (smsFailed || emailFailed) ? 'partial' : 'sent'

              return (
                <div
                  key={i}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                    status === 'failed' ? 'bg-red-50 border border-red-200' :
                    status === 'partial' ? 'bg-amber-50 border border-amber-200' :
                    'bg-green-50 border border-green-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                      status === 'failed' ? 'bg-red-500' :
                      status === 'partial' ? 'bg-amber-500' :
                      'bg-green-500'
                    }`} />
                    <span className="font-medium text-gray-700 truncate">
                      {n.email || n.phone || 'Unknown'}
                    </span>
                    <span className="text-gray-400 capitalize">{n.notification_type}</span>
                    {n.sms_sent && <span className="text-green-600">SMS</span>}
                    {n.email_sent && <span className="text-green-600">Email</span>}
                    {smsFailed && <span className="text-red-500">SMS failed</span>}
                    {emailFailed && <span className="text-red-500">Email failed</span>}
                  </div>
                  <span className="text-gray-400 flex-shrink-0 ml-2">
                    {new Date(n.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Summary Bar ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={<Users className="h-5 w-5 text-slate-600" />}
            label="Users Evaluated"
            value={summary.totalUsers}
            bg="bg-white"
          />
          <SummaryCard
            icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
            label="With Matches"
            value={summary.withMatches}
            bg="bg-green-50"
          />
          <SummaryCard
            icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
            label="Close Matches Only"
            value={summary.withClose}
            bg="bg-amber-50"
          />
          <SummaryCard
            icon={<XCircle className="h-5 w-5 text-red-500" />}
            label="No Viable Matches"
            value={summary.noViable}
            bg="bg-red-50"
          />
        </div>
      )}

      {/* Best pair callout */}
      {summary?.bestPair && summary.bestPair.score > 0 && (
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <Zap className="h-5 w-5 text-teal-600 shrink-0" />
          <span className="text-sm text-teal-900">
            <strong>Best pair:</strong> {summary.bestPair.a} & {summary.bestPair.b} — {summary.bestPair.score}%
            {summary.bestPair.score >= 80 ? ' ✓ Matched' : ' (below 80% threshold)'}
          </span>
        </div>
      )}

      {/* ── Action Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleRecompute}
          disabled={recomputing}
          className="bg-[#008080] hover:bg-[#006868] text-white"
        >
          {recomputing ? (
            <>
              <HaevnLoader size={20} className="mr-2" />
              Recomputing...
            </>
          ) : (
            'Recompute All Matches'
          )}
        </Button>

        <Button
          onClick={handleRunFullCycle}
          disabled={runningCycle || recomputing}
          variant="outline"
          className="gap-2 border-teal-300 text-teal-700 hover:bg-teal-50"
        >
          {runningCycle ? (
            <>
              <HaevnLoader size={16} className="mr-1" />
              Running Cycle...
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4" />
              Run Full Cycle
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={() => setShowZipModal(!showZipModal)}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          ZIP Settings
        </Button>

        {cards.length > 0 && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name..."
              className="pl-9 pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ZIP Settings (collapsible) */}
      {showZipModal && (
        <div className="border rounded-xl bg-white p-4">
          <ZipControl />
        </div>
      )}

      {/* ── Empty State ── */}
      {!recomputeResult && !recomputing && (
        <div className="text-center py-16 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium text-gray-500">No data yet</p>
          <p className="text-sm mt-1">Click "Recompute All Matches" to evaluate all users</p>
        </div>
      )}

      {/* Loading state */}
      {recomputing && (
        <div className="text-center py-12">
          <HaevnLoader size={140} />
          <p className="text-gray-500 mt-2">Evaluating all partnerships...</p>
          <p className="text-xs text-gray-400 mt-1">This may take a minute</p>
        </div>
      )}

      {/* ── User Card Grid ── */}
      {filteredCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCards.map((card) => (
            <React.Fragment key={card.partnershipId}>
              <UserCard
                card={card}
                isSelected={selectedId === card.partnershipId}
                onSelect={() =>
                  setSelectedId(selectedId === card.partnershipId ? null : card.partnershipId)
                }
              />
              {selectedId === card.partnershipId && (
                <div className="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4">
                  <DetailPanel card={card} onClose={() => setSelectedId(null)} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* No results from filter */}
      {recomputeResult && filteredCards.length === 0 && searchQuery && (
        <p className="text-center text-gray-400 py-8 text-sm">
          No users match "{searchQuery}"
        </p>
      )}

      {/* ── Engine Documentation (preserved) ── */}
      <MatchingEngineOverview />
    </div>
  )
}

// ─── Summary Card ───────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode
  label: string
  value: number
  bg: string
}) {
  return (
    <div className={`${bg} border rounded-xl px-5 py-4 flex items-center gap-4`}>
      {icon}
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
    </div>
  )
}

// ─── User Card ──────────────────────────────────────────────────

function UserCard({
  card,
  isSelected,
  onSelect,
}: {
  card: UserCardData
  isSelected: boolean
  onSelect: () => void
}) {
  const hasMatches = card.matchCount > 0

  return (
    <button
      onClick={onSelect}
      className={`text-left w-full border rounded-xl p-5 transition-all hover:shadow-md ${
        isSelected
          ? 'ring-2 ring-[#008080] border-[#008080] bg-teal-50/30'
          : hasMatches
          ? 'bg-white border-green-200 hover:border-green-300'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Name */}
      <p className="font-semibold text-gray-900 text-base truncate">{card.name}</p>

      {/* Counts */}
      <div className="flex gap-3 mt-3 text-xs">
        <span className={`px-2 py-1 rounded-full font-medium ${
          card.matchCount > 0
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-500'
        }`}>
          {card.matchCount} match{card.matchCount !== 1 ? 'es' : ''}
        </span>
        {card.closeCount > 0 && (
          <span className="px-2 py-1 rounded-full font-medium bg-amber-100 text-amber-800">
            {card.closeCount} close
          </span>
        )}
        <span className="px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-500">
          {card.blockedCount} blocked
        </span>
      </div>

      {/* Top candidates */}
      {card.topCandidates.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
            Top candidates
          </p>
          {card.topCandidates.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 truncate mr-2">{c.candidate}</span>
              <span className={`font-semibold tabular-nums shrink-0 ${
                c.score >= 80 ? 'text-green-700' : c.score >= 50 ? 'text-amber-700' : 'text-gray-500'
              }`}>
                {c.score}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <p className="text-xs text-[#008080] font-medium mt-3">
        {isSelected ? 'Hide details ↑' : 'View details →'}
      </p>
    </button>
  )
}

// ─── Detail Panel ───────────────────────────────────────────────

function DetailPanel({ card, onClose }: { card: UserCardData; onClose: () => void }) {
  const [debugOpen, setDebugOpen] = useState(false)
  const diags = card.detail.pairDiagnostics || []

  // Group diagnostics
  const stored = diags.filter((p) => p.outcome === 'stored').sort((a, b) => b.score - a.score)
  const close = diags
    .filter((p) => p.outcome !== 'stored' && p.outcome !== 'constraint-failed' && p.score >= 50)
    .sort((a, b) => b.score - a.score)
  const blocked = diags
    .filter((p) => p.outcome === 'constraint-failed' || (p.outcome !== 'stored' && p.score < 50))
    .sort((a, b) => b.score - a.score)

  return (
    <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{card.name}'s Results</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {card.detail.candidatesEvaluated ?? diags.length} candidates evaluated
            {card.detail.error && (
              <span className="text-red-600 ml-2">• {card.detail.error}</span>
            )}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-6 py-4 space-y-5">
        {/* ── Matches ── */}
        {stored.length > 0 && (
          <Section title="Matches" count={stored.length} color="green">
            {stored.map((p, i) => (
              <CandidateRow key={i} diag={p} sourcePartnershipId={card.partnershipId} />
            ))}
          </Section>
        )}

        {/* ── Close Matches ── */}
        {close.length > 0 && (
          <Section title="Close Matches" count={close.length} color="amber">
            {close.map((p, i) => (
              <CandidateRow key={i} diag={p} sourcePartnershipId={card.partnershipId} />
            ))}
          </Section>
        )}

        {/* ── Blocked / Not Compatible ── */}
        {blocked.length > 0 && (
          <Section title="Not Compatible" count={blocked.length} color="gray" defaultCollapsed>
            {blocked.map((p, i) => (
              <CandidateRow key={i} diag={p} sourcePartnershipId={card.partnershipId} />
            ))}
          </Section>
        )}

        {/* Empty */}
        {diags.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="font-medium">No candidates evaluated</p>
            <p className="text-xs mt-1">{card.detail.error || 'Survey may not be completed'}</p>
          </div>
        )}

        {/* ── Debug (collapsed by default) ── */}
        <div className="border-t pt-4">
          <button
            onClick={() => setDebugOpen(!debugOpen)}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600"
          >
            {debugOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Code className="h-3 w-3" />
            Debug Data
          </button>
          {debugOpen && (
            <div className="mt-3 space-y-3">
              <div className="text-xs font-mono text-gray-500 space-y-0.5">
                <p>Partnership: {card.partnershipId}</p>
                <p>Candidates: {card.detail.candidatesEvaluated ?? 'N/A'}</p>
                <p>Stored: {card.detail.matchesComputed}</p>
                {card.detail.upsertError && (
                  <p className="text-red-600">Upsert error: {card.detail.upsertError}</p>
                )}
              </div>
              {card.detail._debug && (
                <pre className="p-3 bg-gray-900 text-gray-100 text-[10px] rounded-lg overflow-x-auto max-h-48">
                  {JSON.stringify(card.detail._debug, null, 2)}
                </pre>
              )}
              {/* Full pair diagnostics JSON */}
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-600">
                  Raw pair diagnostics ({diags.length} pairs)
                </summary>
                <pre className="mt-2 p-3 bg-gray-900 text-gray-100 text-[10px] rounded-lg overflow-x-auto max-h-48">
                  {JSON.stringify(diags, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Section (collapsible group in detail panel) ────────────────

function Section({
  title,
  count,
  color,
  defaultCollapsed = false,
  children,
}: {
  title: string
  count: number
  color: 'green' | 'amber' | 'gray'
  defaultCollapsed?: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const dotColor = color === 'green' ? 'bg-green-500' : color === 'amber' ? 'bg-amber-500' : 'bg-gray-400'
  const countBg =
    color === 'green' ? 'bg-green-100 text-green-800' :
    color === 'amber' ? 'bg-amber-100 text-amber-800' :
    'bg-gray-100 text-gray-600'

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${countBg}`}>
          {count}
        </span>
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-gray-400 ml-auto" />
        ) : (
          <ChevronDown className="h-3 w-3 text-gray-400 ml-auto" />
        )}
      </button>
      {!collapsed && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  )
}

// ─── Sub-score display labels ───────────────────────────────────

const SUB_SCORE_DISPLAY: Record<string, string> = {
  goals: 'Relationship Goals', style: 'Relationship Style', exclusivity: 'Exclusivity',
  attachment: 'Attachment & Availability', timing: 'Timing & Availability',
  privacy: 'Privacy & Discretion', haevnUse: 'Platform Goals',
  orientation: 'Orientation', status: 'Relationship Status', boundaries: 'Boundaries',
  saferSex: 'Safer Sex', roles: 'Roles', fidelity: 'Fidelity Philosophy',
  communication: 'Communication Style', emotional: 'Emotional Alignment',
  emotionalPace: 'Emotional Pace', emotionalEngagement: 'Emotional Engagement',
  eroticProfile: 'Erotic Profile', rolesKinks: 'Roles & Kinks',
  frequency: 'Desired Frequency', physicalPreferences: 'Physical Preferences',
  exploration: 'Exploration & Variety', distance: 'Distance & Mobility',
  socialEnergy: 'Social Energy', substances: 'Substance Use', languages: 'Languages',
  independenceBalance: 'Independence Balance', lifestyleImportance: 'Lifestyle Priority',
  cultural: 'Cultural & Worldview', children: 'Children', dietary: 'Dietary Needs', pets: 'Pets',
}

// ─── Candidate Row ──────────────────────────────────────────────

function CandidateRow({ diag, sourcePartnershipId }: { diag: PairDiag; sourcePartnershipId?: string }) {
  const [expanded, setExpanded] = useState(false)
  const isMatched = diag.outcome === 'stored'
  const isBlocked = diag.outcome === 'constraint-failed'
  const label = humanizeOutcome(diag.outcome, diag.reason)

  const borderColor = isMatched
    ? 'border-green-200 bg-green-50/50'
    : isBlocked
    ? 'border-red-100 bg-red-50/30'
    : 'border-gray-200 bg-gray-50/30'

  const categories: any[] = diag.breakdown || []

  return (
    <div className={`border rounded-lg overflow-hidden ${borderColor}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-gray-900 truncate flex-1">
          {diag.candidate}
        </span>
        <span className={`text-lg font-bold tabular-nums shrink-0 ${
          diag.score >= 80 ? 'text-green-700' :
          diag.score >= 50 ? 'text-amber-700' :
          'text-gray-400'
        }`}>
          {diag.score}%
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
          isMatched ? 'bg-green-200 text-green-900' :
          isBlocked ? 'bg-red-100 text-red-700' :
          'bg-gray-200 text-gray-600'
        }`}>
          {isMatched ? 'Matched' : isBlocked ? 'Blocked' : `${diag.tier}`}
        </span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-0 border-t border-gray-100">
          <p className="text-xs text-gray-500 mt-2 mb-2">
            {label}
            {diag.reason && diag.outcome !== 'constraint-failed' && (
              <span className="text-gray-400 ml-1">— {diag.reason}</span>
            )}
          </p>

          {/* Category + Sub-score breakdown */}
          {categories.length > 0 ? (
            <div className="space-y-3 mt-3">
              {categories.map((cat: any) => {
                const catLabel = CATEGORY_LABELS[cat.category] || cat.category
                const catColor = CATEGORY_COLORS[cat.category] || 'bg-gray-500'
                const catScore = Math.round(cat.score || 0)
                const subs: any[] = cat.subScores || []

                return (
                  <div key={cat.category}>
                    {/* Category header bar */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-2 h-2 rounded-full ${catColor}`} />
                      <span className="text-xs font-semibold text-gray-700">{catLabel}</span>
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${catColor}`} style={{ width: `${catScore}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-600 tabular-nums w-8 text-right">{catScore}%</span>
                    </div>

                    {/* Sub-scores */}
                    {subs.length > 0 && (
                      <div className="ml-4 space-y-1">
                        {subs.map((sub: any) => {
                          const subScore = Math.round(sub.score || 0)
                          const quality = !sub.matched ? 'none' : subScore >= 90 ? 'high' : subScore >= 60 ? 'mid' : 'low'

                          return (
                            <div key={sub.key} className="flex items-center gap-2 text-[11px]">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                quality === 'high' ? 'bg-emerald-500' :
                                quality === 'mid' ? 'bg-amber-500' :
                                quality === 'low' ? 'bg-red-400' : 'bg-gray-300'
                              }`} />
                              <span className="text-gray-600 truncate flex-1">{SUB_SCORE_DISPLAY[sub.key] || sub.key}</span>
                              <span className={`font-medium tabular-nums w-7 text-right ${
                                quality === 'high' ? 'text-emerald-700' :
                                quality === 'mid' ? 'text-amber-700' :
                                quality === 'low' ? 'text-red-600' : 'text-gray-400'
                              }`}>
                                {sub.matched ? `${subScore}%` : '—'}
                              </span>
                              {sub.reason && (
                                <span className="text-gray-400 truncate max-w-[160px]" title={sub.reason}>
                                  {sub.reason}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-[10px] font-mono text-gray-400 mt-1">
              Score: {diag.score} | Tier: {diag.tier} | Outcome: {diag.outcome}
            </p>
          )}

          {/* Deep Inspection link — only for persisted matches (outcome=stored) */}
          {sourcePartnershipId && diag.candidateId && diag.outcome === 'stored' && (
            <a
              href={`/admin/match-inspection?a=${sourcePartnershipId}&b=${diag.candidateId}`}
              className="inline-block mt-2 text-xs text-[#008080] font-medium hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Inspect match →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
