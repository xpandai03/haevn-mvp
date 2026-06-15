/**
 * Explicit-ID Test-User Deletion for HAEVN
 * =========================================
 *
 * Deletes EXACTLY the user IDs listed in TEST_USER_IDS below, in correct
 * dependency order, and NOTHING else. There is intentionally NO domain or
 * email filter in this script — test and real users share the same email
 * domains (gmail.com, yahoo.com, att.net, example.com), so any filter is
 * unsafe. The operator generates and reviews the ID list (see the SQL at the
 * bottom of this file), pastes the reviewed IDs into TEST_USER_IDS, and runs
 * the script. Only those IDs are ever touched.
 *
 * SAFETY:
 *   - Dry-run is the DEFAULT. Nothing is deleted unless --confirm is passed.
 *   - Protected-ID guard: aborts if any PROTECTED_USER_IDS appear in the list.
 *   - Import-tagged guard: aborts if any target carries
 *     user_metadata.source = 'emergent_import', unless --allow-import-tagged.
 *   - Empty-list guard: exits if TEST_USER_IDS is empty.
 *
 * Usage:
 *   npx tsx scripts/delete-test-users-by-id.ts                       # dry-run (preview only)
 *   npx tsx scripts/delete-test-users-by-id.ts --dry-run             # dry-run (explicit)
 *   npx tsx scripts/delete-test-users-by-id.ts --confirm             # EXECUTE deletion
 *   npx tsx scripts/delete-test-users-by-id.ts --confirm --allow-import-tagged
 *
 * Run from the project root. Credentials come from .env.local
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). The service-role
 * client is required so deletes bypass RLS. POINT .env.local AT PRODUCTION
 * DELIBERATELY and take a Supabase snapshot before running with --confirm.
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

// =============================================================================
// THE LIST OF TEST USER IDS TO DELETE
// =============================================================================
// Raunek pastes the reviewed IDs here. ONLY these IDs are touched.
// Generate this list with the SQL at the bottom of this file, review the
// output one final time, then paste the `id` values below.
const TEST_USER_IDS: string[] = [
  // 'uuid-1',
  // 'uuid-2',
  // ...
]

// =============================================================================
// PROTECTED IDS (NEVER DELETE)
// =============================================================================
// Hard safety net: if any of these appear in TEST_USER_IDS, the script aborts
// before touching anything. Paste the IDs of confirmed real users here too —
// e.g. aliciaworley1st@gmail.com (100% survey, real), btaco@att.net (real
// partial signup), and any others kept during review.
const PROTECTED_USER_IDS: string[] = [
  // 'uuid-of-aliciaworley1st@gmail.com',
  // 'uuid-of-btaco@att.net',
  // ...
]

// =============================================================================
// HELPERS
// =============================================================================

const args = process.argv.slice(2)
const CONFIRM = args.includes('--confirm')
const DRY_RUN = !CONFIRM // dry-run is the default; --confirm is required to delete
const ALLOW_IMPORT_TAGGED = args.includes('--allow-import-tagged')

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Count rows in `table` where `column` IN ids (chunked to keep IN-lists sane). */
async function countIn(table: string, column: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  let total = 0
  for (const batch of chunk(ids, 200)) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .in(column, batch)
    if (error) throw new Error(`count ${table}.${column}: ${error.message}`)
    total += count ?? 0
  }
  return total
}

