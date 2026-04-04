'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { QUESTION_MAP, CATEGORY_META, getQuestionsByCategory } from '@/lib/admin/questionMap'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubScore {
  key: string
  score: number
  weight: number
  matched: boolean
  reason?: string
}

interface CategoryScore {
  category: string
  score: number
  weight: number
  subScores: SubScore[]
  coverage: number
  included: boolean
}

interface UserData {
  partnershipId: string
  displayName: string
  answers: Record<string, any>
  latitude: number | null
  longitude: number | null
}

interface InspectionPayload {
  match: {
    score: number
    tier: string
    engineVersion: string
    computedAt: string
    categories: CategoryScore[]
  }
  userA: UserData
  userB: UserData
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-700 bg-emerald-50'
  if (score >= 60) return 'text-amber-700 bg-amber-50'
  return 'text-red-700 bg-red-50'
}

function scoreBorderColor(score: number): string {
  if (score >= 80) return 'border-emerald-300'
  if (score >= 60) return 'border-amber-300'
  return 'border-red-300'
}

function tierBadgeVariant(tier: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (tier) {
    case 'Platinum': return 'default'
    case 'Gold': return 'secondary'
    case 'Silver': return 'outline'
    default: return 'destructive'
  }
}

function formatAnswer(val: any): string {
  if (val === undefined || val === null) return '—'
  if (Array.isArray(val)) return val.join(', ')
  return String(val)
}

