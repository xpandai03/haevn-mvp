/**
 * Pinned auth cookie config for all Supabase clients (browser, server,
 * middleware, callback). Two reasons this lives in one place:
 *
 * 1. NAME — @supabase/ssr derives the default cookie name from the
 *    Supabase project URL (sb-<ref>-auth-token). Every client must
 *    resolve to the SAME URL or they look at different cookies.
 *    Pinning the name decouples cookie identity from URL resolution.
 *
 * 2. SECURE — @supabase/ssr's DEFAULT_COOKIE_OPTIONS does NOT include
 *    the `Secure` attribute. On a production HTTPS site, mobile Safari
 *    ITP and recent Chrome can purge non-Secure cookies across
 *    cross-site redirect chains (your-app → google → supabase →
 *    your-app), which manifests as "PKCE code verifier not found in
 *    storage" after Google OAuth. Setting Secure makes the cookie
 *    survive that round-trip.
 *
 * Conditional on NODE_ENV so localhost dev (http) still works — Secure
 * cookies are blocked on plain http (except some browsers' localhost
 * exceptions, which we don't want to depend on).
 *
 * No imports in this file so it's safe to load from middleware (Edge
 * runtime) without dragging in browser/server SDK side effects.
 */

export const HAEVN_AUTH_COOKIE_NAME = 'sb-haevn-auth'

const isProduction = process.env.NODE_ENV === 'production'

export const HAEVN_AUTH_COOKIE_OPTIONS = {
  name: HAEVN_AUTH_COOKIE_NAME,
  path: '/',
  sameSite: 'lax' as const,
  secure: isProduction,
}
