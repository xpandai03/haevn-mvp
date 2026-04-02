/**
 * Seed Synthetic Users for HAEVN Matching Tests
 *
 * Creates N pairs of synthetic users directly in the database with
 * controlled survey answers to produce deterministic match results.
 *
 * Usage:
 *   npx tsx scripts/seed-synthetic-users.ts                  # 5 high-match pairs
 *   npx tsx scripts/seed-synthetic-users.ts --pairs 10       # 10 pairs
 *   npx tsx scripts/seed-synthetic-users.ts --mode medium    # ~70% match pairs
 *   npx tsx scripts/seed-synthetic-users.ts --mode mismatch  # gate-fail pairs
 *   npx tsx scripts/seed-synthetic-users.ts --cleanup        # delete all seeded users
 *   npx tsx scripts/seed-synthetic-users.ts --real-sms       # assign real phone numbers for SMS testing
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Marker to identify seeded users for cleanup
const SEED_PREFIX = 'seed-test'
const SEED_DOMAIN = 'haevn-seed.test'

// =============================================================================
// REALISTIC USER NAMES
// =============================================================================

const REAL_NAMES = [
  'Marcus Rivera',
  'Elena Vasquez',
  'Sofia Chen',
  'Daniel Kim',
  'Ava Thompson',
  'Lucas Bennett',
  'Maya Patel',
  'Noah Williams',
  'Emma Garcia',
  'Leo Martinez',
  'Zara Mitchell',
  'Kai Nakamura',
  'Isla Reeves',
  'Remy Delacroix',
  'Luna Okafor',
  'Jaden Park',
  'Sienna Alvarez',
  'Theo Bergstrom',
  'Nadia Moreau',
  'Callum Rhodes',
]

/** Get a realistic name for a given user index. */
function getRealisticName(index: number): { fullName: string; firstName: string; email: string } {
  const fullName = REAL_NAMES[index % REAL_NAMES.length]
  const firstName = fullName.split(' ')[0]
  const emailSlug = fullName.toLowerCase().replace(' ', '.')
  return {
    fullName,
    firstName,
    email: `${emailSlug}.test@haevn.co`,
  }
}

// =============================================================================
// PHONE ROUTING FOR SMS TESTING
// =============================================================================

// Real phone numbers (E.164 format) for receiving test SMS via Twilio.
// Only assigned when --real-sms flag is present.
const TEST_PHONE_A = '+18184369821'  // Raunek
const TEST_PHONE_B = '+19208091907'  // Rick
const DUMMY_PHONE  = '+15005550006'  // Twilio test number (no real SMS sent)

// =============================================================================
// ANSWER TEMPLATES
// =============================================================================

/** Base answers that pass all P0 gates and score high.
 *  Tuned to maximize every sub-score across all 5 categories.
 *  Both users get identical answers → max overlap bonuses.
 *
 *  IMPORTANT: String values must match the tier arrays in the scoring
 *  engine exactly (case-insensitive). Display strings like "Several times
 *  a week" resolve to unknown → 50 score. Use tier values directly.
 */
