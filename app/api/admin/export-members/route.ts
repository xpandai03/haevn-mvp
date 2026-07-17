import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePartnershipScope } from '@/lib/metrics/scope'
import type { Scope } from '@/lib/metrics/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Scope-aware member-list CSV export for the dashboard's quick-actions bar.
 * Allowlist-gated. Columns are deliberately PII-FREE: partnership id, city,
 * membership tier, survey status, created date. No names / emails / phones.
 *
 * GET ?scope=network|<market_name>
 */
const COLUMNS = ['partnership_id', 'city', 'membership_tier', 'survey_status', 'created_date'] as const

function csvCell(v: string): string {
  // Quote when the value contains a comma, quote, or newline; double inner quotes.
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export async function GET(request: NextRequest) {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response

  const scopeParam = request.nextUrl.searchParams.get('scope') ?? 'network'
  const scope: Scope = scopeParam === 'network' ? 'network' : { market: scopeParam }

  const admin = createAdminClient()

  // Scope → partnership id set (null = network = all).
  const resolution = await resolvePartnershipScope(scope)
  const scopeIds = resolution.partnershipIds

  const [{ data: parts, error: partsErr }, { data: profiles }] = await Promise.all([
    admin.from('partnerships').select('id, city, membership_tier, created_at, owner_id').limit(20000),
    admin.from('profiles').select('user_id, survey_complete').limit(20000),
  ])

  if (partsErr) {
    return NextResponse.json({ error: partsErr.message }, { status: 500 })
  }

  const surveyByUser = new Map<string, boolean>()
  for (const p of (profiles ?? []) as { user_id: string; survey_complete: boolean | null }[]) {
    surveyByUser.set(p.user_id, !!p.survey_complete)
  }

  const rows = ((parts ?? []) as Array<{
    id: string
    city: string | null
    membership_tier: string | null
    created_at: string | null
    owner_id: string | null
  }>)
    .filter((p) => scopeIds === null || scopeIds.has(p.id))
    .map((p) => [
      p.id,
      p.city ?? '',
      p.membership_tier ?? '',
      surveyByUser.get(p.owner_id ?? '') ? 'complete' : 'incomplete',
      p.created_at ? p.created_at.slice(0, 10) : '',
    ])

  const csv = [COLUMNS.join(','), ...rows.map((r) => r.map((c) => csvCell(String(c))).join(','))].join('\n')

  const scopeSlug = scope === 'network' ? 'network' : 'market'
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="haevn-members-${scopeSlug}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
