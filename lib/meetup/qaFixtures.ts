/**
 * QA fixture tagging for the Meetup Spots harness.
 *
 * THE PROBLEM THIS EXISTS TO SOLVE.
 * Vercel preview deployments for this project share PRODUCTION's Supabase:
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are one value across
 * Production, Preview and Development. So a synthetic fixture seeded for a
 * preview QA run lands in the production database, and:
 *
 *   - computed_matches is never deleted, only upserted (computeMatches.ts), so
 *     directly-inserted fixture pairs persist until something removes them; and
 *   - the nightly production meetup cron builds from the released pair set, so
 *     those fixture pairs would be counted in production's pair_count.
 *
 * Teardown alone is not enough protection: it is a script someone has to
 * remember to run, and a forgotten fixture silently corrupts a client-facing
 * number. So exclusion is STRUCTURAL and defaults to production behaviour.
 *
 * THE RULE. A partnership tagged QA_FIXTURE_BADGE is invisible to the feed, and
 * any pair with a tagged partnership on either side is dropped — unless
 * QA_HARNESS_ENABLED is explicitly 'true', which is set only on the preview
 * deployment. Production never sets it, so production never sees a fixture even
 * while one exists in the shared database.
 *
 * Fixtures are additionally created with profile_state='draft', which keeps them
 * out of the weekly recompute (it selects profile_state='live') and out of the
 * no-match ping audience. Belt and braces: the draft state stops them being
 * MATCHED against real members; this badge stops them being REPORTED.
 */

/**
 * system_events.event_type the mock receiver stores pushes under.
 *
 * Lives here, not in the route file: a Next.js route module may export only the
 * reserved names (GET/POST/…/dynamic/maxDuration), and any other export fails
 * the generated route type check.
 */
export const QA_RECEIVED_EVENT = 'qa_meetup_received'

/** Marker written to partnerships.badges by the seed script. */
export const QA_FIXTURE_BADGE = 'QA_FIXTURE'

/**
 * Is the QA harness active? Preview only — production never sets this.
 * Anything but the exact string 'true' is off, like every other flag here.
 */
export function qaHarnessEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.QA_HARNESS_ENABLED === 'true'
}

/**
 * Restrict the feed to ONLY fixtures, so a QA run produces a deterministic
 * payload instead of the fixture set buried in ~400 real pairs. Harness-only:
 * meaningless (and inert) unless QA_HARNESS_ENABLED is also true.
 */
export function qaFixturesOnly(env: NodeJS.ProcessEnv = process.env): boolean {
  return qaHarnessEnabled(env) && env.QA_FIXTURES_ONLY === 'true'
}

/** Does this partnership's badge list mark it as a QA fixture? */
export function isQaFixture(badges: unknown): boolean {
  if (!Array.isArray(badges)) return false
  return badges.some((b) => String(b).trim().toUpperCase() === QA_FIXTURE_BADGE)
}

/**
 * Should the feed include a partnership with these badges?
 *
 * Real partnerships: always. Fixtures: only under the harness flag.
 * Note the asymmetry is deliberate — the failure mode we protect against is a
 * fixture leaking INTO production, never a real member being dropped.
 */
export function includeInFeed(badges: unknown, env: NodeJS.ProcessEnv = process.env): boolean {
  if (isQaFixture(badges)) return qaHarnessEnabled(env)
  // A real partnership is always included, EXCEPT under fixtures-only mode,
  // which exists so a QA payload is exactly the fixture set. That mode can only
  // be reached with the harness on, so production is unaffected either way.
  return !qaFixturesOnly(env)
}
