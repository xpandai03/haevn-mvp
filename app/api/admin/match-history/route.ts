import { NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureMatchHistoryToDb } from '@/lib/services/matchHistory'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Admin = ReturnType<typeof createAdminClient>

/**
 * Match-history admin surface. Allowlist-gated.
 *   GET  → captured runs (run_date + row count + unique-pair count), newest first.
 *   POST → capture the CURRENT computed_matches set NOW (seed this week without
 *          waiting for Monday's recompute). Idempotent; fail-safe.
 */
export async function GET() {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response

  const admin = createAdminClient()
  const rows = await fetchAll(admin, 'match_history', 'run_date, partnership_a, partnership_b')

  const byRun = new Map<string, { rows: number; pairs: Set<string> }>()
  for (const r of rows as { run_date: string; partnership_a: string; partnership_b: string }[]) {
    const g = byRun.get(r.run_date) ?? { rows: 0, pairs: new Set<string>() }
    g.rows++
    g.pairs.add(r.partnership_a < r.partnership_b ? `${r.partnership_a}|${r.partnership_b}` : `${r.partnership_b}|${r.partnership_a}`)
    byRun.set(r.run_date, g)
  }
  const runs = [...byRun.entries()]
    .map(([runDate, g]) => ({ runDate, rows: g.rows, uniquePairs: g.pairs.size }))
    .sort((a, b) => (a.runDate < b.runDate ? 1 : -1))

  return NextResponse.json({ runs, totalRows: rows.length, generatedAt: new Date().toISOString() })
}

export async function POST() {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response

  const admin = createAdminClient()
  const runDate = new Date().toISOString().slice(0, 10)
  const result = await captureMatchHistoryToDb(admin, runDate)

  if (result.error) {
    return NextResponse.json({ ok: false, runDate, captured: result.captured, error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true, runDate, captured: result.captured })
}

async function fetchAll(admin: Admin, table: string, cols: string): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + 999)
    if (error) {
      console.warn(`[admin/match-history] ${table} read: ${error.message}`)
      break
    }
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}
