/**
 * ROUTE MATRIX — the proof that the unmatched-path 404 cannot take a real route
 * off the site.
 *
 * Two halves:
 *   1. DRIFT GUARD. Re-derives the route list from the `app/` directory and
 *      fails if lib/routes/routeTable.ts disagrees. A route added tomorrow
 *      without updating the table fails CI instead of 404ing in production.
 *   2. BEHAVIOUR. Every real route resolves; unknown paths do not; and the
 *      known-junk URLs from the incident are correctly rejected.
 *
 * Run: npx tsx lib/routes/__tests__/routeTable.test.ts
 */
import { readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'
import { isKnownRoute, isInfrastructurePath, STATIC_ROUTES, DYNAMIC_ROUTES } from '../routeTable'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

const root = join(__dirname, '../../..')
const APP = join(root, 'app')

/** Walk `app/` and derive the URL each page.tsx / route.ts actually serves. */
function deriveRoutesFromDisk(): { statics: string[]; dynamics: string[] } {
  const statics = new Set<string>()
  const dynamics = new Set<string>()

  const walk = (dir: string, segments: string[]) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        // Route groups "(name)" are organisational and contribute NO url segment.
        if (entry.startsWith('(') && entry.endsWith(')')) walk(full, segments)
        else walk(full, [...segments, entry])
        continue
      }
      if (entry !== 'page.tsx' && entry !== 'page.ts' && entry !== 'route.ts' && entry !== 'route.tsx') continue
      const isDynamic = segments.some((s) => s.startsWith('[') && s.endsWith(']'))
      const url = '/' + segments.map((s) => (s.startsWith('[') && s.endsWith(']') ? ':seg' : s)).join('/')
      const normalized = url === '/' ? '/' : url.replace(/\/$/, '')
      if (isDynamic) dynamics.add(normalized)
      else statics.add(normalized === '' ? '/' : normalized)
    }
  }
  walk(APP, [])
  return { statics: [...statics].sort(), dynamics: [...dynamics].sort() }
}

