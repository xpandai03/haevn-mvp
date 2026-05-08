/**
 * Pinned auth cookie name for all Supabase clients (browser, server,
 * middleware, callback). The default name @supabase/ssr generates is
 * derived from the Supabase project URL hostname (sb-<ref>-auth-token),
 * which means every client must resolve to the SAME URL or they end up
 * looking at different cookies — that's the failure mode behind
 * "PKCE code verifier not found in storage" when env vars drift between
 * client and server bundles.
 *
 * Kept in its own file with no imports so the constant is safe to
 * import from middleware (Edge runtime) without dragging in browser /
 * server SDK modules.
 */
export const HAEVN_AUTH_COOKIE_NAME = 'sb-haevn-auth'
