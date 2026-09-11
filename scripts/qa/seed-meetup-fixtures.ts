/**
 * Seed synthetic fixtures for the Meetup Spots QA harness. IDEMPOTENT.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE RUNNING. Vercel preview deployments for this project share
 * PRODUCTION's Supabase (one SUPABASE_SERVICE_ROLE_KEY across all three
 * environments), so these rows land in the production database.
 *
 * They are made harmless three ways, and all three matter:
 *   1. badges = ['QA_FIXTURE'] — lib/meetup/buildFeed excludes them from the
 *      feed unless QA_HARNESS_ENABLED=true, which production never sets. So the
 *      production nightly cron's pair_count is unaffected even while they exist.
 *   2. profile_state = 'draft' — the weekly recompute selects profile_state
 *      'live', so a fixture can never be matched against a real member, and the
 *      no-match ping audience never sees them.
 *   3. Every row is tagged and removed by scripts/qa/teardown-meetup-fixtures.ts.
 *
 * Never run this against a database you are not prepared to tear down from, and
 * always tear down in the same working session.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * WHAT IT CREATES — deliberately covering the cases the feed has to get right:
 *   AUSTIN-MARKET  TEST-Austin-Alpha / TEST-Austin-Bravo
 *       → live market, centroid resolves. One MATCH pair (score 88).
 *   PORTLAND-AREA  TEST-Portland-Charlie / TEST-Portland-Delta
 *       → pre-launch market, centroid resolves. One RECOMMENDATION pair (78).
 *   CENTROID-LESS  TEST-Centreville-Echo
 *       → deliberately a city cityCentroids.ts omits as ambiguous, so
 *         geo_unresolved must be true and the member must NOT be dropped.
 *       → paired with Austin-Alpha as a RECOMMENDATION (79) — a cross-market,
 *         half-unresolved pair, the awkward case.
 *   BELOW-THRESHOLD TEST-Austin-Foxtrot paired with Austin-Bravo at 70
 *       → below REC_MIN(77): must NOT appear in the feed at all.
 *   UNRELEASED     Austin-Alpha × Portland-Delta at 85, release_at in the FUTURE
 *       → must NOT appear: the feed is the RELEASED pair set only.
 *
 * Usage:  npx tsx scripts/qa/seed-meetup-fixtures.ts
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { QA_FIXTURE_BADGE } from '../../lib/meetup/qaFixtures'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
}) as any

/** Every fixture display_name starts with this. Teardown keys off it. */
export const FIXTURE_PREFIX = 'TEST-'
const EMAIL_DOMAIN = 'qa.invalid'

/** Survey answers the feed actually reads. Chosen to exercise each normalizer. */
const ANSWERS = {
  chatty: { q19a_max_distance: 'Within 25 miles', q19c_mobility: 'Very mobile', q18_substances: ['Social drinker'], q36_social_energy: 4 },
  local: { q19a_max_distance: 'Within my neighborhood', q19c_mobility: 'Prefer local', q18_substances: ['Sober'], q36_social_energy: 2 },
  flexible: { q19a_max_distance: 'Any distance', q19c_mobility: 'Flexible', q18_substances: ['Social drinker'], q36_social_energy: 5 },
  unknownish: { q19a_max_distance: 'whenever', q19c_mobility: 'teleport', q18_substances: [], q36_social_energy: null },
}

type Fixture = { key: string; city: string; answers: Record<string, unknown> }

const FIXTURES: Fixture[] = [
  { key: 'Austin-Alpha', city: 'Austin', answers: ANSWERS.chatty },
  { key: 'Austin-Bravo', city: 'Round Rock', answers: ANSWERS.local },
  { key: 'Austin-Foxtrot', city: 'Austin', answers: ANSWERS.flexible },
  { key: 'Portland-Charlie', city: 'Portland', answers: ANSWERS.flexible },
  { key: 'Portland-Delta', city: 'Beaverton', answers: ANSWERS.chatty },
  // Centreville is omitted from cityCentroids.ts on purpose (ambiguous across
  // several states). This is the geo_unresolved case, and the normalizers get
  // junk tokens so the unknown-token sink is exercised too.
  { key: 'Centreville-Echo', city: 'Centreville', answers: ANSWERS.unknownish },
]

const name = (k: string) => `${FIXTURE_PREFIX}${k}`
const HOUR = 3600_000

