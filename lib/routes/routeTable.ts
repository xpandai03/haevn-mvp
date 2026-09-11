/**
 * The app's real route table, derived from the `app/` directory.
 *
 * WHY THIS EXISTS — the unmatched-path mitigation (2026-09-10).
 * A signed-in visitor on a URL with no matching route could put the app into a
 * reload loop: measured on production at 2,685 requests and 114 navigations in
 * 15 seconds for one visitor, plus ~345 Supabase reads. The root cause is not
 * yet established (see docs/backlog.md). This table lets middleware answer
 * "is this a real route?" and short-circuit anything that is not, BEFORE the
 * app shell, React, the auth provider or any Supabase client is involved — so
 * an unknown URL cannot churn regardless of the underlying cause.
 *
 * GENERATED, NOT HAND-MAINTAINED. `deriveRoutesFromDisk` below is the single
 * definition, and lib/routes/__tests__/routeTable.test.ts re-derives it from
 * the filesystem and fails if this file drifts. A hand-written list would
 * eventually 404 a real page in production, which is the one outcome worse than
 * the bug being mitigated.
 *
 * FAILS OPEN, ALWAYS. Anything this module is unsure about is treated as a real
 * route and passed through. Under-blocking costs us some of the mitigation;
 * over-blocking takes a working page off the site.
 */

/** Concrete paths with no dynamic segment. */
export const STATIC_ROUTES: readonly string[] = [
  '/',
  '/account-details',
  '/add-photos',
  '/admin/import-users',
  '/admin/match-inspection',
  '/admin/matches',
  '/admin/matching',
  '/admin/network-performance',
  '/admin/surveys',
  '/admin/users',
  '/api/admin/blast-matches',
  '/api/admin/export-members',
  '/api/admin/impersonate',
  '/api/admin/import-users',
  '/api/admin/markets',
  '/api/admin/match-history',
  '/api/admin/match-inspection',
  '/api/admin/match-interpretation-sample',
  '/api/admin/matches',
  '/api/admin/meetup-feed',
  '/api/admin/network-metrics',
  '/api/admin/recompute-matches',
  '/api/admin/regenerate-summary',
  '/api/admin/renotify',
  '/api/admin/run-full-cycle',
  '/api/admin/snapshot-network',
  '/api/admin/surveys',
  '/api/admin/system-status',
  '/api/admin/test-notify',
  '/api/admin/trigger-release',
  '/api/admin/users',
  '/api/admin/zips',
  '/api/ai/generate-summaries',
  '/api/ai/icebreakers',
  '/api/auth/login-link',
  '/api/auth/login-link/consume',
  '/api/auth/signup',
  '/api/cron/downgrade-expired',
  '/api/cron/meetup-feed',
  '/api/cron/notify-matches',
  '/api/cron/recompute-matches',
  '/api/cron/renotify',
  '/api/cron/snapshot-network',
  '/api/cron/warm-interpretations',
  '/api/debug-env',
  '/api/debug/partnership',
  '/api/dev/flip-city',
  '/api/dev/force-connection',
  '/api/dev/force-handshake',
  '/api/dev/force-nudge',
  '/api/dev/populate-test-profile',
  '/api/dev/seed',
  '/api/dev/setup-database',
  '/api/dev/setup-storage',
  '/api/health/supabase',
  '/api/impersonate/consume',
  '/api/ingest/survey',
  '/api/lemonsqueezy/checkout',
  '/api/lemonsqueezy/webhook',
  '/api/matches/hidden',
  '/api/matches/hide',
  '/api/matches/ready-to-meet',
  '/api/matches/restore',
  '/api/msa-check',
  '/api/onboarding/resume-step',
  '/api/onboarding/save-identity',
  '/api/partnerships/debug-info',
  '/api/partnerships/my-partnership',
  '/api/photos/grant',
  '/api/photos/upload',
  '/api/survey/load',
  '/api/survey/save',
  '/api/test/phase3-backend',
  '/api/unsubscribe',
  '/api/veriff/webhook',
  '/api/verify/start',
  '/api/webhooks/resend',
  '/auth/callback',
  '/auth/confirm',
  '/auth/login',
  '/auth/reset-password',
  '/auth/signup',
  '/auth/signup/step-1',
  '/auth/signup/step-2',
  '/auth/signup/step-3',
  '/auth/signup/step-4',
  '/auth/update-password',
  '/chat',
  '/connections',
  '/dashboard',
  '/dashboard/compatibility',
  '/dashboard/connections',
  '/dashboard/hidden',
  '/dashboard/invite',
  '/dashboard/matches',
  '/dashboard/meetups',
  '/dashboard/nudges',
  '/dashboard/recommendations',
  '/debug-auth',
  '/debug/clear-session',
  '/dev/health',
  '/dev/tools',
  '/discovery',
  '/founding-member',
  '/matches',
  '/messages',
  '/nudges',
  '/onboarding/accept-invite',
  '/onboarding/celebration',
  '/onboarding/expectations',
  '/onboarding/identity',
  '/onboarding/membership',
  '/onboarding/review-survey',
  '/onboarding/survey',
  '/onboarding/survey-intro',
  '/onboarding/verification',
  '/onboarding/verification-complete',
  '/onboarding/verification/return',
  '/partner-profile',
  '/profile',
  '/profile/edit',
  '/settings',
  '/splash',
  '/survey-results',
  '/test-matching',
  '/upgrade/success',
  '/waitlist',
]

