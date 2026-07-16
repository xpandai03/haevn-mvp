import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/admin/allowlist'
import { getReleaseEligibility } from '@/lib/markets/releaseGate'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email || !isAdminUser(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // ── CITY GATE ──────────────────────────────────────────────────────────────
  // Force Release must NOT surface pre-launch cities (Tampa/Portland). Only
  // live-market members are released; unresolved city => excluded (fail closed).
  const gate = await getReleaseEligibility()
  if (!gate.ok) {
    console.error('[trigger-release] FAIL CLOSED — market gate unavailable; released nothing.')
    return NextResponse.json(
      { error: 'Market gate unavailable — released nothing (fail closed).' },
      { status: 503 }
    )
  }
  const eligibleIds = [...gate.eligible]
  const withheld = Object.values(gate.excludedByCity).reduce((s, n) => s + n, 0)

  // Release pending matches for LIVE-market members only.
  let released = 0
  const CHUNK = 200
  for (let i = 0; i < eligibleIds.length; i += CHUNK) {
    const { data: rows, error } = await admin
      .from('computed_matches')
      .update({ release_at: now })
      .gt('release_at', now)
      .in('partnership_a', eligibleIds.slice(i, i + CHUNK))
      .select('id')
    if (error) {
      console.error('[trigger-release] Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    released += rows?.length ?? 0
  }

  if (withheld > 0) {
    console.log(
      `[trigger-release] CITY GATE withheld ${withheld} partnership(s) in non-live markets:`,
      gate.excludedByCity
    )
  }

  // Log event
  await admin.from('system_events').insert({
    event_type: 'match_release',
    triggered_by: 'admin_manual',
    metadata: {
      released,
      // City-gating audit — exclusions are never silent.
      excluded_non_live_market: withheld,
      excluded_by_city: gate.excludedByCity,
    },
  }).then(() => {}, () => {})

  console.log(`[trigger-release] Released ${released} pending matches`)
  return NextResponse.json({ released })
}
