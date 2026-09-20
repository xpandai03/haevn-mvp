/**
 * Preview/development deployments must not reach the production database.
 * Run: npx tsx lib/supabase/__tests__/envGuard.test.ts
 *
 * The matrix that matters is (where am I running) x (what am I pointed at).
 * Only one cell throws: a non-production Vercel deployment aimed at prod.
 */
import {
  assertSafeServiceRoleTarget,
  isNonProductionDeployment,
  isProductionDatabase,
  ProdDatabaseAccessError,
  PRODUCTION_SUPABASE_HOST,
  type EnvLike,
} from '../envGuard'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const PROD_URL = `https://${PRODUCTION_SUPABASE_HOST}`
const STAGING_URL = 'https://abcdefghijklmnop.supabase.co'

/** Does the guard throw for this (env, url) pair? */
function throws(env: EnvLike, url: string): boolean {
  try {
    assertSafeServiceRoleTarget(url, env)
    return false
  } catch (e) {
    ok(e instanceof ProdDatabaseAccessError, 'throws ProdDatabaseAccessError, not a bare Error')
    return true
  }
}

const preview: EnvLike = { VERCEL: '1', VERCEL_ENV: 'preview' }
const devDeploy: EnvLike = { VERCEL: '1', VERCEL_ENV: 'development' }
const production: EnvLike = { VERCEL: '1', VERCEL_ENV: 'production' }
const laptop: EnvLike = {}

// ── The incident: a preview deployment pointed at prod ────────────────────
ok(throws(preview, PROD_URL), 'preview deployment -> prod DB: REFUSED (the Sep 11 hole)')
ok(throws(devDeploy, PROD_URL), 'development deployment -> prod DB: REFUSED')

// ── Production must be completely unaffected ──────────────────────────────
ok(!throws(production, PROD_URL), 'production deployment -> prod DB: allowed')

// ── Local machines keep working: ops scripts run against prod on purpose ──
ok(!throws(laptop, PROD_URL), 'laptop / ops script -> prod DB: allowed (no VERCEL)')
ok(
  !throws({ VERCEL_ENV: 'development' }, PROD_URL),
  'VERCEL_ENV set but VERCEL unset (e.g. a pulled .env) -> allowed: not a deployment'
)

// ── Pointed at a non-prod database, every environment is free ─────────────
ok(!throws(preview, STAGING_URL), 'preview -> non-prod DB: allowed (the real fix, unblocked)')
ok(!throws(devDeploy, STAGING_URL), 'development -> non-prod DB: allowed')
ok(!throws(production, STAGING_URL), 'production -> non-prod DB: allowed')

// ── Fail safe on unknown/malformed input ──────────────────────────────────
ok(
  throws({ VERCEL: '1' }, PROD_URL),
  'VERCEL=1 with VERCEL_ENV unset -> treated as non-production: REFUSED'
)
ok(
  throws({ VERCEL: '1', VERCEL_ENV: 'Production' }, PROD_URL),
  'VERCEL_ENV is case-sensitive; "Production" is not "production": REFUSED'
)
ok(!throws(preview, 'not-a-url'), 'unparseable URL is not the prod host: allowed')

// ── Host matching is exact, not substring ─────────────────────────────────
eq(isProductionDatabase(PROD_URL), true, 'exact prod host matches')
eq(isProductionDatabase(`${PROD_URL}/`), true, 'trailing slash still matches')
eq(
  isProductionDatabase('https://sdepasybfkmxcswaxnsz.supabase.co.evil.test'),
  false,
  'lookalike domain with prod host as a prefix does NOT match'
)
eq(isProductionDatabase(STAGING_URL), false, 'a different supabase project does not match')

// ── Environment predicate ─────────────────────────────────────────────────
eq(isNonProductionDeployment(preview), true, 'preview is a non-production deployment')
eq(isNonProductionDeployment(production), false, 'production is not')
eq(isNonProductionDeployment(laptop), false, 'a laptop is not a deployment at all')

// ── The message has to tell whoever hits it what to do ────────────────────
try {
  assertSafeServiceRoleTarget(PROD_URL, preview)
} catch (e) {
  const m = (e as Error).message
  ok(m.includes('PRODUCTION'), 'message names the hazard')
  ok(m.includes('VERCEL_ENV=preview'), 'message reports the offending environment')
  ok(m.includes('docs/admin/'), 'message points at the incident write-up')
}

report('supabase-env-guard')