/** Delete rows in `table` where `column` IN ids. Returns deleted row count. */
async function deleteIn(table: string, column: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  let total = 0
  for (const batch of chunk(ids, 200)) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .in(column, batch)
      .select('*')
    if (error) throw new Error(`delete ${table}.${column}: ${error.message}`)
    total += data?.length ?? 0
  }
  return total
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('='.repeat(72))
  console.log(`HAEVN explicit-ID test-user deletion — mode: ${DRY_RUN ? 'DRY-RUN (no deletes)' : 'CONFIRM (DELETING)'}`)
  console.log('='.repeat(72))

  // ── Guard 1: empty list ──
  const ids = [...new Set(TEST_USER_IDS.map((s) => s.trim()).filter(Boolean))]
  if (ids.length === 0) {
    console.log('No IDs provided in TEST_USER_IDS. Nothing to do.')
    return
  }
  console.log(`TEST_USER_IDS: ${ids.length} unique id(s)`)

  // ── Guard 2: protected-ID overlap ──
  const protectedSet = new Set(PROTECTED_USER_IDS.map((s) => s.trim()).filter(Boolean))
  const collisions = ids.filter((id) => protectedSet.has(id))
  if (collisions.length > 0) {
    console.error('\n❌ ABORT — protected ID(s) present in TEST_USER_IDS:')
    collisions.forEach((id) => console.error(`   - ${id}`))
    console.error('Remove these from TEST_USER_IDS (they are confirmed real users) and re-run.')
    process.exit(1)
  }

  // ── Guard 3: import-tagged users (real/imported people) ──
  // Look up each target's auth record and flag any with source='emergent_import'.
  const importTagged: { id: string; email: string | undefined }[] = []
  const notFound: string[] = []
  for (const id of ids) {
    const { data, error } = await supabase.auth.admin.getUserById(id)
    if (error || !data?.user) {
      notFound.push(id)
      continue
    }
    const source = (data.user.user_metadata as any)?.source
    if (source === 'emergent_import') {
      importTagged.push({ id, email: data.user.email })
    }
  }

  if (notFound.length > 0) {
    console.warn(`\n⚠️  ${notFound.length} id(s) not found in auth.users (already deleted / wrong id):`)
    notFound.forEach((id) => console.warn(`   - ${id}`))
  }

  if (importTagged.length > 0) {
    console.warn(`\n⚠️  ${importTagged.length} target(s) are tagged source='emergent_import' (REAL/imported users):`)
    importTagged.forEach((u) => console.warn(`   - ${u.id}  ${u.email ?? ''}`))
    if (!ALLOW_IMPORT_TAGGED) {
      console.error(
        '\n❌ ABORT — refusing to delete import-tagged users. If this is intentional ' +
          '(e.g. the @example.com import-junk rows), re-run with --allow-import-tagged.'
      )
      process.exit(1)
    }
    console.warn('   --allow-import-tagged passed → proceeding with these included.')
  }

  // ── Resolve partnerships owned by / containing these users ──
  const memberPartIds: string[] = []
  for (const batch of chunk(ids, 200)) {
    const { data, error } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .in('user_id', batch)
    if (error) throw new Error(`resolve member partnerships: ${error.message}`)
    memberPartIds.push(...(data?.map((r) => r.partnership_id) ?? []))
  }
  const ownerPartIds: string[] = []
  for (const batch of chunk(ids, 200)) {
    const { data, error } = await supabase
      .from('partnerships')
      .select('id')
      .in('owner_id', batch)
    if (error) throw new Error(`resolve owned partnerships: ${error.message}`)
    ownerPartIds.push(...(data?.map((r) => r.id) ?? []))
  }
  const partIds = [...new Set([...memberPartIds, ...ownerPartIds])]
  console.log(`Resolved ${partIds.length} partnership(s) owned-by / member-of these users.\n`)

  // ── Preview / delete, in dependency order ──
  // Order mirrors scripts/seed-synthetic-users.ts cleanup() (lines 687-725):
  //   computed_matches (a, then b) → match_compute_runs → user_survey_responses
  //   → partnership_members → partnerships (cascades partnership-keyed tables)
  //   → profiles → auth.users (cascades remaining user-keyed tables).
  // Steps operating on `partIds` are skipped when there are no partnerships.

  type Step = { label: string; table: string; column: string; ids: string[] }
  const steps: Step[] = [
    { label: 'computed_matches (partnership_a)', table: 'computed_matches', column: 'partnership_a', ids: partIds },
    { label: 'computed_matches (partnership_b)', table: 'computed_matches', column: 'partnership_b', ids: partIds },
    { label: 'match_compute_runs', table: 'match_compute_runs', column: 'partnership_id', ids: partIds },
    { label: 'user_survey_responses', table: 'user_survey_responses', column: 'user_id', ids },
    { label: 'partnership_members', table: 'partnership_members', column: 'user_id', ids },
    { label: 'partnerships', table: 'partnerships', column: 'id', ids: partIds },
    { label: 'profiles', table: 'profiles', column: 'user_id', ids },
  ]

  if (DRY_RUN) {
    console.log('DRY-RUN — rows that WOULD be deleted (no changes made):')
    let grandTotal = 0
    for (const s of steps) {
      const n = await countIn(s.table, s.column, s.ids)
      grandTotal += n
      console.log(`  ${s.label.padEnd(34)} ${n}`)
    }
    console.log(`  ${'auth.users (via admin API)'.padEnd(34)} ${ids.length - notFound.length}`)
    console.log(`\nTotal dependent rows (excl. cascades): ${grandTotal}`)
    console.log(`Auth users that would be deleted: ${ids.length - notFound.length}`)
    console.log('\nNote: partnerships delete cascades hidden_matches, match_checkins,')
    console.log('ready_to_meet_signals, handshakes, signals, subscriptions, purchases,')
    console.log('partnership_invites. auth.users delete cascades messages, conversations,')
    console.log('profile_views, onboarding state, message_reads. These are not counted above.')
    console.log('\nRe-run with --confirm to execute.')
    return
  }

  // ── EXECUTE ──
  console.log('CONFIRM — deleting now.\n')
  for (const s of steps) {
    try {
      const n = await deleteIn(s.table, s.column, s.ids)
      console.log(`  deleted ${s.label.padEnd(34)} ${n}`)
    } catch (err: any) {
      console.error(`\n❌ Error during step "${s.label}": ${err.message}`)
      console.error('Stopping to avoid a half-deleted state. Inspect, then re-run.')
      process.exit(1)
    }
  }

  // ── auth.users: one-by-one via admin API so a single failure is visible ──
  let authDeleted = 0
  const authFailures: { id: string; error: string }[] = []
  for (const id of ids) {
    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) {
      authFailures.push({ id, error: error.message })
      console.error(`  ✗ auth.users ${id} — ${error.message}`)
    } else {
      authDeleted++
      console.log(`  ✓ auth.users ${id}`)
    }
  }

  console.log('\n' + '='.repeat(72))
  console.log(`Deleted ${authDeleted} auth users (target ${ids.length}).`)
  if (authDeleted !== ids.length) {
    console.warn(
      `⚠️  Count mismatch: ${ids.length - authDeleted} not deleted ` +
        `(${notFound.length} not found, ${authFailures.length} failed). Review above.`
    )
  } else {
    console.log('✓ Auth-user delete count matches TEST_USER_IDS.length.')
  }
  console.log('='.repeat(72))
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

