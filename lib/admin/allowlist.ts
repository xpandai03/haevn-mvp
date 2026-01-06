/**
 * Admin Allowlist
 *
 * Controls access to internal-only tools like the Matching Control Center.
 * This is a hardcoded allowlist - no database, no feature flags.
 *
 * IMPORTANT: This check must happen SERVER-SIDE only.
 * Never expose this list or the check function to the client.
 */

/**
 * Emails allowed to access internal admin tools.
 * Add/remove emails here to grant/revoke access.
 */
const ADMIN_ALLOWLIST: string[] = [
  'raunek@xpandai.com',
  'raunek@cloudsteer.com',
  'rikfoote@haevn.co',
]

/**
 * Check if a user email is in the admin allowlist.
 *
 * @param email - User's email address (case-insensitive)
 * @returns true if user has admin access, false otherwise
 */
export function isAdminUser(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_ALLOWLIST.includes(email.toLowerCase())
}

/**
 * Get the list of admin emails (for logging/debugging only).
 * Do NOT expose this to clients.
 */
export function getAdminEmails(): string[] {
  return [...ADMIN_ALLOWLIST]
}
