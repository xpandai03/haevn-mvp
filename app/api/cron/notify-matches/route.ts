import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/services/twilio'

const SMS_MESSAGE = 'Your new matches are ready on HAEVN! Log in to view them: https://haevn.co/dashboard/matches'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const summary = { sent: 0, skipped: 0, errors: 0 }

  try {
    // Find all partnerships with unreleased-but-due matches that haven't been notified
    const { data: rows, error: queryError } = await supabase
      .from('computed_matches')
      .select('partnership_a')
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

    // Fetch partnership phone numbers + member profile msa_status
    for (const partnershipId of partnershipIds) {
      // Get partnership phone
      const { data: partnership } = await supabase
        .from('partnerships')
        .select('id, phone')
        .eq('id', partnershipId)
        .single()

      if (!partnership?.phone) {
        console.log(`[Cron notify-matches] Skip ${partnershipId}: no phone`)
        summary.skipped++
        // Still mark as notified so we don't re-check every week
        await markNotified(supabase, partnershipId)
        continue
      }

      // Check if user is in a live market
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

      // Send SMS
      const result = await sendSMS(partnership.phone, SMS_MESSAGE)

      if (result.success) {
        console.log(`[Cron notify-matches] Sent to ${partnershipId}, SID: ${result.sid}`)
        summary.sent++
        await markNotified(supabase, partnershipId)
      } else {
        console.error(`[Cron notify-matches] Failed for ${partnershipId}:`, result.error)
        summary.errors++
        // Do NOT mark as notified — retry next run
      }
    }

    console.log('[Cron notify-matches] Complete:', summary)
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