/**
 * Routes with a dynamic segment, as literal shapes. `:seg` matches exactly one
 * non-empty path segment — the same thing Next's `[param]` matches.
 */
export const DYNAMIC_ROUTES: readonly string[] = [
  '/chat/:seg',
  '/connections/:seg',
  '/dashboard/matches/:seg',
  '/dashboard/matches/:seg/breakdown',
  '/impersonate/:seg',
  '/login-link/:seg',
  '/matches/:seg',
  '/onboarding/survey/:seg',
  '/profile/:seg',
  '/profiles/:seg',
]

const STATIC_SET = new Set(STATIC_ROUTES)

const DYNAMIC_PATTERNS: RegExp[] = DYNAMIC_ROUTES.map(
  (shape) => new RegExp('^' + shape.replace(/\//g, '\\/').replace(/:seg/g, '[^\\/]+') + '$')
)

/**
 * Paths middleware must never judge: framework internals and anything that
 * looks like a file. The dot rule is deliberately broad — a real PAGE route
 * never has a dot in its last segment, while every asset in public/ does, so
 * one rule covers fonts, .txt, .json, media and anything added later without
 * this file needing to know about it.
 */
export function isInfrastructurePath(pathname: string): boolean {
  if (pathname.startsWith('/_next/') || pathname.startsWith('/_vercel/')) return true
  if (pathname === '/favicon.ico' || pathname === '/robots.txt' || pathname === '/sitemap.xml') return true
  const last = pathname.split('/').pop() ?? ''
  // A dot INSIDE the segment means a file extension (asset). A segment that
  // STARTS with a dot is a dotfile probe (/.env, /.git/config) and must fall
  // through to the 404 like any other unknown path.
  if (last.startsWith('.')) return false
  return last.includes('.')
}

/**
 * Is this a route the app actually serves?
 *
 * Trailing slashes are tolerated, and anything unparseable returns TRUE so the
 * request proceeds. The only paths that return false are ones positively known
 * not to exist.
 */
export function isKnownRoute(pathname: string): boolean {
  if (!pathname || typeof pathname !== 'string') return true
  if (!pathname.startsWith('/')) return true
  if (isInfrastructurePath(pathname)) return true

  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  if (STATIC_SET.has(p)) return true
  return DYNAMIC_PATTERNS.some((re) => re.test(p))
}