/** Visual diff: compare two answers and return a color class. */
function diffColor(a: any, b: any, type: string): string {
  if (a === undefined || a === null || b === undefined || b === null) return 'bg-gray-50 text-gray-400'

  if (type === 'multi_select') {
    const arrA = Array.isArray(a) ? a.map(String) : [String(a)]
    const arrB = Array.isArray(b) ? b.map(String) : [String(b)]
    const setA = new Set(arrA.map(s => s.toLowerCase()))
    const setB = new Set(arrB.map(s => s.toLowerCase()))
    const overlap = [...setA].filter(x => setB.has(x)).length
    if (overlap === setA.size && overlap === setB.size) return 'bg-emerald-50'
    if (overlap > 0) return 'bg-amber-50'
    return 'bg-red-50'
  }

  if (type === 'numeric') {
    const diff = Math.abs(Number(a) - Number(b))
    if (diff === 0) return 'bg-emerald-50'
    if (diff <= 1) return 'bg-amber-50'
    return 'bg-red-50'
  }

  // tier, binary, text
  const strA = String(a).toLowerCase().trim()
  const strB = String(b).toLowerCase().trim()
  if (strA === strB) return 'bg-emerald-50'
  return 'bg-red-50'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MatchInspectionView({
  partnershipA,
  partnershipB,
}: {
  partnershipA: string
  partnershipB: string
}) {
  const [data, setData] = useState<InspectionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDebug, setErrorDebug] = useState<any>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/match-inspection?a=${partnershipA}&b=${partnershipB}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error || `HTTP ${res.status}`)
          if (body.debug) setErrorDebug(body.debug)
          return
        }
        setData(await res.json())
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [partnershipA, partnershipB])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-gray-500">Loading inspection data...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-red-600 font-semibold">Error: {error}</p>
        {errorDebug && (
          <pre className="mt-3 p-4 bg-gray-100 rounded-lg text-xs text-gray-700 overflow-auto">
            {JSON.stringify(errorDebug, null, 2)}
          </pre>
        )}
        <Link href="/admin/matching" className="text-blue-600 underline mt-4 inline-block">
          ← Back to Dashboard
        </Link>
      </div>
    )
  }

  const { match, userA, userB } = data

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* ── Back Link ── */}
      <Link href="/admin/matching" className="text-sm text-gray-500 hover:text-gray-800">
        ← Back to Dashboard
      </Link>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION A: Match Summary Header
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="border rounded-xl p-6 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {userA.displayName} ↔ {userB.displayName}
            </h1>
            <Badge variant={tierBadgeVariant(match.tier)}>{match.tier}</Badge>
          </div>
          <div className={`text-4xl font-bold rounded-lg px-4 py-2 ${scoreColor(match.score)}`}>
            {match.score}%
          </div>
        </div>

        <div className="text-xs text-gray-400 mb-5">
          Engine: {match.engineVersion} | Computed: {new Date(match.computedAt).toLocaleString()}
        </div>

        {/* Category Cards */}
        <div className="grid grid-cols-5 gap-3">
          {match.categories.map(cat => {
            const meta = CATEGORY_META[cat.category]
            return (
              <div
                key={cat.category}
                className={`border rounded-lg p-3 text-center ${
                  cat.included ? scoreBorderColor(cat.score) : 'border-gray-200 opacity-50'
                }`}
              >
                <div className="text-xs text-gray-500 font-medium">{meta?.label ?? cat.category}</div>
                <div className={`text-2xl font-bold mt-1 ${cat.included ? '' : 'text-gray-400'}`}>
                  {cat.included ? `${Math.round(cat.score)}%` : 'excl.'}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {cat.weight}w | cov {Math.round(cat.coverage * 100)}%
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION B: Category Drill-Down Accordions
          ══════════════════════════════════════════════════════════════════════ */}
      <Accordion type="multiple" className="space-y-3">
        {match.categories.map(cat => {
          const meta = CATEGORY_META[cat.category]
          return (
            <AccordionItem
              key={cat.category}
              value={cat.category}
              className="border rounded-xl bg-white shadow-sm"
            >
              <AccordionTrigger className="px-5 py-3 hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="font-semibold text-gray-900">
                    {meta?.label ?? cat.category}
                  </span>
                  <div className="flex items-center gap-3">
                    {!cat.included && (
                      <Badge variant="outline" className="text-xs">excluded</Badge>
                    )}
                    <span className={`text-lg font-bold px-2 py-0.5 rounded ${scoreColor(cat.score)}`}>
                      {Math.round(cat.score)}%
                    </span>
                    <span className="text-xs text-gray-400">{cat.weight}w</span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Sub-Component</TableHead>
                      <TableHead className="w-[80px] text-center">Score</TableHead>
                      <TableHead className="w-[80px] text-center">Weight</TableHead>
                      <TableHead className="w-[80px] text-center">Matched</TableHead>
                      <TableHead>Reasoning</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cat.subScores.map(sub => (
                      <TableRow
                        key={sub.key}
                        className={sub.matched ? '' : 'opacity-40'}
                      >
                        <TableCell className="font-medium capitalize">
                          {sub.key.replace(/([A-Z])/g, ' $1').trim()}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-0.5 rounded text-sm font-mono font-bold ${scoreColor(sub.score)}`}>
                            {Math.round(sub.score)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-xs text-gray-500">
                          {sub.weight}%
                        </TableCell>
                        <TableCell className="text-center">
                          {sub.matched ? '✔' : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 font-mono">
                          {sub.reason || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION C: Answer Comparison Table
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="border rounded-xl bg-white shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Answer Comparison</h2>

        {['intent', 'structure', 'connection', 'chemistry', 'lifestyle'].map(catKey => {
          const catMeta = CATEGORY_META[catKey]
          const groups = getQuestionsByCategory(catKey)
          const catScore = match.categories.find(c => c.category === catKey)

          return (
            <div key={catKey} className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                {catMeta?.label}
                {catScore && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${scoreColor(catScore.score)}`}>
                    {Math.round(catScore.score)}%
                  </span>
                )}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Question</TableHead>
                    <TableHead className="w-[100px]">Sub-Component</TableHead>
                    <TableHead>{userA.displayName}</TableHead>
                    <TableHead>{userB.displayName}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groups).map(([subComp, questions]) => {
                    // Find the sub-score for this sub-component
                    const subScore = catScore?.subScores.find(s => s.key === subComp)
                    return (
                      <React.Fragment key={subComp}>
                        {/* Sub-component header row */}
                        {subScore && (
                          <TableRow className="bg-gray-50 border-t">
                            <TableCell colSpan={2} className="font-semibold text-xs text-gray-600 capitalize">
                              {subComp.replace(/([A-Z])/g, ' $1').trim()}
                              {' '}
                              <span className={`ml-1 px-1.5 py-0.5 rounded font-mono ${scoreColor(subScore.score)}`}>
                                {Math.round(subScore.score)}
                              </span>
                              <span className="ml-1 text-gray-400">({subScore.weight}w)</span>
                            </TableCell>
                            <TableCell colSpan={2} className="text-xs text-gray-500 font-mono">
                              {subScore.reason || '—'}
                            </TableCell>
                          </TableRow>
                        )}
                        {/* Individual question rows */}
                        {questions.map(({ key, meta }) => {
                          const ansA = userA.answers[key]
                          const ansB = userB.answers[key]
                          const bg = diffColor(ansA, ansB, meta.type)
                          return (
                            <TableRow key={key} className={bg}>
                              <TableCell className="text-xs">
                                <span className="font-mono text-gray-400 mr-1">{key}</span>
                                <br />
                                <span className="text-gray-700">{meta.label}</span>
                              </TableCell>
                              <TableCell className="text-xs text-gray-400 capitalize">
                                {subComp.replace(/([A-Z])/g, ' $1').trim()}
                              </TableCell>
                              <TableCell className="text-sm font-mono">
                                {formatAnswer(ansA)}
                              </TableCell>
                              <TableCell className="text-sm font-mono">
                                {formatAnswer(ansB)}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION D: Gate Inspection Panel
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="border rounded-xl bg-white shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">P0 Gate Fields</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Field</TableHead>
              <TableHead>{userA.displayName}</TableHead>
              <TableHead>{userB.displayName}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(QUESTION_MAP)
              .filter(([, meta]) => meta.category === 'gate')
              .map(([key, meta]) => {
                const ansA = userA.answers[key]
                const ansB = userB.answers[key]
                return (
                  <TableRow key={key}>
                    <TableCell className="text-xs">
                      <span className="font-mono text-gray-400 mr-1">{key}</span>
                      <br />
                      <span className="text-gray-700">{meta.label}</span>
                    </TableCell>
                    <TableCell className="text-sm font-mono">{formatAnswer(ansA)}</TableCell>
                    <TableCell className="text-sm font-mono">{formatAnswer(ansB)}</TableCell>
                  </TableRow>
                )
              })}
            {/* Location row */}
            <TableRow>
              <TableCell className="text-xs">
                <span className="font-mono text-gray-400">_latitude / _longitude</span>
                <br />
                <span className="text-gray-700">Location</span>
              </TableCell>
              <TableCell className="text-sm font-mono">
                {userA.latitude != null ? `${userA.latitude.toFixed(4)}, ${userA.longitude?.toFixed(4)}` : '—'}
              </TableCell>
              <TableCell className="text-sm font-mono">
                {userB.latitude != null ? `${userB.latitude.toFixed(4)}, ${userB.longitude?.toFixed(4)}` : '—'}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