function main() {
  const disk = deriveRoutesFromDisk()

  // ══ 1. DRIFT GUARD ═══════════════════════════════════════════════════════
  const missingStatic = disk.statics.filter((r) => !STATIC_ROUTES.includes(r))
  const extraStatic = STATIC_ROUTES.filter((r) => !disk.statics.includes(r))
  eq(missingStatic, [], 'every static route on disk is in the table (a missing one would 404 in prod)')
  eq(extraStatic, [], 'the table lists no static route that does not exist on disk')

  const missingDynamic = disk.dynamics.filter((r) => !DYNAMIC_ROUTES.includes(r))
  const extraDynamic = DYNAMIC_ROUTES.filter((r) => !disk.dynamics.includes(r))
  eq(missingDynamic, [], 'every dynamic route on disk is in the table')
  eq(extraDynamic, [], 'the table lists no dynamic route that does not exist on disk')
  ok(disk.statics.length + disk.dynamics.length > 120,
    `the derivation actually found the routes (${disk.statics.length} static + ${disk.dynamics.length} dynamic)`)

  // ══ 2. EVERY REAL ROUTE RESOLVES ═════════════════════════════════════════
  for (const r of disk.statics) ok(isKnownRoute(r), `static route resolves: ${r}`)

  // Dynamic routes, exercised with realistic segment values.
  const SAMPLES: Record<string, string[]> = {
    ':seg': [
      '8385ba63-1234-4abc-9def-0123456789ab',           // uuid
      'a'.repeat(64),                                    // handoff token
      '42', 'q19a_max_distance', 'some-slug',
    ],
  }
  for (const shape of disk.dynamics) {
    for (const sample of SAMPLES[':seg']) {
      const concrete = shape.replaceAll(':seg', sample)
      ok(isKnownRoute(concrete), `dynamic route resolves: ${shape} -> ${concrete.slice(0, 48)}`)
    }
  }

  // The routes named in the brief, explicitly.
  for (const p of [
    '/login-link/2b717de6-d46f-4464-bf76-84fa9110341f',
    '/impersonate/' + 'f'.repeat(64),
    '/auth/login', '/dashboard', '/dashboard/matches',
    '/dashboard/matches/abc-123/breakdown',
    '/chat', '/chat/abc-123', '/messages', '/founding-member',
    '/admin/matches', '/admin/network-performance', '/admin/users', '/admin/surveys',
    '/api/cron/notify-matches', '/api/cron/meetup-feed', '/api/admin/meetup-feed',
    '/api/auth/login-link/consume', '/auth/confirm', '/auth/callback', '/',
  ]) ok(isKnownRoute(p), `named surface resolves: ${p}`)

  // Trailing slash must not break a real route.
  for (const p of ['/dashboard/', '/auth/login/', '/chat/abc-123/']) {
    ok(isKnownRoute(p), `trailing slash tolerated: ${p}`)
  }

  // ══ 3. UNKNOWN PATHS ARE REJECTED ════════════════════════════════════════
  for (const p of [
    '/qa-nonexistent-page-check',        // the incident URL
    '/api/qa/mock-emergent',             // the other incident URL (not on main)
    '/wp-admin', '/.env', '/admin/../etc',
    '/dashboard/matches/abc/breakdown/extra',
    '/chat/abc/def', '/nope', '/api/nope', '/api/admin/nope',
    '/onboarding/nope', '/auth/nope',
  ]) ok(!isKnownRoute(p), `unknown path rejected: ${p}`)

  // A dynamic route must match exactly ONE segment, not swallow children.
  ok(!isKnownRoute('/login-link/abc/def'), 'a dynamic segment does not match two segments')
  ok(!isKnownRoute('/login-link/'), 'a dynamic route with an EMPTY segment is not a route')
  ok(!isKnownRoute('/profile/edit/extra'), 'a deeper path under a real route is still unknown')

  // ══ 4. INFRASTRUCTURE IS NEVER JUDGED ════════════════════════════════════
  for (const p of [
    '/_next/static/chunks/main-app.js', '/_next/image', '/_vercel/insights/script.js',
    '/favicon.ico', '/robots.txt', '/sitemap.xml',
    '/icon.png', '/apple-touch-icon.png', '/fonts/x.woff2',
    '/some/lottie-animation.json', '/video.mp4', '/anything.txt',
  ]) {
    ok(isInfrastructurePath(p), `treated as infrastructure: ${p}`)
    ok(isKnownRoute(p), `...and therefore passed through: ${p}`)
  }

  // ══ 5. FAILS OPEN ════════════════════════════════════════════════════════
  for (const bad of ['', null, undefined, 'not-a-path', 123, {}]) {
    ok(isKnownRoute(bad as any), `unparseable input passes through rather than 404ing: ${JSON.stringify(bad)}`)
  }

  // ══ 6. MIDDLEWARE WIRING ═════════════════════════════════════════════════
  const mwRaw = readFileSyncSafe('middleware.ts')
  // Assert about CODE, not the prose explaining it.
  const mw = mwRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  ok(/import \{ isKnownRoute \}/.test(mw), 'middleware imports the route table')
  const bodyStart = mw.indexOf('export async function middleware')
  const guardIdx = mw.indexOf('if (!isKnownRoute(pathname))', bodyStart)
  ok(guardIdx > -1, 'middleware short-circuits unknown paths')
  // It must run before ANY auth/session work.
  for (const later of ['createServerClient', 'auth.getUser', 'selectBestPartnership(']) {
    const idx = mw.indexOf(later, bodyStart)
    if (idx > -1) ok(guardIdx < idx, `the short-circuit runs before ${later}`)
  }
  ok(/status: 404/.test(mw.slice(guardIdx, guardIdx + 600)), 'it returns a 404')
  ok(/text\/plain/.test(mw.slice(guardIdx, guardIdx + 600)), 'bare text/plain — no app shell, no client JS')
  ok(/s-maxage=3600/.test(mw.slice(guardIdx, guardIdx + 600)), 'cache-friendly at the edge')
  ok(!/Set-Cookie|setCookie/i.test(mw.slice(guardIdx, guardIdx + 600)), 'the 404 sets no cookie')

  report('route-table')
}

function readFileSyncSafe(rel: string): string {
  const p = join(root, rel)
  return existsSync(p) ? require('fs').readFileSync(p, 'utf8') : ''
}

main()
