'use server'

import { isMessagingEnabled } from '@/lib/promo/config'

/**
 * Server-side read of the messaging kill switch, for client surfaces.
 *
 * MESSAGING_ENABLED is server-only (no NEXT_PUBLIC_ prefix) on purpose — the
 * value must not be readable or forgeable from the browser bundle. Client
 * components ask through this action instead.
 */
export async function getMessagingOpen(): Promise<boolean> {
  return isMessagingEnabled()
}
