import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLastSignInMap } from '@/lib/metrics/authLogins'
import { loadMarketIndex, resolveMarket } from '@/lib/markets/releaseGate'
import {
  surveyStatusOf,
  initialsOf,
  filterUsers,
  sortUsers,
  paginate,
  summarize,
  type UserCard,
  type UserFilters,
  type UserSortKey,
} from '@/lib/admin/userCards'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Admin = ReturnType<typeof createAdminClient>

/**
 * /admin/users directory. Read-only, allowlist-gated. Server-side search/filter/
 * sort/pagination. Batched (no N+1). Keyed on profiles (people), with partnership
 * linkage folded in. Summary is over the FULL directory (data-quality view);
 * `total` is the filtered count.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response

  const admin = createAdminClient()
  const p = request.nextUrl.searchParams

  try {
    const all = await buildCards(admin)

    const filters: UserFilters = {
      search: p.get('search') ?? undefined,
      survey: (p.get('survey') as any) ?? 'all',
      login: (p.get('login') as any) ?? 'all',
      tier: (p.get('tier') as any) ?? 'all',
      market: p.get('market') ?? 'all',
      photo: (p.get('photo') as any) ?? 'all',
    }
    const filtered = filterUsers(all, filters)

    const sort = (p.get('sort') as UserSortKey) ?? 'name'
    const dir = (p.get('dir') as 'asc' | 'desc') ?? 'asc'
    const sorted = sortUsers(filtered, sort, dir)

    const page = Math.max(1, Number(p.get('page') ?? '1'))
    const pageSize = Math.min(200, Math.max(1, Number(p.get('pageSize') ?? '48')))
    const { pageRows, total } = paginate(sorted, page, pageSize)

    return NextResponse.json({
      rows: pageRows,
      total,
      page,
      pageSize,
      summary: summarize(all), // full directory
      generatedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[admin/users] failed:', err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? 'Failed to load users' }, { status: 500 })
  }
}

async function buildCards(admin: Admin): Promise<UserCard[]> {
  const [profiles, lastSignIn, members, partnerships, photos, surveys, marketIdx] = await Promise.all([
    fetchAll(admin, 'profiles', 'user_id, email, full_name, city, created_at'),
    getLastSignInMap(admin),
    fetchAll(admin, 'partnership_members', 'partnership_id, user_id'),
    fetchAll(admin, 'partnerships', 'id, city, membership_tier'),
    fetchAll(admin, 'partnership_photos', 'partnership_id, photo_url, is_primary'),
    fetchAll(admin, 'user_survey_responses', 'user_id, completion_pct'),
    loadMarketIndex(true),
  ])

  // user → partnership; partnership → members (for partner name)
  const partnershipByUser = new Map<string, string>()
  const membersByPartnership = new Map<string, string[]>()
  for (const m of members as { partnership_id: string; user_id: string }[]) {
    partnershipByUser.set(m.user_id, m.partnership_id)
    const a = membersByPartnership.get(m.partnership_id) ?? []
    a.push(m.user_id)
    membersByPartnership.set(m.partnership_id, a)
  }

  const partnershipById = new Map<string, { city: string | null; tier: string | null }>()
  for (const pp of partnerships as { id: string; city: string | null; membership_tier: string | null }[]) {
    partnershipById.set(pp.id, { city: pp.city ?? null, tier: pp.membership_tier ?? null })
  }

  // partnership → primary photo url (fallback to any photo)
  const photoByPartnership = new Map<string, string>()
  for (const ph of photos as { partnership_id: string; photo_url: string | null; is_primary: boolean }[]) {
    if (!ph.photo_url) continue
    if (ph.is_primary || !photoByPartnership.has(ph.partnership_id)) {
      photoByPartnership.set(ph.partnership_id, ph.photo_url)
    }
  }

  const pctByUser = new Map<string, number | null>(
    (surveys as { user_id: string; completion_pct: number | null }[]).map((s) => [s.user_id, s.completion_pct])
  )
  const nameByUser = new Map<string, string | null>()
  for (const pr of profiles as { user_id: string; full_name: string | null }[]) {
    nameByUser.set(pr.user_id, pr.full_name)
  }

  return (profiles as any[]).map((pr): UserCard => {
    const partnershipId = partnershipByUser.get(pr.user_id) ?? null
    const part = partnershipId ? partnershipById.get(partnershipId) : null
    const city = part?.city ?? pr.city ?? null
    const market = resolveMarket(city, marketIdx)

    // partner (other member) name, for couples
    let partnerName: string | null = null
    if (partnershipId) {
      const others = (membersByPartnership.get(partnershipId) ?? []).filter((u) => u !== pr.user_id)
      if (others.length > 0) partnerName = nameByUser.get(others[0]) ?? null
    }

    const pct = pctByUser.get(pr.user_id) ?? null
    return {
      userId: pr.user_id,
      name: pr.full_name ?? '(no name)',
      email: pr.email ?? '',
      memberSince: pr.created_at ?? null,
      city,
      market,
      tier: part?.tier ?? null,
      partnerName,
      surveyStatus: surveyStatusOf(pct),
      completionPct: pct,
      lastSignInAt: lastSignIn.get(pr.user_id) ?? null,
      photoUrl: partnershipId ? photoByPartnership.get(partnershipId) ?? null : null,
      initials: initialsOf(pr.full_name),
      partnershipId,
    }
  })
}

async function fetchAll(admin: Admin, table: string, cols: string): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + 999)
    if (error) {
      console.warn(`[admin/users] ${table} read: ${error.message}`)
      break
    }
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}
