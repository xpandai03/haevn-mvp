import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLastSignInMap } from '@/lib/metrics/authLogins'
import { loadMarketIndex, resolveMarket } from '@/lib/markets/releaseGate'
import {
  surveyStatusOf,
  filterSurveys,
  sortSurveys,
  paginate,
  summarizeSurveys,
  type SurveyRow,
  type SurveyFilters,
  type SurveySortKey,
} from '@/lib/admin/surveyRows'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Admin = ReturnType<typeof createAdminClient>

/**
 * /admin/surveys funnel directory. Read-only, allowlist-gated, server-side.
 * Keyed on profiles so the NEVER-STARTED cohort (no survey row) is visible.
 * Reuses the Users batched join; source (webhook/import) from survey_ingest_log.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response

  const admin = createAdminClient()
  const p = request.nextUrl.searchParams

  try {
    const all = await buildRows(admin)

    const filters: SurveyFilters = {
      search: p.get('search') ?? undefined,
      status: (p.get('status') as any) ?? 'all',
      band: (p.get('band') as any) ?? 'all',
      market: p.get('market') ?? 'all',
      login: (p.get('login') as any) ?? 'all',
      source: (p.get('source') as any) ?? 'all',
    }
    const filtered = filterSurveys(all, filters)

    const sort = (p.get('sort') as SurveySortKey) ?? 'pct'
    const dir = (p.get('dir') as 'asc' | 'desc') ?? 'desc'
    const sorted = sortSurveys(filtered, sort, dir)

    const page = Math.max(1, Number(p.get('page') ?? '1'))
    const pageSize = Math.min(200, Math.max(1, Number(p.get('pageSize') ?? '48')))
    const { pageRows, total } = paginate(sorted, page, pageSize)

    return NextResponse.json({
      rows: pageRows,
      total,
      page,
      pageSize,
      summary: summarizeSurveys(all), // full funnel
      generatedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[admin/surveys] failed:', err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? 'Failed to load surveys' }, { status: 500 })
  }
}

async function buildRows(admin: Admin): Promise<SurveyRow[]> {
  const [profiles, surveys, lastSignIn, members, partnerships, ingest, marketIdx] = await Promise.all([
    fetchAll(admin, 'profiles', 'user_id, email, full_name, city'),
    fetchAll(admin, 'user_survey_responses', 'user_id, completion_pct, created_at'),
    getLastSignInMap(admin),
    fetchAll(admin, 'partnership_members', 'partnership_id, user_id'),
    fetchAll(admin, 'partnerships', 'id, city'),
    fetchAll(admin, 'survey_ingest_log', 'user_id'),
    loadMarketIndex(true),
  ])

  const surveyByUser = new Map<string, { completion_pct: number | null; created_at: string | null }>()
  for (const s of surveys as { user_id: string; completion_pct: number | null; created_at: string | null }[]) {
    surveyByUser.set(s.user_id, { completion_pct: s.completion_pct, created_at: s.created_at })
  }
  const webhookUsers = new Set<string>()
  for (const g of ingest as { user_id: string | null }[]) if (g.user_id) webhookUsers.add(g.user_id)

  const partnershipByUser = new Map<string, string>()
  for (const m of members as { partnership_id: string; user_id: string }[]) partnershipByUser.set(m.user_id, m.partnership_id)
  const cityByPartnership = new Map<string, string | null>()
  for (const pp of partnerships as { id: string; city: string | null }[]) cityByPartnership.set(pp.id, pp.city ?? null)

  return (profiles as any[]).map((pr): SurveyRow => {
    const survey = surveyByUser.get(pr.user_id)
    const partnershipId = partnershipByUser.get(pr.user_id) ?? null
    const city = (partnershipId ? cityByPartnership.get(partnershipId) : null) ?? pr.city ?? null
    const pct = survey?.completion_pct ?? null
    return {
      userId: pr.user_id,
      name: pr.full_name ?? '(no name)',
      email: pr.email ?? '',
      city,
      market: resolveMarket(city, marketIdx),
      status: surveyStatusOf(pct),
      completionPct: pct,
      createdAt: survey?.created_at ?? null,
      lastSignInAt: lastSignIn.get(pr.user_id) ?? null,
      // source only applies to members who have a survey record
      source: survey ? (webhookUsers.has(pr.user_id) ? 'webhook' : 'import') : null,
      partnershipId,
    }
  })
}

async function fetchAll(admin: Admin, table: string, cols: string): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + 999)
    if (error) {
      console.warn(`[admin/surveys] ${table} read: ${error.message}`)
      break
    }
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}
