import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/admin/allowlist'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email || !isAdminUser(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Count pending before release
  const { count: pendingBefore } = await admin
    .from('computed_matches')
    .select('id', { count: 'exact', head: true })
    .gt('release_at', now)

  // Release all pending matches by setting release_at to now
  const { error } = await admin
    .from('computed_matches')
    .update({ release_at: now })
    .gt('release_at', now)

  if (error) {
    console.error('[trigger-release] Update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const released = pendingBefore ?? 0

  // Log event
  await admin.from('system_events').insert({
    event_type: 'match_release',
    triggered_by: 'admin_manual',
    metadata: { released },
  }).then(() => {}, () => {})

  console.log(`[trigger-release] Released ${released} pending matches`)
  return NextResponse.json({ released })
}
