/**
 * One-off: regenerate the AI summary for a single account using the
 * exact production pipeline (lib/matching/utils/normalizeAnswers +
 * lib/ai/buildSummaryInput + lib/ai/generateSummaries → OpenAI).
 *
 * Reads OPENAI_API_KEY from .env.local. Writes
 * partnerships.haevn_insight + connection_summary +
 * summaries_generated_at on the user's LIVE partnership.
 *
 * Usage: npx tsx scripts/regen-summary-for-account.ts <email>
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { normalizeAnswers } from '../lib/matching/utils/normalizeAnswers'
import type { RawAnswers } from '../lib/matching/types'
import { buildSummaryInput } from '../lib/ai/buildSummaryInput'
import { generateSummaries } from '../lib/ai/generateSummaries'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in .env.local — the script will only emit fallbacks')
}

const email = process.argv[2]
if (!email) {
  console.error('Usage: npx tsx scripts/regen-summary-for-account.ts <email>')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // 1. Find user
  const { data: page } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const user = page?.users.find(
    (u) => (u.email || '').toLowerCase() === email.toLowerCase()
  )
  if (!user) {
    console.error('No user with email:', email)
    process.exit(2)
  }
  console.log('User:', user.id)

  // 2. Find live partnership
  const { data: memberships } = await sb
    .from('partnership_members')
    .select('partnership_id, partnerships!inner(id, profile_state, display_name)')
    .eq('user_id', user.id)
  const live = memberships?.find(
    (m: any) => (m.partnerships as any).profile_state === 'live'
  ) as any
  if (!live) {
    console.error('No LIVE partnership for this user')
    process.exit(2)
  }
  const partnershipId = live.partnership_id
  const displayName =
    (live.partnerships as any).display_name || user.email?.split('@')[0] || 'User'
  console.log('Live partnership:', partnershipId, '| display_name:', displayName)

  // 3. Load survey
  const { data: survey } = await sb
    .from('user_survey_responses')
    .select('answers_json, completion_pct')
    .eq('user_id', user.id)
    .eq('partnership_id', partnershipId)
    .maybeSingle()
  if (!survey?.answers_json) {
    console.error('No survey data for that partnership — falling back to user-wide row')
    const { data: any } = await sb
      .from('user_survey_responses')
      .select('answers_json, completion_pct')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!any?.answers_json) {
      console.error('No survey data at all')
      process.exit(2)
    }
    survey!.answers_json = any.answers_json
  }
  console.log('Survey keys:', Object.keys(survey!.answers_json).length, 'completion_pct:', survey!.completion_pct)

  // 4. Normalize + build input
  const rawAnswers = survey!.answers_json as RawAnswers
  const normalized = normalizeAnswers(rawAnswers)
  const summaryInput = buildSummaryInput({
    answers: normalized,
    displayName,
  })
  console.log('Built summary input:', JSON.stringify(summaryInput, null, 2))

  // 5. Generate via OpenAI
  console.log('\nCalling generateSummaries (OpenAI)…')
  const result = await generateSummaries(summaryInput)
  console.log('Used fallback:', result.used_fallback)
  console.log('Fields populated:', result.fields_populated)
  console.log('\n--- Connection Summary ---\n', result.connection_summary)
  console.log('\n--- HAEVN Insight ---\n', result.haevn_insight)

  if (result.used_fallback) {
    console.error('\n❌ Generation took the fallback path — NOT writing to DB. Check OPENAI_API_KEY.')
    process.exit(3)
  }

  // 6. Persist
  const { error: updateError } = await sb
    .from('partnerships')
    .update({
      connection_summary: result.connection_summary,
      haevn_insight: result.haevn_insight,
      summaries_version: 'v1',
      summaries_generated_at: new Date().toISOString(),
    })
    .eq('id', partnershipId)

  if (updateError) {
    console.error('\n❌ DB update failed:', updateError)
    process.exit(4)
  }

  console.log('\n✅ Wrote regenerated summaries to partnerships row', partnershipId)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(2)
})