function baseAnswers(index: number): Record<string, any> {
  return {
    // ── Demographics ──
    q1_age: '1990-05-15',
    q2_gender_identity: 'Non-binary',
    q2a_pronouns: 'they/them',
    q3_sexual_orientation: ['Bisexual', 'Pansexual'],
    q3a_fidelity: 'open_communication',
    q3b_kinsey_scale: '3',                      // same Kinsey → 100
    q3c_partner_kinsey_preference: ['No preference'],
    q4_relationship_status: 'partnered',         // must match exactly

    // ── Relationship Preferences ──
    q6_relationship_styles: ['ENM', 'Polyamorous'],
    q6a_connection_type: ['As an individual'],
    q6b_who_to_meet: ['Individuals', 'Couples'],
    q6c_couple_connection: 'Mix together + solo',
    q6d_couple_permissions: 'equal_autonomy',
    q7_emotional_exclusivity: 'flexible',        // EXCLUSIVITY_TIERS value
    q8_sexual_exclusivity: 'open',               // EXCLUSIVITY_TIERS value
    q9_intentions: ['Long-term partnership', 'Community', 'Friendship'],
    q9a_sex_or_more: 'both_equally',
    q9b_dating_readiness: 'ready',

    // ── Communication & Connection ──
    q10_attachment_style: 'secure',              // ATTACHMENT_TIERS value
    q10a_emotional_availability: 'very_available', // AVAILABILITY_TIERS value
    q11_love_languages: ['Quality time', 'Physical touch', 'Words of affirmation'],
    q12_conflict_resolution: 'collaborative',    // CONFLICT_TIERS value → 15% bonus
    q12a_messaging_pace: 'moderate',             // MESSAGING_PACE_TIERS value

    // ── Lifestyle & Values ──
    q13_lifestyle_alignment: 'important',        // LIFESTYLE_IMPORTANCE_TIERS value
    q13a_languages: 'English',
    q14a_cultural_alignment: 7,
    q14b_cultural_identity: 'Progressive, open-minded.',
    q15_time_availability: 'weekly',
    q16_typical_availability: ['Weekday evenings', 'Weekends'],
    q16a_first_meet_preference: 'Walk or coffee',
    // Q17/Q17a/Q17b use CSV keys (no internal mapping exists)
    Q17: 'no_children',                          // CHILDREN_TIERS value
    Q17a: ['omnivore'],                           // shared → overlap bonus
    Q17b: 'has_pets',                             // same → 100
    q18_substances: 'social_drinker',            // SUBSTANCE_TIERS value (single)
    q19a_max_distance: 'within_30_miles',        // DISTANCE_TIERS value
    q19b_distance_priority: 'moderate',
    q19c_mobility: 'often',                      // TRAVEL_TIERS value

    // ── Privacy & Community ──
    q20_discretion: 'moderate',                  // PRIVACY_TIERS value
    q20a_photo_sharing: 'After chatting',
    q20b_how_out: 'selective',                   // VISIBILITY_TIERS value
    q21_platform_use: ['Dating', 'Community', 'Exploration'],
    q22_spirituality_sexuality: 'Somewhat connected',

    // ── Intimacy & Sexuality ──
    q23_erotic_styles: ['Sensual', 'Playful', 'Romantic'],
    q24_experiences: ['Private encounters', 'Workshops'],
    q25_chemistry_vs_emotion: 'both_equally',
    q25a_frequency: 'few_times_week',            // FREQUENCY_TIERS value
    q26_roles: ['Verse/Switch'],
    q27_body_type_self: 'Athletic / fit',
    q27_body_type_preferences: ['Athletic / fit', 'Average build', 'Curvy / soft'],
    q28_hard_boundaries: ['Degradation'],
    q29_maybe_boundaries: ['Exhibitionism'],
    q30_safer_sex: ['Regular testing', 'Discussion before intimacy'],
    q30a_fluid_bonding: 'open_to_it',
    q31_health_testing: 'quarterly',

    // ── Personal Expression ──
    q32_looking_for: 'Looking for genuine connections with like-minded people.',
    q33_kinks: ['Sensory play', 'Role play', 'Bondage'],
    q33a_experience_level: 'experienced',

    // ── Personality Insights (identical → max proximity) ──
    q34_exploration: 7,
    q34a_variety: 7,
    q35_agreements: 7,
    q35a_structure: 5,
    q36_social_energy: 'ambivert',              // SOCIAL_ENERGY_TIERS value
    q36a_outgoing: 'ambivert',                  // same → 100
    q37_empathy: 'very_high',                   // EMPATHY_TIERS → both high = 15% bonus
    q37a_harmony: 'high',
    q38_jealousy: 'very_low',                   // both low → 10% bonus
    q38a_emotional_reactive: 'low',             // REACTIVITY_TIERS value

    // ── Emotional scales (1-5 range, same values → 100%) ──
    q_emotional_pace: 3,
    q_emotional_engagement: 3,
    q_independence_balance: 3,

    // ── P0 gate fields ──
    q_age_min: 21,
    q_age_max: 55,
    q_race_identity: ['any'],
    q_race_preference: ['any'],

    // ── Location metadata (Austin, TX — close together) ──
    _latitude: 30.2672 + (index * 0.0001),
    _longitude: -97.7431 + (index * 0.0001),
  }
}

/** High-match: identical answers (expect 85-95%) */
function highMatchAnswers(pairIndex: number, memberIndex: number): Record<string, any> {
  return baseAnswers(pairIndex * 2 + memberIndex)
}

