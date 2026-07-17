import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin/allowlist'
import { runNetworkSnapshot } from '@/lib/metrics/runSnapshot'

/**
 * Admin manual trigger for the Network snapshot. Used to seed THIS week's row
 * immediately on deploy (weekly history is unbackfillable, so we don't wait for
 * the Saturday cron). Same runNetworkSnapshot() the cron calls.
 *
 * Auth: the standard admin allowlist gate (createClient + isAdminUser), matching
 * every other app/api/admin route. NEVER the hardcoded-secret pattern.
 */
export const maxDuration = 60

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !isAdminUser(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runNetworkSnapshot()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 })
  }
}