async function upsertFixture(f: Fixture): Promise<{ partnershipId: string; userId: string }> {
  const displayName = name(f.key)
  const email = `qa-${f.key.toLowerCase()}@${EMAIL_DOMAIN}`

  // Idempotent: reuse the existing partnership if this fixture already exists.
  const { data: existing } = await db.from('partnerships').select('id, owner_id').eq('display_name', displayName).maybeSingle()
  if (existing) {
    await db.from('user_survey_responses')
      .upsert({ user_id: existing.owner_id, answers_json: f.answers, completion_pct: 100 }, { onConflict: 'user_id' })
    console.log(`  = ${displayName} (exists) ${existing.id.slice(0, 8)}`)
    return { partnershipId: existing.id, userId: existing.owner_id }
  }

  // Reuse the auth user if a previous run left one behind.
  let userId: string | null = null
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) break
    const hit = data.users.find((u: any) => (u.email ?? '').toLowerCase() === email)
    if (hit) { userId = hit.id; break }
    if (data.users.length < 1000) break
  }
  if (!userId) {
    const { data: u, error } = await db.auth.admin.createUser({
      email, email_confirm: true, password: randomUUID(),
    })
    if (error) throw new Error(`createUser ${email}: ${error.message}`)
    userId = u.user.id
  }

  const { data: p, error: pe } = await db.from('partnerships').insert({
    owner_id: userId,
    display_name: displayName,
    city: f.city,
    membership_tier: 'free',
    profile_state: 'draft',   // never enters a recompute
    badges: [QA_FIXTURE_BADGE], // never enters the production feed
    phone: null,
  }).select('id').single()
  if (pe) throw new Error(`partnership ${displayName}: ${pe.message}`)

  await db.from('partnership_members').insert({ partnership_id: p.id, user_id: userId, role: 'owner' })
  await db.from('user_survey_responses')
    .upsert({ user_id: userId, answers_json: f.answers, completion_pct: 100 }, { onConflict: 'user_id' })

  console.log(`  + ${displayName.padEnd(26)} ${p.id.slice(0, 8)}  city=${f.city}`)
  return { partnershipId: p.id as string, userId: userId as string }
}

/** computed_matches rows are inserted directly — fixtures are never computed. */
async function upsertPair(a: string, b: string, score: number, opts: { released: boolean; label: string }) {
  const [smaller, larger] = a < b ? [a, b] : [b, a]
  const releaseAt = new Date(Date.now() + (opts.released ? -2 * HOUR : 72 * HOUR)).toISOString()
  const { error } = await db.from('computed_matches').upsert({
    partnership_a: smaller,
    partnership_b: larger,
    score,
    tier: score >= 85 ? 'Platinum' : score >= 80 ? 'Gold' : 'Silver',
    breakdown: {},
    computed_at: new Date().toISOString(),
    release_at: releaseAt,
    expires_at: new Date(Date.now() + 90 * 24 * HOUR).toISOString(),
    engine_version: 'qa-fixture',
  }, { onConflict: 'partnership_a,partnership_b' })
  if (error) throw new Error(`pair ${opts.label}: ${error.message}`)
  console.log(`  ${opts.released ? '+' : '·'} ${opts.label.padEnd(44)} score=${score} ${opts.released ? 'RELEASED' : 'future release (must be excluded)'}`)
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  console.log(`\nSEED — Meetup Spots QA fixtures`)
  console.log(`target: ${url}`)
  console.log(`NOTE: preview shares this database with production. Fixtures are`)
  console.log(`      badged ${QA_FIXTURE_BADGE} and profile_state='draft', so production`)
  console.log(`      cannot see them. Tear down in the same session.\n`)

  console.log('partnerships:')
  const made: Record<string, string> = {}
  for (const f of FIXTURES) made[f.key] = (await upsertFixture(f)).partnershipId

  console.log('\npairs:')
  await upsertPair(made['Austin-Alpha'], made['Austin-Bravo'], 88, { released: true, label: 'Austin-Alpha x Austin-Bravo (MATCH)' })
  await upsertPair(made['Portland-Charlie'], made['Portland-Delta'], 78, { released: true, label: 'Portland-Charlie x Portland-Delta (REC)' })
  await upsertPair(made['Austin-Alpha'], made['Centreville-Echo'], 79, { released: true, label: 'Austin-Alpha x Centreville-Echo (REC, geo_unresolved)' })
  await upsertPair(made['Austin-Bravo'], made['Austin-Foxtrot'], 70, { released: true, label: 'Austin-Bravo x Austin-Foxtrot (BELOW THRESHOLD)' })
  await upsertPair(made['Austin-Alpha'], made['Portland-Delta'], 85, { released: false, label: 'Austin-Alpha x Portland-Delta (UNRELEASED)' })

  console.log(`\nEXPECTED IN THE FEED (harness on): 3 pairs`)
  console.log(`  1 match  — Austin-Alpha x Austin-Bravo`)
  console.log(`  2 recs   — Portland pair, and the Centreville pair with one geo_unresolved member`)
  console.log(`EXPECTED ABSENT: the 70-score pair (below REC_MIN) and the future-release pair.`)
  console.log(`EXPECTED IN PRODUCTION: 0 of these — the badge gate excludes them.\n`)
}

main().catch((e) => { console.error('SEED FAILED:', e.message); process.exit(1) })
