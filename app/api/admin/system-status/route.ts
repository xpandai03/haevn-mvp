import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/admin/allowlist'
import { assessRecompute } from '@/lib/services/recomputeHealth'

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
    lastNotifyRunRes,
    pendingRes,
    activeRes,
    expiredRes,
    recentNotificationsRes,
    lastRecomputeRes,
    lastRecomputeFailureRes,
    liveCountRes,
  ] = await Promise.all([
    admin.from('system_events')
      .select('created_at, triggered_by, metadata')
      .eq('event_type', 'match_compute')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // LAST RELEASE — derived from the data, not from an event. Previously this
    // read the `match_release` system_event, which is only written by the notify
    // cron; when notify no-op'd (0 new pairs) the tile silently showed the prior
    // week. A release isn't an action — a row is released once release_at passes.
    // So the truth is MAX(release_at) WHERE release_at <= now.
    admin.from('computed_matches')
      .select('release_at')
      .lte('release_at', now)
      .order('release_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    admin.from('system_events')
      .select('created_at, triggered_by, metadata')
      .eq('event_type', 'sms_notify')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // LAST NOTIFY RUN — written on every notify-matches run (incl. 0-row), so a
    // healthy no-op is visibly distinct from a failure.
    admin.from('system_events')
      .select('created_at, triggered_by, metadata')
      .eq('event_type', 'notify_run')
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

    // LAST RECOMPUTE (Match Monday) — the cron's terminal summary. metadata
    // carries partnerships_total/processed + `completed`. This is the
    // completeness surface: a silent under-run (like Jul 27) shows up as
    // completed=false or processed < live count, visible the same hour.
    admin.from('system_events')
      .select('created_at, triggered_by, metadata')
      .eq('event_type', 'match_recompute')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // LAST RECOMPUTE FAILURE — progress-at-death breadcrumb (soft budget /
    // exception). Present when a run stopped short.
    admin.from('system_events')
      .select('created_at, triggered_by, metadata')
      .eq('event_type', 'match_recompute_failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Live partnership count — the denominator to compare processed against.
    admin.from('partnerships')
      .select('id', { count: 'exact', head: true })
      .eq('profile_state', 'live'),
  ])

  return NextResponse.json({
    lastComputation: lastComputeRes.data ? {
      at: lastComputeRes.data.created_at,
      triggeredBy: lastComputeRes.data.triggered_by,
      ...((lastComputeRes.data.metadata as any) || {}),
    } : null,

    // Derived: the most recent release_at that has actually passed.
    lastRelease: lastReleaseRes.data?.release_at ? {
      at: lastReleaseRes.data.release_at,
    } : null,

    lastSmsNotification: lastSmsRes.data ? {
      at: lastSmsRes.data.created_at,
      ...((lastSmsRes.data.metadata as any) || {}),
    } : null,

    lastNotifyRun: lastNotifyRunRes.data ? {
      at: lastNotifyRunRes.data.created_at,
      ...((lastNotifyRunRes.data.metadata as any) || {}),
    } : null,

    nextRelease: getNextMondayUTC(),

    // Recompute completeness surface. `completed:false` or processed < live is a
    // silent-under-run alarm — never let a Monday partial pass unseen again.
    lastRecompute: lastRecomputeRes.data ? {
      at: lastRecomputeRes.data.created_at,
      triggeredBy: lastRecomputeRes.data.triggered_by,
      ...assessRecompute((lastRecomputeRes.data.metadata as any) || {}, liveCountRes.count ?? null),
    } : null,

    lastRecomputeFailure: lastRecomputeFailureRes.data ? {
      at: lastRecomputeFailureRes.data.created_at,
      triggeredBy: lastRecomputeFailureRes.data.triggered_by,
      ...((lastRecomputeFailureRes.data.metadata as any) || {}),
    } : null,

    livePartnerships: liveCountRes.count ?? 0,

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
