#!/usr/bin/env node

/**
 * Read-only diagnostic for a single account.
 *
 * Walks the data path that the profile / matches pages read from and
 * prints the findings. Does not mutate anything.
 *
 * Usage: node scripts/diagnose-account.mjs raunek@cloudsteer.com
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/diagnose-account.mjs <email>')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function header(s) {
  console.log('\n' + '='.repeat(70))
  console.log(s)
  console.log('='.repeat(70))
}

async function main() {
  header(`USER LOOKUP: ${email}`)

  // 1. auth.users
  const { data: authPage, error: authErr } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (authErr) {
    console.error('auth.admin.listUsers error:', authErr.message)
    process.exit(2)
  }
  const authUser = authPage.users.find(
    (u) => (u.email || '').toLowerCase() === email.toLowerCase()
  )
  if (!authUser) {
    console.log('No auth user with that email')
    process.exit(0)
  }
  console.log('auth.users:', {
    id: authUser.id,
    email: authUser.email,
    created_at: authUser.created_at,
    last_sign_in_at: authUser.last_sign_in_at,
  })
  const userId = authUser.id

  // 2. profiles
  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  console.log('profiles:', profileErr ? `ERR: ${profileErr.message}` : profile)

  // 3. partnership_members → resolve to all partnerships
  const { data: memberships } = await sb
    .from('partnership_members')
    .select('partnership_id, role, survey_reviewed, joined_at')
    .eq('user_id', userId)
  console.log(`partnership_members: ${memberships?.length || 0} row(s)`)
  console.log(memberships)

  const partnershipIds = (memberships || []).map((m) => m.partnership_id)

  // 4. partnerships (all of them — we want to see if there's a stale draft + a live)
  if (partnershipIds.length > 0) {
    const { data: partnerships } = await sb
      .from('partnerships')
      .select(
        'id, profile_type, membership_tier, profile_state, city, is_verified, haevn_insight, summaries_generated_at, created_at, updated_at'
      )
      .in('id', partnershipIds)
    header('PARTNERSHIPS')
    partnerships?.forEach((p) => {
      console.log({
        id: p.id,
        state: p.profile_state,
        tier: p.membership_tier,
        type: p.profile_type,
        city: p.city,
        is_verified: p.is_verified,
        has_summary: !!p.haevn_insight,
        summary_len: (p.haevn_insight || '').length,
        summaries_generated_at: p.summaries_generated_at,
        updated_at: p.updated_at,
      })
    })
  }

  // 5. user_survey_responses (newer) — keyed by user_id and partnership_id
  header('SURVEY RESPONSES')
  const { data: responses } = await sb
    .from('user_survey_responses')
    .select('partnership_id, completion_pct, updated_at')
    .eq('user_id', userId)
  if (!responses || responses.length === 0) {
    console.log('user_survey_responses: NONE for this user_id')
  } else {
    responses.forEach((r) => {
      console.log({
        partnership_id: r.partnership_id,
        completion_pct: r.completion_pct,
        updated_at: r.updated_at,
      })
    })
  }

  // 5b. one full row to inspect answers_json keys (don't dump the full thing)
  const { data: oneSurvey } = await sb
    .from('user_survey_responses')
    .select('answers_json')
    .eq('user_id', userId)
    .maybeSingle()
  if (oneSurvey?.answers_json) {
    const keys = Object.keys(oneSurvey.answers_json)
    console.log(`answers_json keys: ${keys.length} total`)
    console.log(`first 12 keys: ${keys.slice(0, 12).join(', ')}`)
    console.log(`q1_age value:`, oneSurvey.answers_json.q1_age)
  }

  // 6. partnership_photos
  if (partnershipIds.length > 0) {
    const { data: photos } = await sb
      .from('partnership_photos')
      .select('id, partnership_id, photo_type, is_primary, order_index')
      .in('partnership_id', partnershipIds)
    header(`PHOTOS (${photos?.length || 0})`)
    console.log(photos)
  }

  // 7. computed_matches — what /dashboard/matches reads
  if (partnershipIds.length > 0) {
    for (const pid of partnershipIds) {
      const { data: cm, error: cmErr } = await sb
        .from('computed_matches')
        .select('partnership_a, partnership_b, score, tier, engine_version, computed_at')
        .or(`partnership_a.eq.${pid},partnership_b.eq.${pid}`)
        .order('score', { ascending: false })
        .limit(30)
      if ((cm?.length || 0) === 0 && !cmErr) continue
      header(`COMPUTED MATCHES for ${pid} (${cm?.length || 0})`)
      if (cmErr) console.log('ERR:', cmErr.message)
      cm?.forEach((row) => {
        console.log({
          a: row.partnership_a,
          b: row.partnership_b,
          score: row.score,
          tier: row.tier,
          engine: row.engine_version,
          computed_at: row.computed_at,
        })
      })
    }
  }

  // 8. handshakes — connection requests / connections
  if (partnershipIds.length > 0) {
    for (const pid of partnershipIds) {
      const { data: hs, error: hsErr } = await sb
        .from('handshakes')
        .select('id, a_partnership, b_partnership, state, a_consent, b_consent, match_score')
        .or(`a_partnership.eq.${pid},b_partnership.eq.${pid}`)
      if ((hs?.length || 0) === 0 && !hsErr) continue
      header(`HANDSHAKES for ${pid} (${hs?.length || 0})`)
      if (hsErr) console.log('ERR:', hsErr.message)
      hs?.forEach((row) => console.log(row))
    }
  }

  // 9. user_onboarding (if it exists — not always present)
  const { data: ob, error: obErr } = await sb
    .from('user_onboarding')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  header('USER_ONBOARDING')
  if (obErr) console.log(`(table not present or RLS blocked: ${obErr.message})`)
  else console.log(ob)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(2)
})
