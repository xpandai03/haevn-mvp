/**
 * Member-facing strings for the messaging gate.
 *
 * SEPARATE MODULE ON PURPOSE. lib/actions/connections.ts carries the 'use server'
 * directive, and Next.js allows a "use server" file to export ONLY async
 * functions — a plain `export const` there fails the webpack build. tsc and the
 * unit suite both pass it, so this is a constraint only `npm run build` catches.
 */

/**
 * What a free member gets from the send action. Deliberately the same message
 * the UI's upgrade toast shows, so a direct invocation and the on-screen path
 * tell the member the same thing — never a silent failure or a generic error.
 */
export const UPGRADE_REQUIRED_ERROR = 'Upgrade to HAEVN+ to send messages'
