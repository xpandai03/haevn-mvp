import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/admin/allowlist'

/** Next Monday at 8 AM Eastern (12:00 UTC). */
function getNextMondayUTC(): string {
  const now = new Date()
  const day = now.getUTCDay()

  let daysUntilMonday: number
  if (day === 1 && now.getUTCHours() < 12) {
    daysUntilMonday = 0
  } else {
    daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : (8 - day)
  }

  const nextMonday = new Date(now)
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday)
  nextMonday.setUTCHours(12, 0, 0, 0)
  return nextMonday.toISOString()
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email || !isAdminUser(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Fetch latest events in parallel
  const [
    lastComputeRes,
    lastReleaseRes,
    lastSmsRes,
    pendingRes,
    activeRes,
    expiredRes,
    recentNotificationsRes,
  ] = await Promise.all([
    admin.from('system_events')
      .select('created_at, triggered_by, metadata')
      .eq('event_type', 'match_compute')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    admin.from('system_events')
      .select('created_at, triggered_by, metadata')
      .eq('event_type', 'match_release')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    admin.from('system_events')
      .select('created_at, triggered_by, metadata')
      .eq('event_type', 'sms_notify')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Pending: release_at in future
    admin.from('computed_matches')
      .select('id', { count: 'exact', head: true })
      .gt('release_at', now),

    // Active: released and not expired
    admin.from('computed_matches')
      .select('id', { count: 'exact', head: true })
      .lte('release_at', now)
      .gt('expires_at', now),

    // Expired: past expiry and not saved
    admin.from('computed_matches')
      .select('id', { count: 'exact', head: true })
      .lte('expires_at', now)
      .eq('saved', false),

    // Recent notification events (last 20)
    admin.from('system_events')
      .select('created_at, triggered_by, metadata')
      .eq('event_type', 'notification_sent')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return NextResponse.json({
    lastComputation: lastComputeRes.data ? {
      at: lastComputeRes.data.created_at,
      triggeredBy: lastComputeRes.data.triggered_by,
      ...((lastComputeRes.data.metadata as any) || {}),
    } : null,

    lastRelease: lastReleaseRes.data ? {
      at: lastReleaseRes.data.created_at,
      ...((lastReleaseRes.data.metadata as any) || {}),
    } : null,

    lastSmsNotification: lastSmsRes.data ? {
      at: lastSmsRes.data.created_at,
      ...((lastSmsRes.data.metadata as any) || {}),
    } : null,

    nextRelease: getNextMondayUTC(),

    pendingMatches: pendingRes.count ?? 0,
    activeMatches: activeRes.count ?? 0,
    expiredMatches: expiredRes.count ?? 0,

    recentNotifications: (recentNotificationsRes.data || []).map((e: any) => ({
      at: e.created_at,
      triggeredBy: e.triggered_by,
      ...((e.metadata as any) || {}),
    })),

    systemState: 'idle',
  })
}
