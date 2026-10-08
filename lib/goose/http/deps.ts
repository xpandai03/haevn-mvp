/**
 * Production wiring for the Goose routes: the Supabase repo and next/server
 * `after` for post-response work. Kept out of handlers.ts so tests never load
 * next/server or construct a database client.
 */
import { after } from 'next/server'
import { createSupabaseGooseRepo } from '../repo'
import type { GooseHttpDeps } from './handlers'

export function gooseDeps(): GooseHttpDeps {
  return { repo: () => createSupabaseGooseRepo(), schedule: (task) => after(task) }
}
