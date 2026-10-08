/**
 * Member photo read path: stored photo_url, used as-is, on every surface.
 * Run: npx tsx lib/photos/__tests__/photoReadPath.test.ts
 *
 *  1. The helper returns the stored URL for a member with a photo, null without
 *     one — against a fake client that, like prod, rejects `storage_path`.
 *  2. That URL renders as a real <img> on the match card (MatchCard) and the
 *     dashboard card (ProfileCard), and drives the connections avatar
 *     (ConnectionCard); no photo renders the silhouette / initials fallback.
 *  3. Structural: no `storage_path` anywhere, and URL reconstruction
 *     (getPublicUrl, the partnership-photos bucket) only on upload paths —
 *     so the bug cannot creep back onto a read path.
 */
import * as React from 'react'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { eq, ok, report } from '@/lib/metrics/__tests__/_assert'
import { fetchPrimaryPhotoUrl, fetchPrimaryPhotoUrls, storedPhotoUrl } from '../primaryPhoto'

// Components are compiled with the classic JSX runtime under tsx.
;(globalThis as unknown as { React: typeof React }).React = React

const WITH = 'aaaaaaaa-0000-4000-8000-000000000001'
const WITHOUT = 'bbbbbbbb-0000-4000-8000-000000000002'
const URL_WITH = `https://example.supabase.co/storage/v1/object/public/public-photos/${WITH}/1700000000000_a.jpg`

type Row = Record<string, unknown>
const PHOTO_ROWS: Row[] = [
  { partnership_id: WITH, photo_url: URL_WITH, photo_type: 'public', is_primary: true },
  { partnership_id: WITH, photo_url: `${URL_WITH}?second`, photo_type: 'public', is_primary: false },
  { partnership_id: WITHOUT + '-other', photo_url: 'https://elsewhere/x.jpg', photo_type: 'public', is_primary: true },
]

/** Minimal PostgREST-shaped fake. Selecting a column that doesn't exist errors (42703) — as prod does. */
function fakeClient(rows: Row[]) {
  const selects: string[] = []
  const client = {
    selects,
    from(table: string) {
      if (table !== 'partnership_photos') throw new Error(`unexpected table ${table}`)
      let cols: string[] = []
      const filters: Array<(r: Row) => boolean> = []
      const run = () => {
        if (cols.some((c) => !['partnership_id', 'photo_url', 'photo_type', 'is_primary', 'created_at', 'nsfw_flag'].includes(c))) {
          return { data: null, error: { code: '42703', message: 'column does not exist' } }
        }
        const data = rows.filter((r) => filters.every((f) => f(r))).map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])))
        return { data, error: null }
      }
      const q: any = {
        select(s: string) {
          selects.push(s)
          cols = s.split(',').map((c) => c.trim())
          return q
        },
        eq(col: string, v: unknown) {
          filters.push((r) => r[col] === v)
          return q
        },
        in(col: string, vs: unknown[]) {
          filters.push((r) => vs.includes(r[col]))
          return q
        },
        maybeSingle() {
          const r = run()
          if (r.error) return Promise.resolve(r)
          return Promise.resolve({ data: r.data![0] ?? null, error: null })
        },
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve(run()).then(resolve)
        },
      }
      return q
    },
  }
  return client
}

