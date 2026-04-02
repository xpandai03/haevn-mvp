'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2, Search, X, ChevronDown, ChevronRight, Users,
  CheckCircle2, AlertTriangle, XCircle, Zap, Code, Settings
} from 'lucide-react'
import { MatchingEngineOverview } from './MatchingEngineOverview'
import { ZipControl } from './ZipControl'

// ─── Types ──────────────────────────────────────────────────────

interface PairDiag {
  candidate: string
  score: number
  tier: string
  outcome: string
  reason?: string
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

export function MatchingDashboard({ userEmail }: MatchingDashboardProps) {
  const [recomputing, setRecomputing] = useState(false)
  const [recomputeResult, setRecomputeResult] = useState<RecomputeResult | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showZipModal, setShowZipModal] = useState(false)
  const { toast } = useToast()

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

  const selectedCard = cards.find((c) => c.partnershipId === selectedId) || null

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
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Recomputing...
            </>
          ) : (
            'Recompute All Matches'
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
        <div className="text-center py-16">
          <Loader2 className="h-10 w-10 mx-auto mb-4 animate-spin text-[#008080]" />
          <p className="text-gray-500">Evaluating all partnerships...</p>
          <p className="text-xs text-gray-400 mt-1">This may take a minute</p>
        </div>
      )}

      {/* ── User Card Grid ── */}
      {filteredCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCards.map((card) => (
            <UserCard
              key={card.partnershipId}
              card={card}
              isSelected={selectedId === card.partnershipId}
              onSelect={() =>
                setSelectedId(selectedId === card.partnershipId ? null : card.partnershipId)
              }
            />
          ))}
        </div>
      )}

      {/* No results from filter */}
      {recomputeResult && filteredCards.length === 0 && searchQuery && (
        <p className="text-center text-gray-400 py-8 text-sm">
          No users match "{searchQuery}"
        </p>
      )}

      {/* ── Detail Panel ── */}
      {selectedCard && <DetailPanel card={selectedCard} onClose={() => setSelectedId(null)} />}

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
              <CandidateRow key={i} diag={p} />
            ))}
          </Section>
        )}

        {/* ── Close Matches ── */}
        {close.length > 0 && (
          <Section title="Close Matches" count={close.length} color="amber">
            {close.map((p, i) => (
              <CandidateRow key={i} diag={p} />
            ))}
          </Section>
        )}

        {/* ── Blocked / Not Compatible ── */}
        {blocked.length > 0 && (
          <Section title="Not Compatible" count={blocked.length} color="gray" defaultCollapsed>
            {blocked.map((p, i) => (
              <CandidateRow key={i} diag={p} />
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

// ─── Candidate Row ──────────────────────────────────────────────

function CandidateRow({ diag }: { diag: PairDiag }) {
  const [expanded, setExpanded] = useState(false)
  const isMatched = diag.outcome === 'stored'
  const isBlocked = diag.outcome === 'constraint-failed'
  const label = humanizeOutcome(diag.outcome, diag.reason)

  const borderColor = isMatched
    ? 'border-green-200 bg-green-50/50'
    : isBlocked
    ? 'border-red-100 bg-red-50/30'
    : 'border-gray-200 bg-gray-50/30'

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
          <p className="text-xs text-gray-500 mt-2 mb-1">
            {label}
            {diag.reason && diag.outcome !== 'constraint-failed' && (
              <span className="text-gray-400 ml-1">— {diag.reason}</span>
            )}
          </p>
          {/* Tier info */}
          <p className="text-[10px] font-mono text-gray-400 mt-1">
            Score: {diag.score} | Tier: {diag.tier} | Outcome: {diag.outcome}
          </p>
        </div>
      )}
    </div>
  )
}
