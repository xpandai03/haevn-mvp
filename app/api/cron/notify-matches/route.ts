import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotification, buildSignInUrl } from '@/lib/services/notifications'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const summary = { sent: 0, skipped: 0, errors: 0 }

  try {
    // Find all partnerships with released-but-un-notified results. Notify the
    // full launch set: Matches (>= 80) AND Recommendations (77–79). Both bands
    // get the "your matches are ready" SMS so all 87 recipients are covered.
    const { data: rows, error: queryError } = await supabase
      .from('computed_matches')
      .select('partnership_a')
      .gte('score', 77)
      .lte('release_at', new Date().toISOString())
      .is('sms_notified_at', null)

    if (queryError) {
      console.error('[Cron notify-matches] Query error:', queryError)
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    if (!rows || rows.length === 0) {
      console.log('[Cron notify-matches] No un-notified matches found')
      return NextResponse.json({ ...summary, message: 'No matches to notify' })
    }

    // Deduplicate partnership IDs
    const partnershipIds = [...new Set(rows.map(r => r.partnership_a))]
    console.log(`[Cron notify-matches] ${partnershipIds.length} partnerships to notify`)

    for (const partnershipId of partnershipIds) {
      // Phone may be null — the imported cohort has no phone numbers, so EMAIL
      // is the primary channel. We no longer skip no-phone recipients.
      const { data: partnership } = await supabase
        .from('partnerships')
        .select('id, phone')
        .eq('id', partnershipId)
        .single()

      // Resolve the owner (needed for the live-market gate, email, magic link).
      const { data: member } = await supabase
        .from('partnership_members')
        .select('user_id')
        .eq('partnership_id', partnershipId)
        .limit(1)
        .single()

      if (member) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('msa_status')
          .eq('user_id', member.user_id)
          .single()

        if (profile?.msa_status !== 'live') {
          console.log(`[Cron notify-matches] Skip ${partnershipId}: not in live market`)
          summary.skipped++
          await markNotified(supabase, partnershipId)
          continue
        }
      }

      // Owner email — the primary channel for this launch (all imported users
      // have one; none have a phone).
      let userEmail: string | null = null
      if (member) {
        const { data: authUser } = await supabase.auth.admin.getUserById(member.user_id)
        userEmail = authUser?.user?.email || null
      }

      // Unreachable on ANY channel — don't burn the notified flag so it can be
      // retried if contact info is added later.
      if (!partnership?.phone && !userEmail) {
        console.log(`[Cron notify-matches] Skip ${partnershipId}: no phone AND no email`)
        summary.skipped++
        continue
      }

      // Per-user passwordless magic sign-in link (imported users have no
      // password). Delivered in the email CTA (and SMS if a phone ever exists).
      const signInUrl = userEmail ? await buildSignInUrl(userEmail) : null

      // Send via notification system. SMS only fires if a phone exists; email
      // carries the branded magic link for the no-phone cohort.
      const result = await sendNotification({
        type: 'match',
        phone: partnership?.phone ?? null,
        email: userEmail,
        partnershipId,
        signInUrl: signInUrl ?? undefined,
      })

      if (result.sms.sent || result.email.sent) {
        console.log(`[Cron notify-matches] Notified ${partnershipId}: sms=${result.sms.sent} email=${result.email.sent}`)
        summary.sent++
        await markNotified(supabase, partnershipId)
      } else {
        console.error(`[Cron notify-matches] All channels failed for ${partnershipId}`)
        summary.errors++
        // Do NOT mark as notified — retry next run
      }
    }

    console.log('[Cron notify-matches] Complete:', summary)

    // Log system events
    await supabase.from('system_events').insert([
      { event_type: 'match_release', triggered_by: 'cron', metadata: { released: partnershipIds.length } },
      { event_type: 'sms_notify', triggered_by: 'cron', metadata: summary },
    ]).then(() => {}, () => {})

    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('[Cron notify-matches] Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function markNotified(supabase: ReturnType<typeof createAdminClient>, partnershipId: string) {
  const { error } = await supabase
    .from('computed_matches')
    .update({ sms_notified_at: new Date().toISOString() })
    .eq('partnership_a', partnershipId)
    .is('sms_notified_at', null)

  if (error) {
    console.error(`[Cron notify-matches] Failed to mark notified for ${partnershipId}:`, error)
  }
}
