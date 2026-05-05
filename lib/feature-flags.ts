/**
 * Feature flags for HAEVN.
 *
 * Read from environment variables so the value can be flipped per
 * environment (preview, staging, prod) without a code deploy. Use
 * NEXT_PUBLIC_ prefixes only on flags that must be readable in client
 * bundles; otherwise keep them server-only.
 */

export const FEATURE_FLAGS = {
  /**
   * When true: verification is mandatory to access the dashboard. The
   * Skip button is hidden, and middleware redirects unverified users
   * back to /onboarding/verification.
   *
   * When false (default): verification is skippable. Users can reach
   * the dashboard without verifying. This is the rollout-period
   * default; flip to true once we're ready to enforce.
   */
  requireVerification:
    process.env.NEXT_PUBLIC_REQUIRE_VERIFICATION === 'true',
} as const
