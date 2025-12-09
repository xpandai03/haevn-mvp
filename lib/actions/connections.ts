/**
 * Connections Actions
 *
 * Server actions for fetching and managing connections.
 * Uses the NEW 5-category matching engine for compatibility scores.
 */

'use server'

import {
  getConnectionsWithCompatibility,
  getConnectionDetails,
  type ConnectionResult,
} from '@/lib/connections/getConnections'

// Re-export types for convenience
export type { ConnectionResult }

/**
 * Get all connections for the current user with full compatibility breakdown.
 *
 * @returns Array of connections sorted by matched_at descending
 */
export async function getMyConnections(): Promise<ConnectionResult[]> {
  return getConnectionsWithCompatibility()
}

/**
 * Get details for a specific connection.
 *
 * @param connectionId - Either the handshake ID or the other partnership's ID
 * @returns Connection details with full compatibility breakdown, or null if not found
 */
export async function getConnectionById(
  connectionId: string
): Promise<ConnectionResult | null> {
  return getConnectionDetails(connectionId)
}

// =============================================================================
// LEGACY COMPATIBILITY
// =============================================================================

/**
 * @deprecated Use getMyConnections() instead - provides full compatibility breakdown
 */
export interface Connection {
  id: string
  photo?: string
  username: string
  city?: string
  distance?: number
  compatibilityPercentage: number
  topFactor: string
  latestMessage?: string
  latestMessageAt?: Date
  unreadCount: number
  hasActiveConversation: boolean
  isMutualMatch: boolean
}

/**
 * @deprecated Use getMyConnections() instead
 *
 * Legacy function maintained for backward compatibility.
 * Returns connections in the old format.
 */
export async function getConnections(): Promise<Connection[]> {
  const connections = await getConnectionsWithCompatibility()

  // Map to legacy format
  return connections.map(conn => {
    // Find top category for "topFactor"
    const topCategory = conn.compatibility.categories
      .filter(c => c.included)
      .reduce((best, cat) => cat.score > best.score ? cat : best, { category: 'intent', score: 0 })

    const categoryLabels: Record<string, string> = {
      intent: 'Intent & Goals',
      structure: 'Structure Fit',
      connection: 'Connection Style',
      chemistry: 'Sexual Chemistry',
      lifestyle: 'Lifestyle Fit',
    }

    return {
      id: conn.partnership.id,
      photo: conn.partnership.photo_url,
      username: conn.partnership.display_name || 'User',
      city: conn.partnership.city,
      compatibilityPercentage: conn.compatibility.overallScore,
      topFactor: categoryLabels[topCategory.category] || 'Compatible',
      // These fields require message data - not currently fetched
      latestMessage: undefined,
      latestMessageAt: undefined,
      unreadCount: 0,
      hasActiveConversation: false,
      isMutualMatch: true,
    }
  })
}

/**
 * @deprecated Use getConnectionById() instead
 */
export async function getConnection(partnershipId: string): Promise<Connection | null> {
  const connections = await getConnections()
  return connections.find(c => c.id === partnershipId) || null
}