/** Medium-match: diverge on personality/lifestyle (expect ~70%) */
function mediumMatchAnswers(pairIndex: number, memberIndex: number): Record<string, any> {
  const answers = baseAnswers(pairIndex * 2 + memberIndex)
  if (memberIndex === 1) {
    // Diverge personality traits
    answers.q34_exploration = 3
    answers.q34a_variety = 3
    answers.q36_social_energy = 'introverted'
    answers.q36a_outgoing = 'introverted'
    answers.q37_empathy = 'moderate'
    answers.q10a_emotional_availability = 'limited'
    answers.q25_chemistry_vs_emotion = 'chemistry_more'
    answers.q12_conflict_resolution = 'passive'
    answers.q15_time_availability = 'monthly'
    answers.q11_love_languages = ['Acts of service']
  }
  return answers
}

/** Mismatch: trip P0 gates (expect gate failure / 0%) */
function mismatchAnswers(pairIndex: number, memberIndex: number): Record<string, any> {
  const answers = baseAnswers(pairIndex * 2 + memberIndex)
  if (memberIndex === 1) {
    // Trip core intent gate: no overlap on Q9
    answers.q9_intentions = ['Casual fun']
    // Trip age gate
    answers.q_age_min = 50
    answers.q_age_max = 65
    // Trip distance gate: put them 500 miles apart
    answers._latitude = 40.7128
    answers._longitude = -74.006
  }
  return answers
}

type SeedMode = 'high' | 'medium' | 'mismatch'

function getAnswers(mode: SeedMode, pairIndex: number, memberIndex: number): Record<string, any> {
  switch (mode) {
    case 'high': return highMatchAnswers(pairIndex, memberIndex)
    case 'medium': return mediumMatchAnswers(pairIndex, memberIndex)
    case 'mismatch': return mismatchAnswers(pairIndex, memberIndex)
  }
}

// =============================================================================
// SEEDING LOGIC
// =============================================================================

const COMPLETED_SECTIONS = [
  'basic_demographics',
  'relationship_preferences',
  'communication_attachment',
  'lifestyle_values',
  'privacy_community',
  'intimacy_sexuality',
  'personal_expression',
  'personality_insights',
]

interface SeededUser {
  userId: string
  email: string
  partnershipId: string
}

async function createSeededUser(
  label: string,
  pairIndex: number,
  memberIndex: number,
  mode: SeedMode,
  realSms: boolean = false
): Promise<SeededUser | null> {
  // Use realistic human names instead of "User A (high pair 0, member 0)"
  const globalIndex = pairIndex * 2 + memberIndex
  const persona = getRealisticName(globalIndex)
  const email = persona.email
  const displayName = persona.firstName
  const fullName = persona.fullName

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: 'SeedTest123!',
    email_confirm: true,
    user_metadata: { full_name: fullName, seed: true },
  })

  if (authError) {
    // If user already exists, find them
    if (authError.message?.includes('already been registered')) {
      console.log(`  User ${email} already exists, looking up...`)
      const { data: listData } = await supabase.auth.admin.listUsers()
      const existing = listData?.users?.find(u => u.email === email)
      if (existing) {
        // Find their partnership
        const { data: membership } = await supabase
          .from('partnership_members')
          .select('partnership_id')
          .eq('user_id', existing.id)
          .single()
        if (membership) {
          return { userId: existing.id, email, partnershipId: membership.partnership_id }
        }
      }
    }
    console.error(`  Failed to create user ${email}:`, authError.message)
    return null
  }

  const userId = authData.user.id
  console.log(`  Created auth user: ${email} (${userId})`)

  // 2. Ensure profile exists
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      user_id: userId,
      email: email,
      full_name: fullName,
      city: 'Austin',
      survey_complete: true,
      msa_status: 'live',
    }, { onConflict: 'user_id' })

  if (profileError) {
    console.error(`  Failed to create profile:`, profileError.message)
  }

  // 3. Create partnership (with phone for SMS testing)
  const phone = realSms
    ? (memberIndex === 0 ? TEST_PHONE_A : TEST_PHONE_B)
    : DUMMY_PHONE

  const { data: partnership, error: partnershipError } = await supabase
    .from('partnerships')
    .insert({
      owner_id: userId,
      profile_type: 'solo',
      profile_state: 'live',
      membership_tier: 'free',
      city: 'Austin',
      msa: 'Austin-Round Rock-Georgetown, TX',
      display_name: displayName,
      latitude: getAnswers(mode, pairIndex, memberIndex)._latitude,
      longitude: getAnswers(mode, pairIndex, memberIndex)._longitude,
      phone,
    })
    .select('id')
    .single()

  if (partnershipError || !partnership) {
    console.error(`  Failed to create partnership:`, partnershipError?.message)
    return null
  }

  console.log(`  Created partnership: ${partnership.id} (phone: ${phone})`)

  // 4. Link user to partnership
  const { error: memberError } = await supabase
    .from('partnership_members')
    .insert({
      partnership_id: partnership.id,
      user_id: userId,
      role: 'owner',
      survey_reviewed: true,
      survey_reviewed_at: new Date().toISOString(),
    })

  if (memberError) {
    console.error(`  Failed to create membership:`, memberError.message)
  }

  // 5. Insert survey responses
  const answers = getAnswers(mode, pairIndex, memberIndex)
  const { error: surveyError } = await supabase
    .from('user_survey_responses')
    .upsert({
      user_id: userId,
      partnership_id: partnership.id,
      answers_json: answers,
      completion_pct: 100,
      current_step: 0,
      completed_sections: COMPLETED_SECTIONS,
    }, { onConflict: 'user_id' })

  if (surveyError) {
    console.error(`  Failed to insert survey:`, surveyError.message)
    return null
  }

  console.log(`  Survey populated (${Object.keys(answers).length} answers)`)

  return { userId, email, partnershipId: partnership.id }
}

