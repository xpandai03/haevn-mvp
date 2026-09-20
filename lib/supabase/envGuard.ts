/**
 * Refuses to hand a PRODUCTION-database service-role client to a non-production
 * deployment.
 *
 * WHY THIS EXISTS. On 2026-09-11 a preview-hosted QA harness wrote 78 synthetic
 * rows into production `system_events` and fired 8 real outbound feed pushes —
 * 4 of them built from real production member data — because
 * SUPABASE_SERVICE_ROLE_KEY was scoped to Production, Preview AND Development.
 * Every preview build therefore held unrestricted write access to live member
 * data, and any future branch would have too.
 *
 * The scoping is now Production-only, which is the actual fix. This guard is the
 * backstop: if the key is ever re-broadened — by a dashboard click, a new
 * project, a restored backup — a preview deployment still cannot reach the
 * production database. Env scoping is a setting someone can undo; this is code.
 *
 * It also closes a second hole that env scoping alone cannot. The production
 * Supabase URL is hardcoded as a fallback in six call sites (lib/supabase/
 * {admin,server,client}.ts, app/auth/{confirm,callback}/route.ts,
 * app/api/auth/signup/route.ts), so removing NEXT_PUBLIC_SUPABASE_URL from
 * Preview does nothing at all — every one of them silently falls back to prod.
 * Guarding the resolved URL catches that path too.
 *
 * THE RULE. A non-production *Vercel deployment* may not open a service-role
 * client against the production Supabase project. Pointed at any other database,
 * it runs untouched — which is what "preview gets its own database" would look
 * like, so this guard does not stand in the way of that fix later.
 *
 * Local machines are deliberately NOT restricted. `vercel dev` and the ops
 * scripts under scripts/ (export-meetup-feed, backfill-*, seed-admin-users) are
 * run by hand against production on purpose, and breaking them would trade a
 * data-integrity hole for an operational one. The signal we key on is
 * VERCEL === '1' — i.e. code running inside a Vercel build or function — not the
 * mere absence of VERCEL_ENV.
 */

/** Just enough of `process.env` to test against, without a Node type dependency. */
export type EnvLike = Record<string, string | undefined>

/** The production Supabase project. Also the hardcoded fallback in six files. */
export const PRODUCTION_SUPABASE_HOST = 'sdepasybfkmxcswaxnsz.supabase.co'

export class ProdDatabaseAccessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProdDatabaseAccessError'
  }
}

/** Hostname of a Supabase URL, or '' if it is unparseable. */
function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return ''
  }
}

/** Is this the production Supabase project? */
export function isProductionDatabase(url: string): boolean {
  return hostOf(url) === PRODUCTION_SUPABASE_HOST
}

/**
 * Running inside a Vercel deployment that is NOT production?
 *
 * Both halves matter. VERCEL === '1' means a Vercel build or function, which
 * excludes laptops and CI. VERCEL_ENV is 'production' | 'preview' |
 * 'development'; anything that is not exactly 'production' is treated as
 * non-production, so an unset or unrecognised value fails SAFE.
 */
export function isNonProductionDeployment(env: EnvLike = process.env): boolean {
  if (env.VERCEL !== '1') return false
  return env.VERCEL_ENV !== 'production'
}

/**
 * Throws when a non-production deployment tries to open a service-role client
 * against the production database. Call it at every service-role entry point,
 * BEFORE the client is constructed.
 */
export function assertSafeServiceRoleTarget(
  url: string,
  env: EnvLike = process.env
): void {
  if (!isNonProductionDeployment(env)) return
  if (!isProductionDatabase(url)) return

  throw new ProdDatabaseAccessError(
    `Refusing to open a service-role connection to the PRODUCTION database ` +
      `(${PRODUCTION_SUPABASE_HOST}) from a non-production deployment ` +
      `(VERCEL_ENV=${env.VERCEL_ENV ?? 'unset'}). ` +
      `Preview and development deployments must not hold production credentials — ` +
      `see docs/admin/preview-prod-isolation-2026-09-20.md. ` +
      `Point this deployment at a non-production Supabase project to proceed.`
  )
}
