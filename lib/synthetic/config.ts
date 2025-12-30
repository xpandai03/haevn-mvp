/**
 * Synthetic Users Configuration
 *
 * These partnership IDs represent scripted "test" partnerships that:
 * - Auto-accept connection requests from configured test accounts
 * - Never initiate any action
 * - Enable deterministic testing of the core flow
 *
 * SAFETY: Empty arrays = no synthetic behavior active
 */

// Test account user IDs that can trigger synthetic behavior
// Get these by running:
// SELECT id, email FROM auth.users WHERE email IN ('raunek@xpandai.com', 'raunek@cloudsteer.com', 'rik@haevn.co');
export const TEST_ACCOUNT_USER_IDS: string[] = [
  // Add actual user IDs here after querying the database
]

// Partnership IDs that are synthetic (auto-accept connections)
// These partnerships will auto-accept connection requests from test accounts
export const SYNTHETIC_PARTNERSHIP_IDS: string[] = [
  // Add synthetic partnership UUIDs here
]

/**
 * Check if a partnership is synthetic
 */
export function isSyntheticPartnership(partnershipId: string): boolean {
  return SYNTHETIC_PARTNERSHIP_IDS.includes(partnershipId)
}

/**
 * Check if user is a test account that can trigger synthetic behavior
 */
export function isTestAccount(userId: string): boolean {
  return TEST_ACCOUNT_USER_IDS.includes(userId)
}
