/**
 * buildRecomputeContext correctness + chunking. Run:
 *   npx tsx lib/services/__tests__/buildRecomputeContext.test.ts
 *
 * Verifies the hoisted context reproduces exactly what the per-partnership path
 * fetches — the invariant behind output parity:
 *   - members map covers the FULL live set INCLUDING self
 *   - surveys keyed by user over every live member
 *   - handshake adjacency is symmetric (either side excludes the other)
 *   - name fallback display_name → profiles.full_name → email
 *   - `.in()` is CHUNKED (a single 400-id query would exceed the URL limit and
 *     silently return nothing — the bug found during verification)
 */
import { buildRecomputeContext } from '../computeMatches'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

// ── tiny thenable Supabase mock ──
function makeMock() {
  const N = 400 // > 2 chunks at 150 → forces chunking
  const partnerships: any[] = []
  const members: any[] = []
  const surveys: any[] = []
  const profiles: any[] = []
  const authUsers: any[] = []

  for (let i = 0; i < N; i++) {
    const id = `p${i}`
    const uid = `u${i}`
    // p0 has a display_name; p1 is a couple with no display_name (profile fallback);
    // last-chunk p399 has neither name nor profile (email fallback).
    partnerships.push({
      id,
      profile_type: i === 1 ? 'couple' : 'single',
      city: 'Austin', msa: 'Austin', latitude: 30, longitude: -97,
      display_name: i === 0 ? 'Alpha' : null,
    })
    members.push({ partnership_id: id, user_id: uid })
    surveys.push({ user_id: uid, answers_json: { q: i }, completion_pct: 100 })
    if (i === 0) profiles.push({ user_id: uid, full_name: 'Alpha Owner' })
    if (i === 1) profiles.push({ user_id: uid, full_name: 'Bob' })
    // p399: no profile row → must fall back to email
    authUsers.push({ id: uid, email: `${uid}@x.com` })
  }
  // p1 is a couple: add a SECOND member with a completed survey (member-order edge)
  members.push({ partnership_id: 'p1', user_id: 'u1b' })
  surveys.push({ user_id: 'u1b', answers_json: { q: 'partner' }, completion_pct: 100 })
  authUsers.push({ id: 'u1b', email: 'u1b@x.com' })

  const handshakes = [{ a_partnership: 'p0', b_partnership: 'p1' }]

  const inCallCounts: Record<string, number> = {}

  const data: Record<string, any[]> = { partnerships, partnership_members: members, user_survey_responses: surveys, profiles, handshakes }

  function builder(table: string) {
    const state: any = { table, inCol: null, inVals: null }
    const b: any = {
      select() { return b },
      eq() { return b }, // profile_state filter — dataset already only "live"
      in(col: string, vals: string[]) { state.inCol = col; state.inVals = vals; inCallCounts[table] = (inCallCounts[table] || 0) + 1; return b },
      or() { return b },
      then(resolve: (r: any) => void) {
        let rows = data[table] || []
        if (state.inVals) rows = rows.filter((r: any) => state.inVals.includes(r[state.inCol]))
        resolve({ data: rows, error: null })
      },
    }
    return b
  }

  const client: any = {
    from: (t: string) => builder(t),
    auth: { admin: { listUsers: async () => ({ data: { users: authUsers } }) } },
  }
  return { client, inCallCounts, N }
}

async function main() {
  const { client, inCallCounts, N } = makeMock()
  const ctx = await buildRecomputeContext(client)

  // ── coverage ──
  eq(ctx.livePartnerships.length, N, 'all live partnerships loaded')
  eq(ctx.partnershipsById.get('p0')?.display_name, 'Alpha', 'partnership row by id')

  // ── members map covers self (p0 resolves its OWN members) ──
  ok((ctx.membersByPartnership.get('p0') || []).includes('u0'), 'members map includes self')
  // ── last-chunk partnership retrieved → chunking actually ran ──
  ok((ctx.membersByPartnership.get(`p${N - 1}`) || []).includes(`u${N - 1}`), 'last-chunk members retrieved (chunking works)')
  ok(inCallCounts['partnership_members'] > 1, 'partnership_members fetched in MULTIPLE chunks')

  // ── couple carries both members (member-order edge for survey selection) ──
  eq((ctx.membersByPartnership.get('p1') || []).sort(), ['u1', 'u1b'], 'couple has both members in order')

  // ── surveys keyed by user over every live member ──
  eq(ctx.surveyByUser.get('u0')?.completion_pct, 100, 'survey by user present')
  eq(ctx.surveyByUser.get('u1b')?.answers_json, { q: 'partner' }, 'second couple member survey present')
  eq(ctx.surveyByUser.size, N + 1, 'a survey row per member (incl 2nd couple member)')

  // ── name fallback chain ──
  eq(ctx.nameByPartnership.get('p0'), 'Alpha', 'name: display_name wins')
  eq(ctx.nameByPartnership.get('p1'), 'Bob', 'name: profiles.full_name fallback (no display_name)')
  eq(ctx.nameByPartnership.get(`p${N - 1}`), `u${N - 1}@x.com`, 'name: email fallback (no display_name/profile)')

  // ── handshake adjacency is symmetric ──
  ok((ctx.handshakesByPartnership.get('p0') || new Set()).has('p1'), 'handshake excludes other side (a→b)')
  ok((ctx.handshakesByPartnership.get('p1') || new Set()).has('p0'), 'handshake excludes other side (b→a)')
  ok(!(ctx.handshakesByPartnership.get('p2')), 'unrelated partnership has no exclusions')

  report('buildRecomputeContext')
}

main().catch((e) => { console.error(e); process.exit(1) })