async function triggerMatchCompute(partnershipId: string): Promise<void> {
  // Create a run record
  const { data: run } = await supabase
    .from('match_compute_runs')
    .insert({
      partnership_id: partnershipId,
      trigger: 'seed_script',
      status: 'queued',
    })
    .select('id')
    .single()

  const runId = run?.id ?? null

  // Call the compute endpoint via the API
  // Since computeMatchesForPartnership is a server action, we call it via API
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  try {
    const response = await fetch(`${baseUrl}/api/admin/compute-matches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-role-key': SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({ partnershipId, runId }),
    })

    if (response.ok) {
      const result = await response.json()
      console.log(`  Compute result: ${result.matchesComputed ?? 0} matches, ${result.candidatesEvaluated ?? 0} candidates`)
    } else {
      console.log(`  Compute API returned ${response.status} — will try direct import fallback`)
      await computeMatchesDirect(partnershipId, runId)
    }
  } catch {
    console.log(`  API not reachable — using direct import fallback`)
    await computeMatchesDirect(partnershipId, runId)
  }
}

/** Direct import fallback — works when running from project root with tsx */
async function computeMatchesDirect(partnershipId: string, runId: string | null): Promise<void> {
  try {
    // Dynamic import to avoid 'use server' issues at top level
    const mod = await import('../lib/services/computeMatches')
    const result = await mod.computeMatchesForPartnership(partnershipId, runId)
    console.log(`  Direct compute: ${result.matchesComputed} matches, ${result.candidatesEvaluated} candidates, success=${result.success}`)
    if (result.error) console.log(`  Error: ${result.error}`)
  } catch (err: any) {
    console.error(`  Direct compute failed:`, err.message)
    console.log(`  You may need to run match computation manually via the admin panel.`)
  }
}

// =============================================================================
// CLEANUP
// =============================================================================

async function cleanup(): Promise<void> {
  console.log('\nCleaning up seeded users...')

  // Find all seed users by metadata marker or email pattern
  const { data: listData } = await supabase.auth.admin.listUsers()
  const seedUsers = listData?.users?.filter(u =>
    u.user_metadata?.seed === true ||
    u.email?.endsWith(`@${SEED_DOMAIN}`) ||
    u.email?.endsWith('.test@haevn.co')
  ) ?? []

  if (seedUsers.length === 0) {
    console.log('No seeded users found.')
    return
  }

  console.log(`Found ${seedUsers.length} seeded users`)

  const userIds = seedUsers.map(u => u.id)

  // Delete in dependency order
  // 1. computed_matches (references partnerships)
  const { data: partnerships } = await supabase
    .from('partnership_members')
    .select('partnership_id')
    .in('user_id', userIds)

  const partnershipIds = [...new Set(partnerships?.map(p => p.partnership_id) ?? [])]

  if (partnershipIds.length > 0) {
    await supabase.from('computed_matches').delete().in('partnership_a', partnershipIds)
    await supabase.from('computed_matches').delete().in('partnership_b', partnershipIds)
    await supabase.from('match_compute_runs').delete().in('partnership_id', partnershipIds)
    console.log(`  Deleted computed_matches and runs for ${partnershipIds.length} partnerships`)
  }

  // 2. user_survey_responses
  await supabase.from('user_survey_responses').delete().in('user_id', userIds)
  console.log(`  Deleted survey responses`)

  // 3. partnership_members
  await supabase.from('partnership_members').delete().in('user_id', userIds)
  console.log(`  Deleted partnership members`)

  // 4. partnerships
  if (partnershipIds.length > 0) {
    await supabase.from('partnerships').delete().in('id', partnershipIds)
    console.log(`  Deleted partnerships`)
  }

  // 5. profiles
  await supabase.from('profiles').delete().in('user_id', userIds)
  console.log(`  Deleted profiles`)

  // 6. auth users
  for (const user of seedUsers) {
    await supabase.auth.admin.deleteUser(user.id)
  }
  console.log(`  Deleted ${seedUsers.length} auth users`)

  console.log('\nCleanup complete!')
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2)

  // Handle --cleanup flag
  if (args.includes('--cleanup')) {
    await cleanup()
    return
  }

  // Parse arguments
  const pairsIdx = args.indexOf('--pairs')
  const numPairs = pairsIdx !== -1 ? parseInt(args[pairsIdx + 1], 10) : 5

  const modeIdx = args.indexOf('--mode')
  const modeArg = modeIdx !== -1 ? args[modeIdx + 1] : 'high'
  const mode: SeedMode = (['high', 'medium', 'mismatch'].includes(modeArg) ? modeArg : 'high') as SeedMode

  // Handle --release flag (set release_at = NOW instead of next Monday)
  const forceRelease = args.includes('--release')

  // Handle --real-sms flag (assign real phone numbers for Twilio SMS testing)
  const realSms = args.includes('--real-sms')

  console.log(`\n=== HAEVN Synthetic User Seeder ===`)
  console.log(`Mode: ${mode} | Pairs: ${numPairs} | Force release: ${forceRelease} | Real SMS: ${realSms}`)
  if (realSms) {
    console.log(`SMS routing: User A → ${TEST_PHONE_A} | User B → ${TEST_PHONE_B}`)
  }
  console.log(`Seed email domain: @${SEED_DOMAIN}\n`)

  const allUsers: SeededUser[] = []

  for (let p = 0; p < numPairs; p++) {
    console.log(`\n--- Pair ${p + 1} of ${numPairs} ---`)

    const userA = await createSeededUser('User A', p, 0, mode, realSms)
    const userB = await createSeededUser('User B', p, 1, mode, realSms)

    if (userA) allUsers.push(userA)
    if (userB) allUsers.push(userB)
  }

  // Trigger match computation for each partnership
  console.log(`\n--- Computing matches ---`)
  for (const user of allUsers) {
    console.log(`\nComputing for ${user.email} (partnership ${user.partnershipId})`)
    await triggerMatchCompute(user.partnershipId)
  }

  // Optionally force-release matches (make them visible immediately)
  if (forceRelease) {
    console.log(`\n--- Force-releasing matches ---`)
    const partnershipIds = allUsers.map(u => u.partnershipId)
    let totalReleased = 0
    for (const pid of partnershipIds) {
      const { data, error } = await supabase
        .from('computed_matches')
        .update({ release_at: new Date().toISOString() })
        .eq('partnership_a', pid)
        .select('id')
      if (error) {
        console.error(`  Release error for ${pid}:`, error.message)
      } else {
        totalReleased += data?.length ?? 0
      }
    }
    console.log(`Released ${totalReleased} matches`)
  }

  // Summary
  console.log(`\n=== Summary ===`)
  console.log(`Created ${allUsers.length} users in ${numPairs} pairs`)
  console.log(`Mode: ${mode}`)
  console.log(`\nSeeded users:`)
  for (const u of allUsers) {
    console.log(`  ${u.email} → partnership ${u.partnershipId}`)
  }
  console.log(`\nTo clean up: npx tsx scripts/seed-synthetic-users.ts --cleanup`)
}

main().catch(console.error)
