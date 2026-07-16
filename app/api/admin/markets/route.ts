/**
 * Admin market control — list markets and toggle a market live / not-live.
 *
 * This is the switch that launches a city. Flipping is_live = true makes every
 * member in that market eligible for match RELEASE + NOTIFY on the next cycle.
 * Flipping back to false immediately stops future release/notify for them.
 *
 * Reversible by design: a boolean on one row. No data is rewritten or deleted.
 * Gating never touches computation or scoring.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/admin/allowlist'
import { loadMarketIndex, normalizeCity } from '@/lib/markets/releaseGate'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email || !isAdminUser(user.email)) return null
  return user
}

/** GET — markets + their live status + how many live partnerships each covers. */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()

  const { data: markets, error } = await admin
    .from('markets')
    .select('market_name, is_live, notes, updated_at')
    .order('is_live', { ascending: false })
    .order('market_name')

  if (error) {
    // Most likely: migration 043 not applied yet.
    return NextResponse.json(
      { error: error.message, hint: 'markets table missing — apply migration 043_markets_release_gating.sql' },
      { status: 500 }
    )
  }

  // Member counts per market (+ the unresolved bucket, which is excluded).
  const idx = await loadMarketIndex(true)
  const { data: parts } = await admin
    .from('partnerships')
    .select('city, profile_state')
    .eq('profile_state', 'live')
    .limit(10000)

  const counts: Record<string, number> = {}
  let unresolved = 0
  for (const p of (parts ?? []) as { city: string | null }[]) {
    const market = idx.cityToMarket.get(normalizeCity(p.city))
    if (!market) unresolved++
    else counts[market] = (counts[market] ?? 0) + 1
  }

  return NextResponse.json({
    markets: (markets ?? []).map((m: any) => ({
      ...m,
      liveMemberCount: counts[m.market_name] ?? 0,
    })),
    // Members whose city maps to no market — excluded from release (fail closed).
    unresolvedLiveMembers: unresolved,
  })
}

/** PATCH { market_name, is_live } — launch or pause a market. */
export async function PATCH(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const marketName = body?.market_name
  const isLive = body?.is_live
  if (typeof marketName !== 'string' || typeof isLive !== 'boolean') {
    return NextResponse.json({ error: 'market_name (string) and is_live (boolean) required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('markets')
    .update({ is_live: isLive })
    .eq('market_name', marketName)
    .select('market_name, is_live')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Market not found' }, { status: 404 })

  // Audit: launching/pausing a city is a consequential act — never silent.
  await admin.from('system_events').insert({
    event_type: 'market_live_toggled',
    triggered_by: 'admin_manual',
    metadata: { market_name: marketName, is_live: isLive, by: user.email },
  }).then(() => {}, () => {})

  console.log(`[admin/markets] ${user.email} set ${marketName} is_live=${isLive}`)
  return NextResponse.json({ ok: true, market: data })
}
