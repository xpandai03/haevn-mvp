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
export const TEST_ACCOUNT_USER_IDS: string[] = [
  'f4cb13a5-747a-4e72-994d-874840f92071', // raunek@cloudsteer.com
  'cea67699-afa2-47c6-8a33-f1d472aeb74b', // rikfoote@haevn.co
  'dc5c3a21-9565-4a0a-a7c5-18dcf095b400', // raunek@xpandai.com
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