/* =============================================================================
 * ID-LIST GENERATION QUERY (run in Supabase, review output, paste ids above)
 * =============================================================================
 * Returns confident test IDs, EXPLICITLY excluding confirmed real users by
 * email. List = seed accounts + junk-domain review accounts + obvious-test
 * consumer-email accounts, MINUS the real people. The @example.com import-
 * tagged junk (john.smith@example.com, sam@example.com) is intentionally NOT
 * included here — it is source='emergent_import' and must be decided on
 * separately (and would require --allow-import-tagged if ever included).
 *
 * SELECT id, email, raw_user_meta_data->>'full_name' AS name
 * FROM auth.users
 * WHERE
 *   ( raw_user_meta_data->>'seed' = 'true'
 *     OR email LIKE '%.test@haevn.co'
 *     OR email LIKE '%@haevn-seed.test'
 *     OR split_part(email,'@',2) IN (
 *       'tester.com','test.com','haevntest.com','tster.com','example.com',
 *       'fantasticfour.com','starwars.com','marvel.com','dceu.com','terminator.com',
 *       'fett.com','hutt.com','storm.com','troy.com','hardy.com','sins.com','luli.com',
 *       'ellijah.com','tampaguy.com','star.com','xpandai.com','xpandholdings.com',
 *       'wolfee.io','haevn.co','haevnmvp.com','haevn.app','lightdash.com',
 *       'cloudsteer.com','fxzig.com','swftbars.com','xcode.com','team.softpers.com'
 *     )
 *     OR email IN (
 *       'raunek.pratap7@gmail.com','raunek2k@gmail.com','raunek@gmail.com',
 *       'raunekpratap7@gmail.com','rikfoote@yahoo.com','jake.php@gmail.com',
 *       'bolson2224@gmail.com','fantasticfour@gmail.com','jonasbros@gmail.com',
 *       'harambe@gmail.com','stormtest@gmail.com','mamacita@gmail.com',
 *       'tester32@gmail.com','tester38@gmail.com','holo@gmail.com','solo2@gmail.com',
 *       'indianajones@gmail.com','jabbathehutt@gmail.com','jetex@gmail.com',
 *       'rambost@gmail.com','marcus.haven@gmail.com'
 *     )
 *   )
 *   -- HARD EXCLUSIONS: never delete confirmed real users
 *   AND email NOT IN (
 *     'aliciaworley1st@gmail.com',  -- 100% survey, real
 *     'btaco@att.net',              -- real partial signup
 *     'rachsch@yahoo.com',          -- keep unless confirmed test
 *     'jasixxd407@gmail.com',       -- keep unless confirmed test
 *     'tampajake@yahoo.com'         -- keep unless confirmed test
 *   )
 * ORDER BY email;
 *
 * After review, also paste the IDs of the hard-excluded real users into
 * PROTECTED_USER_IDS above as a second safety net.
 * ============================================================================= */
