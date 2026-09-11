/**
 * Remove everything scripts/qa/seed-meetup-fixtures.ts created. IDEMPOTENT.
 *
 * Removal is BY TAG, never by a hardcoded id list, so a partially-failed seed
 * still cleans up completely and re-running is always safe.
 *
 * Order matters: computed_matches and partnership_members reference the
 * partnerships, and the auth user must go last.
 *
 * Also clears the QA receiver's stored payloads (system_events of type
 * qa_meetup_received). Pass --keep-received to leave them for inspection.
 *
 * Usage:  npx tsx scripts/qa/teardown-meetup-fixtures.ts [--keep-received]
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { QA_FIXTURE_BADGE, QA_RECEIVED_EVENT } from '../../lib/meetup/qaFixtures'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
}) as any

const FIXTURE_PREFIX = 'TEST-'
const EMAIL_DOMAIN = 'qa.invalid'
const keepReceived = process.argv.includes('--keep-received')

async function main() {
  console.log(`\nTEARDOWN — Meetup Spots QA fixtures`)
  console.log(`target: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`)

  // 1. Fixture partnerships, found two ways so a row that lost one marker is
  //    still caught: the display_name prefix AND the badge.
  const { data: byName } = await db.from('partnerships').select('id, owner_id, display_name, badges')
    .ilike('display_name', `${FIXTURE_PREFIX}%`)
  const { data: byBadge } = await db.from('partnerships').select('id, owner_id, display_name, badges')
    .contains('badges', [QA_FIXTURE_BADGE])

  const byId = new Map<string, any>()
  for (const p of [...(byName ?? []), ...(byBadge ?? [])]) byId.set(p.id, p)
  const fixtures = [...byId.values()]
  console.log(`fixture partnerships found: ${fixtures.length}`)
  for (const f of fixtures) console.log(`  - ${f.display_name} ${f.id.slice(0, 8)}`)

  if (fixtures.length) {
    const ids = fixtures.map((f) => f.id)

    // 2. computed_matches referencing a fixture on EITHER side.
    let pairsDeleted = 0
    for (const col of ['partnership_a', 'partnership_b']) {
      const { data } = await db.from('computed_matches').delete().in(col, ids).select('id')
      pairsDeleted += data?.length ?? 0
    }
    console.log(`computed_matches rows deleted: ${pairsDeleted}`)

    // 3. Any handshakes/messages a manual test may have created against them.
    for (const col of ['a_partnership', 'b_partnership']) {
      const { data: hs } = await db.from('handshakes').select('id').in(col, ids)
      for (const h of hs ?? []) {
        await db.from('messages').delete().eq('handshake_id', h.id)
        await db.from('handshakes').delete().eq('id', h.id)
      }
    }

    // 4. members, surveys, partnerships, then the auth users.
    await db.from('partnership_members').delete().in('partnership_id', ids)
    const ownerIds = fixtures.map((f) => f.owner_id).filter(Boolean)
    if (ownerIds.length) await db.from('user_survey_responses').delete().in('user_id', ownerIds)
    await db.from('partnerships').delete().in('id', ids)
    console.log(`partnerships deleted: ${ids.length}`)

    for (const uid of ownerIds) {
      const { error } = await db.auth.admin.deleteUser(uid)
      if (error) console.warn(`  auth user ${uid.slice(0, 8)}: ${error.message}`)
    }
    console.log(`auth users deleted: ${ownerIds.length}`)
  }

  // 5. Any stray QA auth user whose partnership was already gone.
  let stray = 0
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) break
    for (const u of data.users) {
      if ((u.email ?? '').endsWith(`@${EMAIL_DOMAIN}`)) {
        await db.from('user_survey_responses').delete().eq('user_id', u.id)
        await db.auth.admin.deleteUser(u.id)
        stray++
      }
    }
    if (data.users.length < 1000) break
  }
  console.log(`stray @${EMAIL_DOMAIN} users deleted: ${stray}`)

  // 6. Receiver records.
  if (keepReceived) {
    const { data } = await db.from('system_events').select('id').eq('event_type', QA_RECEIVED_EVENT)
    console.log(`receiver records KEPT (--keep-received): ${data?.length ?? 0}`)
  } else {
    const { data } = await db.from('system_events').delete().eq('event_type', QA_RECEIVED_EVENT).select('id')
    console.log(`receiver records deleted: ${data?.length ?? 0}`)
  }

  // 7. Prove it.
  const { data: leftName } = await db.from('partnerships').select('id').ilike('display_name', `${FIXTURE_PREFIX}%`)
  const { data: leftBadge } = await db.from('partnerships').select('id').contains('badges', [QA_FIXTURE_BADGE])
  const clean = (leftName?.length ?? 0) === 0 && (leftBadge?.length ?? 0) === 0
  console.log(`\nremaining fixtures: ${(leftName?.length ?? 0) + (leftBadge?.length ?? 0)} ${clean ? '✓ clean' : '✗ NOT CLEAN'}`)
  process.exitCode = clean ? 0 : 1
}

main().catch((e) => { console.error('TEARDOWN FAILED:', e.message); process.exit(1) })