async function main() {
  // ── 1. Helper ──────────────────────────────────────────────────────────────
  const db = fakeClient(PHOTO_ROWS)
  eq(await fetchPrimaryPhotoUrl(db, WITH), URL_WITH, 'member with a photo → stored photo_url, as-is')
  eq(await fetchPrimaryPhotoUrl(db, WITHOUT), null, 'member without a photo → null')
  const batch = await fetchPrimaryPhotoUrls(db, [WITH, WITHOUT])
  eq([...batch.entries()], [[WITH, URL_WITH]], 'batch: only members with a primary photo, URL as-is')
  eq((await fetchPrimaryPhotoUrls(db, [])).size, 0, 'batch of none → empty, no query')
  ok(db.selects.every((s) => s.includes('photo_url') && !s.includes('storage_path')), 'helper selects photo_url, never storage_path')
  eq(storedPhotoUrl({ photo_url: '  ' }), null, 'blank stored URL → null')
  eq(storedPhotoUrl(null), null, 'no row → null')

  // The pre-fix query, for contrast: the column error yields no data → silhouette everywhere.
  const legacy = await fakeClient(PHOTO_ROWS).from('partnership_photos').select('storage_path').eq('partnership_id', WITH).eq('is_primary', true).eq('photo_type', 'public').maybeSingle()
  ok(legacy.data === null && legacy.error?.code === '42703', 'regression baseline: selecting storage_path returns no data (42703)')

  // ── 2. Surfaces ────────────────────────────────────────────────────────────
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime')
  const { MatchCard } = await import('@/components/matches/MatchCard')
  const { ProfileCard } = await import('@/components/dashboard/ProfileCard')
  const { ConnectionCard } = await import('@/components/connections/ConnectionCard')
  const h = React.createElement
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }
  const render = (el: React.ReactElement) => renderToStaticMarkup(h(AppRouterContext.Provider, { value: router as never }, el))

  const urlWith = await fetchPrimaryPhotoUrl(db, WITH)
  const urlWithout = await fetchPrimaryPhotoUrl(db, WITHOUT)

  // Match card (computedMatchCards → photo_url → identity.photoUrl)
  const matchCard = (photoUrl: string | null) =>
    render(h(MatchCard, {
      matchId: 'm', score: 84, sections: [], interpretation: null, state: 'unlocked', badge: { label: 'STRONG MATCH' },
      identity: { nameToken: 'Alex', age: 31, photoUrl, demographics: null },
    }))
  const mcWith = matchCard(urlWith)
  const mcWithout = matchCard(urlWithout)
  ok(mcWith.includes(`src="${URL_WITH}"`), 'match card: member with a photo renders the real URL')
  ok(!mcWithout.includes('<img'), 'match card: member without a photo renders no <img>')
  ok(mcWithout !== mcWith && mcWithout.includes('<svg'), 'match card: member without a photo renders the silhouette')

  // Dashboard card (ProfileCard: dashboard matches / connections / nudges variants)
  const dashCard = (photo: string | null) =>
    render(h(ProfileCard, {
      variant: 'match', onClick() {},
      profile: { id: 'p', username: 'Alex', photo: photo ?? undefined, compatibilityPercentage: 84, topFactor: 'Shared goals' },
    }))
  const dcWith = dashCard(urlWith)
  const dcWithout = dashCard(urlWithout)
  ok(dcWith.includes(`src="${URL_WITH}"`), 'dashboard card: member with a photo renders the real URL')
  ok(!dcWithout.includes('<img'), 'dashboard card: member without a photo renders no <img>')
  ok(dcWithout.includes('<circle') && dcWithout.includes('<ellipse'), 'dashboard card: member without a photo renders the silhouette')

  // Connections (getConnections → partnership.photo_url → ConnectionCard avatar).
  // Radix AvatarImage only mounts its <img> after the browser loads it, so SSR
  // proves the branch: a URL suppresses the initials fallback; no URL shows it.
  const connCard = (photo_url: string | undefined) =>
    render(h(ConnectionCard, {
      onClick() {},
      connection: {
        partnership: { id: 'c', display_name: 'Quinn River', photo_url, profile_type: 'solo', city: null },
        compatibility: { overallScore: 84, tier: 'Platinum', categories: [] },
        matchedAt: new Date('2026-10-01T00:00:00Z').toISOString(),
      } as never,
    }))
  const ccWith = connCard((await fetchPrimaryPhotoUrl(db, WITH)) ?? undefined)
  const ccWithout = connCard((await fetchPrimaryPhotoUrl(db, WITHOUT)) ?? undefined)
  ok(!ccWith.includes('>QR<'), 'connections card: member with a photo takes the photo branch (no initials fallback)')
  ok(ccWithout.includes('>QR<'), 'connections card: member without a photo renders the initials fallback')

  // ── 3. Structural: the read path can't regress ─────────────────────────────
  const ROOT = join(__dirname, '..', '..', '..')
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p)
    }
  }
  for (const d of ['lib', 'app', 'components']) walk(join(ROOT, d))
  const code = (p: string) => readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '')
  const rel = (p: string) => relative(ROOT, p)

  const storagePath = files.filter((f) => /storage_path/.test(code(f))).map(rel)
  eq(storagePath, [], 'no code anywhere references storage_path (the column does not exist)')

  // getPublicUrl is legitimate ONLY where a file has just been uploaded and its
  // URL is being stored. A new caller is a new read path rebuilding URLs → fail.
  const UPLOAD_PATHS = [
    'app/api/ingest/survey/route.ts',
    'app/api/photos/upload/route.ts',
    'app/chat/[connectionId]/page.tsx',
    'app/profile/edit/page.tsx',
    'components/dashboard/PhotoManagerModal.tsx',
    'components/settings/PhotosTab.tsx',
    'lib/actions/uploadProfilePhoto.ts',
    'lib/services/photos.ts',
  ]
  const publicUrlCallers = files.filter((f) => /getPublicUrl\(/.test(code(f))).map(rel).sort()
  eq(publicUrlCallers, [...UPLOAD_PATHS].sort(), 'getPublicUrl appears only on upload paths')

  const bucketRefs = files.filter((f) => /['"]partnership-photos['"]/.test(code(f))).map(rel).sort()
  eq(bucketRefs, ['lib/account/deleteAccount.ts', 'lib/actions/uploadProfilePhoto.ts'], 'partnership-photos bucket only on the upload + account-deletion paths')

  const READ_SITES = [
    'lib/actions/computedMatchCards.ts', 'lib/actions/connections.ts', 'lib/actions/dashboard.ts',
    'lib/actions/handshakes.ts', 'lib/actions/hiddenMatches.ts', 'lib/actions/nudges.ts',
    'lib/actions/profiles.ts', 'lib/connections/getConnections.ts', 'lib/matching/getExternalMatches.ts',
  ]
  for (const f of READ_SITES) {
    const src = code(join(ROOT, f))
    ok(/from '@\/lib\/photos\/primaryPhoto'/.test(src), `${f} reads photos through lib/photos/primaryPhoto`)
  }

  report('photo read path')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
